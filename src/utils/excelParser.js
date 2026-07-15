import * as XLSX from 'xlsx';
import { WALLS } from '../state/inspectionAtoms';

const DETAIL_KEYS = {
  'inspection details': 'inspectionName',
  'inspection name': 'inspectionName',
  'inspection date': 'inspectionDate',
};

const WALL_PREFIXES = {
  FrontWall: ['front wall', 'frontwall'],
  RearWall: ['rear wall', 'rearwall'],
  LeftSideWall: ['left side wall', 'leftsidewall', 'left wall'],
  RightSideWall: ['right side wall', 'rightsidewall', 'right wall'],
};

const WALL_FIELDS = {
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

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const readSheetRows = (workbook, sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
};

const findSheetName = (workbook, targetName) => {
  const normalizedTarget = normalize(targetName).replace(/\s/g, '');
  return workbook.SheetNames.find((name) => normalize(name).replace(/\s/g, '') === normalizedTarget);
};

function parseDetails(workbook) {
  const sheetName = findSheetName(workbook, 'Details');
  const rows = readSheetRows(workbook, sheetName);
  const details = {
    inspectionName: 'Inspection',
    inspectionDate: '',
    walls: Object.fromEntries(WALLS.map((wall) => [wall, {}])),
  };

  rows.forEach((row) => {
    const key = normalize(row[0]);
    const value = row.find((cell, index) => index > 0 && cell !== null && cell !== '');
    if (!key || value === undefined) return;

    if (DETAIL_KEYS[key]) {
      details[DETAIL_KEYS[key]] = String(value);
      return;
    }

    WALLS.forEach((wall) => {
      const prefix = WALL_PREFIXES[wall].find((candidate) => key.startsWith(candidate));
      if (!prefix) return;

      Object.entries(WALL_FIELDS).forEach(([label, field]) => {
        if (key.includes(label) || (field === 'tubeNominal' && key.includes('nominal'))) {
          details.walls[wall][field] = toNumber(value);
        }
      });
    });
  });

  return details;
}

function parseWallSheet(workbook, wall) {
  const sheetName = findSheetName(workbook, wall);
  const rows = readSheetRows(workbook, sheetName).filter((row) =>
    row.some((cell) => cell !== null && cell !== ''),
  );

  if (!rows.length) {
    return {
      tubeCount: 0,
      dataTubeCount: 0,
      declaredTubeCount: null,
      tubeLength: null,
      tubePitch: null,
      tubeDiameter: null,
      tubeNominal: null,
      elevations: [],
      tubeNumbers: [],
      values: new Float32Array(0),
      width: 0,
      height: 0,
      min: null,
      max: null,
    };
  }

  const headerIndex = rows.findIndex((row) => row.slice(1).some((cell) => Number.isFinite(Number(cell))));
  const header = rows[Math.max(headerIndex, 0)] || [];
  const tubeNumbers = header.slice(1).map(toNumber).filter((value) => value !== null);
  const dataRows = rows.slice(Math.max(headerIndex, 0) + 1);
  const elevations = [];
  const rowsForValues = [];
  let min = Infinity;
  let max = -Infinity;

  dataRows.forEach((row) => {
    const elevation = toNumber(row[0]);
    if (elevation === null) return;

    const values = row.slice(1, tubeNumbers.length + 1).map(toNumber);
    elevations.push(elevation);
    rowsForValues.push(values);
    values.forEach((value) => {
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    });
  });

  const tubeCount = tubeNumbers.length || rowsForValues[0]?.length || 0;
  const flatValues = new Float32Array(tubeCount * elevations.length);

  rowsForValues.forEach((row, rowIndex) => {
    for (let tubeIndex = 0; tubeIndex < tubeCount; tubeIndex += 1) {
      const value = row[tubeIndex];
      flatValues[rowIndex * tubeCount + tubeIndex] = Number.isFinite(value) ? value : Number.NaN;
    }
  });

  return {
    tubeCount,
    dataTubeCount: tubeCount,
    declaredTubeCount: null,
    tubeLength: null,
    tubePitch: null,
    tubeDiameter: null,
    tubeNominal: null,
    elevations,
    tubeNumbers,
    values: flatValues,
    width: tubeCount,
    height: elevations.length,
    min: min === Infinity ? null : min,
    max: max === -Infinity ? null : max,
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

export async function parseInspection(source) {
  const buffer = await readSourceBuffer(source);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const details = parseDetails(workbook);
  const sourceName = getSourceName(source);
  const wallData = Object.fromEntries(
    WALLS.map((wall) => {
      const parsedWall = parseWallSheet(workbook, wall);
      const wallDetails = details.walls[wall] || {};

      return [
        wall,
        {
          ...parsedWall,
          tubeCount: wallDetails.tubeCount || parsedWall.tubeCount,
          dataTubeCount: parsedWall.dataTubeCount || parsedWall.tubeCount || wallDetails.tubeCount,
          declaredTubeCount: wallDetails.tubeCount || parsedWall.tubeCount,
          tubeLength: wallDetails.tubeLength,
          tubePitch: wallDetails.tubePitch,
          tubeDiameter: wallDetails.tubeDiameter,
          tubeNominal: wallDetails.tubeNominal,
        },
      ];
    }),
  );

  return {
    id: source.id || `${sourceName}-${source.size || ''}-${Date.now()}`,
    fileName: sourceName,
    inspectionDate: details.inspectionDate,
    inspectionName: details.inspectionName || sourceName,
    walls: details.walls,
    wallData,
  };
}
