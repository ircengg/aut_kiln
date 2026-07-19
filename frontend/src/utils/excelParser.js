import * as XLSX from 'xlsx';
import { WALL_LABELS, WALLS } from '../state/inspectionAtoms';

const DETAIL_KEYS = {
  title: 'inspectionName',
  'inspection details': 'inspectionName',
  'inspection name': 'inspectionName',
  'inspection date': 'inspectionDate',
};

const LEGACY_WALL_FIELDS = {
  'tube diameter': 'tubeDiameter',
  'tube length': 'tubeLength',
  'tube pitch': 'tubePitch',
  'tube count': 'tubeCount',
  'tube nominal': 'tubeNominal',
  'tube nomil': 'tubeNominal',
  'tube nominal thickness': 'tubeNominal',
  'tube nomil thicklness': 'tubeNominal',
};

const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const compact = (value) => normalize(value).replace(/[^a-z0-9]/g, '');

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toReadingNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number !== 0 ? number : null;
};

const formatDateParts = (year, month, day) =>
  `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;

function formatInspectionDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const serial = Number(value);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed) return formatDateParts(parsed.y, parsed.m, parsed.d);
  }

  return String(value ?? '').trim();
}

const readSheetRows = (workbook, sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
};

const findSheetName = (workbook, targetName) => {
  const normalizedTarget = compact(targetName);
  return workbook.SheetNames.find((name) => compact(name) === normalizedTarget);
};

function getFirstValue(row) {
  return row.find((cell, index) => index > 0 && cell !== null && cell !== '');
}

function getHeaderMap(row) {
  return Object.fromEntries(row.map((cell, index) => [normalize(cell), index]));
}

function makeLegacySections() {
  return WALLS.map((wall) => ({
    id: wall,
    name: WALL_LABELS[wall] || wall,
    layout: 'Vertical',
    tubeDiameter: null,
    tubeNominal: null,
    tubeLength: null,
    tubePitch: null,
    tubeCount: null,
    coils: null,
    inspectionType: 'Mapping',
  }));
}

function parseSectionTable(rows) {
  const headerIndex = rows.findIndex((row) => {
    const labels = row.map(normalize);
    return labels.includes('section') && labels.includes('tube diameter') && labels.includes('tube count');
  });

  if (headerIndex < 0) return [];

  const headerMap = getHeaderMap(rows[headerIndex]);
  const sections = [];

  rows.slice(headerIndex + 1).forEach((row) => {
    const sectionName = String(row[headerMap.section] ?? '').trim();
    if (!sectionName) return;

    sections.push({
      id: sectionName,
      name: sectionName,
      layout: String(row[headerMap.layout] ?? '').trim() || 'Vertical',
      tubeDiameter: toNumber(row[headerMap['tube diameter']]),
      tubeNominal: toNumber(row[headerMap['tube nominal']]),
      tubeLength: toNumber(row[headerMap['tube length']]),
      tubePitch: toNumber(row[headerMap['tube pitch']]),
      tubeCount: toNumber(row[headerMap['tube count']]),
      coils: toNumber(row[headerMap.coils]),
      inspectionType: String(row[headerMap['inspection type']] ?? '').trim() || 'Mapping',
    });
  });

  return sections;
}

function parseLegacySectionDetails(rows) {
  const sections = makeLegacySections();

  rows.forEach((row) => {
    const key = normalize(row[0]);
    const value = getFirstValue(row);
    if (!key || value === undefined) return;

    sections.forEach((section) => {
      const sectionKey = normalize(section.name);
      const compactSectionKey = compact(section.name);
      const isMatch = key.startsWith(sectionKey) || compact(key).startsWith(compactSectionKey);
      if (!isMatch) return;

      Object.entries(LEGACY_WALL_FIELDS).forEach(([label, field]) => {
        if (key.includes(label) || (field === 'tubeNominal' && key.includes('nominal'))) {
          section[field] = toNumber(value);
        }
      });
    });
  });

  return sections;
}

function parseDetails(workbook) {
  const sheetName = findSheetName(workbook, 'Details');
  const rows = readSheetRows(workbook, sheetName).filter((row) =>
    row.some((cell) => cell !== null && cell !== ''),
  );
  const details = {
    inspectionName: 'Inspection',
    inspectionDate: '',
    sections: [],
  };

  rows.forEach((row) => {
    const key = normalize(row[0]);
    const value = getFirstValue(row);
    if (!key || value === undefined) return;

    if (DETAIL_KEYS[key]) {
      details[DETAIL_KEYS[key]] =
        DETAIL_KEYS[key] === 'inspectionDate' ? formatInspectionDate(value) : String(value);
    }
  });

  details.sections = parseSectionTable(rows);

  if (!details.sections.length) {
    details.sections = parseLegacySectionDetails(rows);
  }

  return details;
}

function splitMediaList(value) {
  return String(value ?? '')
    .split(/\r?\n|;/)
    .map((item) => item.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function parseCriticalFlag(value) {
  return ['yes', 'y', 'true', '1', 'critical'].includes(normalize(value));
}

function parseSummarySheet(workbook) {
  const sheetName = findSheetName(workbook, 'Summary');
  const rows = readSheetRows(workbook, sheetName).filter((row) =>
    row.some((cell) => cell !== null && cell !== ''),
  );

  if (!rows.length) return [];

  const headerIndex = rows.findIndex((row) => {
    const labels = row.map(normalize);
    return labels.includes('section') && labels.includes('remarks');
  });
  const header = rows[Math.max(headerIndex, 0)] || [];
  const headerMap = getHeaderMap(header);

  return rows.slice(Math.max(headerIndex, 0) + 1).map((row, index) => {
    const section = String(row[headerMap.section] ?? '').trim();
    if (!section) return null;

    return {
      id: `summary-${index}`,
      section,
      sectionKey: compact(section),
      location: String(row[headerMap.location] ?? '').trim() || 'Observation',
      isCritical: parseCriticalFlag(row[headerMap['is critical']]),
      images: splitMediaList(row[headerMap.image]),
      videos: splitMediaList(row[headerMap.video]),
      remarks: String(row[headerMap.remarks] ?? '').trim(),
    };
  }).filter(Boolean);
}

function makeEmptySectionData(section) {
  return {
    ...section,
    tubeCount: section.tubeCount || 0,
    dataTubeCount: 0,
    declaredTubeCount: section.tubeCount,
    tubeDiameter: section.tubeDiameter,
    tubeNominal: section.tubeNominal,
    tubeLength: section.tubeLength,
    tubePitch: section.tubePitch,
    elevations: [],
    tubeNumbers: [],
    coilNumbers: [],
    coilData: {},
    observations: section.observations || [],
    values: new Float32Array(0),
    width: 0,
    height: 0,
    min: null,
    max: null,
  };
}

function getSheetShape(header) {
  const coilColumnIndex = header.findIndex((cell) => normalize(cell) === 'coil no');
  const tubeStartIndex = coilColumnIndex >= 0 ? coilColumnIndex + 1 : 1;
  const tubeNumbers = header.slice(tubeStartIndex).map(toNumber).filter((value) => value !== null);

  return {
    coilColumnIndex,
    tubeStartIndex,
    tubeNumbers,
  };
}

function finalizeValues(rowsForValues, tubeCount) {
  const flatValues = new Float32Array(tubeCount * rowsForValues.length);
  let min = Infinity;
  let max = -Infinity;

  rowsForValues.forEach((row, rowIndex) => {
    for (let tubeIndex = 0; tubeIndex < tubeCount; tubeIndex += 1) {
      const value = row[tubeIndex];
      flatValues[rowIndex * tubeCount + tubeIndex] = Number.isFinite(value) ? value : Number.NaN;

      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
  });

  return {
    values: flatValues,
    min: min === Infinity ? null : min,
    max: max === -Infinity ? null : max,
  };
}

function buildDataSet(section, tubeNumbers, rows, dataKey = 'all', coilNumber = null) {
  const dataTubeCount = tubeNumbers.length || rows[0]?.values?.length || 0;
  const elevations = rows.map((row) => row.elevation);
  const rowsForValues = rows.map((row) => row.values);
  const { values, min, max } = finalizeValues(rowsForValues, dataTubeCount);

  return {
    ...section,
    dataKey: `${section.id}:${dataKey}`,
    coilNumber,
    observations: section.observations || [],
    tubeCount: section.tubeCount || dataTubeCount,
    dataTubeCount,
    declaredTubeCount: section.tubeCount || dataTubeCount,
    tubeNumbers,
    elevations,
    values,
    width: section.tubeCount || dataTubeCount,
    height: elevations.length,
    min,
    max,
  };
}

function parseSectionSheet(workbook, section) {
  const sheetName = findSheetName(workbook, section.name) || findSheetName(workbook, section.id);
  const rows = readSheetRows(workbook, sheetName).filter((row) =>
    row.some((cell) => cell !== null && cell !== ''),
  );

  if (!rows.length) return makeEmptySectionData(section);

  const headerIndex = rows.findIndex((row) => {
    const labels = row.map(normalize);
    return labels.some((label) => label.includes('tube')) || row.slice(1).some((cell) => Number.isFinite(Number(cell)));
  });
  const header = rows[Math.max(headerIndex, 0)] || [];
  const { coilColumnIndex, tubeStartIndex, tubeNumbers } = getSheetShape(header);
  const dataRows = rows.slice(Math.max(headerIndex, 0) + 1);
  const parsedRows = [];
  const coilRows = new Map();

  dataRows.forEach((row) => {
    const elevation = toNumber(row[0]);
    if (elevation === null) return;

    const coilNumber = coilColumnIndex >= 0 ? toNumber(row[coilColumnIndex]) : null;
    const values = row.slice(tubeStartIndex, tubeStartIndex + tubeNumbers.length).map(toReadingNumber);
    const parsedRow = { elevation, coilNumber, values };

    parsedRows.push(parsedRow);

    if (coilNumber !== null) {
      if (!coilRows.has(coilNumber)) coilRows.set(coilNumber, []);
      coilRows.get(coilNumber).push(parsedRow);
    }
  });

  const baseData = buildDataSet(section, tubeNumbers, parsedRows);
  const coilData = Object.fromEntries(
    [...coilRows.entries()].map(([coilNumber, rowsForCoil]) => [
      String(coilNumber),
      buildDataSet(section, tubeNumbers, rowsForCoil, `coil-${coilNumber}`, coilNumber),
    ]),
  );
  const coilNumbers = Object.keys(coilData)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  return {
    ...baseData,
    sheetName,
    coilNumbers,
    coilData,
    hasCoils: coilNumbers.length > 0,
  };
}

function getSourceName(source) {
  if (source.name) return source.name;
  if (source.url) return source.url.split('/').pop();

  return 'Inspection.xlsx';
}

async function readSourceBuffer(source) {
  if (source.arrayBuffer) {
    return source.arrayBuffer();
  }

  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Unable to load ${source.name || source.url}`);
  }

  return response.arrayBuffer();
}

export function getSectionDataForCoil(sectionData, coilNumber) {
  if (!sectionData?.hasCoils || !coilNumber) return sectionData;
  return sectionData.coilData?.[String(coilNumber)] || sectionData;
}

export async function parseInspection(source) {
  const buffer = await readSourceBuffer(source);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const details = parseDetails(workbook);
  const observations = parseSummarySheet(workbook);
  const observationsBySection = new Map();
  observations.forEach((observation) => {
    if (!observationsBySection.has(observation.sectionKey)) {
      observationsBySection.set(observation.sectionKey, []);
    }
    observationsBySection.get(observation.sectionKey).push(observation);
  });
  const sections = details.sections.map((section) => ({
    ...section,
    observations: observationsBySection.get(compact(section.name)) || observationsBySection.get(compact(section.id)) || [],
  }));
  const sourceName = getSourceName(source);
  const sectionData = Object.fromEntries(
    sections.map((section) => [section.id, parseSectionSheet(workbook, section)]),
  );
  const availableSections = sections.filter((section) => sectionData[section.id]?.values?.length);

  return {
    id: source.id || `${sourceName}-${source.size || ''}-${Date.now()}`,
    fileName: sourceName,
    inspectionDate: details.inspectionDate,
    inspectionName: details.inspectionName || sourceName,
    sections,
    availableSections,
    observations,
    walls: Object.fromEntries(sections.map((section) => [section.id, section])),
    wallData: sectionData,
  };
}
