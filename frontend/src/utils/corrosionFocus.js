import { getElevationBands } from './elevationBands';
import { isSpotInspection } from './inspectionType';
import { getDisplayValue } from './measurements';

const HIGH_WALL_LOSS_LIMIT = 20;

function makeCellKey(rowIndex, dataTubeIndex) {
  return `${rowIndex}:${dataTubeIndex}`;
}

function getHighWallLossCells(wallData) {
  const dataTubeCount = wallData?.dataTubeCount || wallData?.tubeNumbers?.length || wallData?.tubeCount || 0;
  const tubeNumbers = wallData?.tubeNumbers?.length
    ? wallData.tubeNumbers
    : Array.from({ length: dataTubeCount }, (_, index) => index + 1);
  const cells = [];

  if (!dataTubeCount || !wallData?.values?.length) return cells;

  for (let rowIndex = 0; rowIndex < wallData.elevations.length; rowIndex += 1) {
    for (let dataTubeIndex = 0; dataTubeIndex < dataTubeCount; dataTubeIndex += 1) {
      const thickness = wallData.values[rowIndex * dataTubeCount + dataTubeIndex];
      const wallLoss = getDisplayValue(thickness, 'wallLoss', wallData.tubeNominal);

      if (Number.isFinite(wallLoss) && wallLoss > HIGH_WALL_LOSS_LIMIT) {
        const sourceAxial = tubeNumbers[dataTubeIndex] ?? dataTubeIndex + 1;
        const localAxial = wallData.axialCoordinatesAbsolute
          ? sourceAxial - (wallData.axialStart || 0)
          : sourceAxial;
        const fraction = Math.min(1, Math.max(0, localAxial / Math.max(wallData.axialLength || 1, 1)));
        const radius = (wallData.radiusStart || 1) +
          ((wallData.radiusEnd || wallData.radiusStart || 1) - (wallData.radiusStart || 1)) * fraction;
        cells.push({
          rowIndex,
          dataTubeIndex,
          tube: sourceAxial,
          elevation: wallData.elevations[rowIndex],
          thickness,
          wallLoss,
          assetType: wallData.assetType,
          radius: wallData.radiusStart || 1,
          angleDegrees: THREE_RAD_TO_DEG * wallData.elevations[rowIndex] / radius,
        });
      }
    }
  }

  return cells;
}

function summarizeArea(cells, bands, index) {
  let minTube = Infinity;
  let maxTube = -Infinity;
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  let minLower = Infinity;
  let maxUpper = -Infinity;
  let minThickness = Infinity;
  let maxWallLoss = -Infinity;
  let totalWallLoss = 0;

  cells.forEach((cell) => {
    const band = bands[cell.rowIndex] || { lower: cell.elevation, upper: cell.elevation };
    minTube = Math.min(minTube, cell.tube);
    maxTube = Math.max(maxTube, cell.tube);
    minElevation = Math.min(minElevation, cell.elevation);
    maxElevation = Math.max(maxElevation, cell.elevation);
    minLower = Math.min(minLower, band.lower);
    maxUpper = Math.max(maxUpper, band.upper);
    minThickness = Math.min(minThickness, cell.thickness);
    maxWallLoss = Math.max(maxWallLoss, cell.wallLoss);
    totalWallLoss += cell.wallLoss;
  });

  const area = {
    id: `corrosion-${index}`,
    kind: cells.length === 1 && cells[0].kind === 'spot' ? 'spot' : 'area',
    cells,
    count: cells.length,
    minTube,
    maxTube,
    minElevation,
    maxElevation,
    minLower,
    maxUpper,
    minThickness,
    maxWallLoss,
    averageWallLoss: totalWallLoss / Math.max(cells.length, 1),
    centerTube: (minTube + maxTube) / 2,
    centerElevation: (minLower + maxUpper) / 2,
  };

  if (cells[0]?.assetType === 'kiln') {
    area.minAxial = minTube;
    area.maxAxial = maxTube;
    area.centerAxial = (minTube + maxTube) / 2;
    area.minCircumference = minElevation;
    area.maxCircumference = maxElevation;
    area.centerCircumference = (minLower + maxUpper) / 2;
    area.minAngleDegrees = Math.min(...cells.map((cell) => cell.angleDegrees));
    area.maxAngleDegrees = Math.max(...cells.map((cell) => cell.angleDegrees));
  }

  return area;
}

const THREE_RAD_TO_DEG = 180 / Math.PI;

export function getCorrodedAreas(wallData) {
  const highCells = getHighWallLossCells(wallData);
  const bands = getElevationBands(wallData);

  if (isSpotInspection(wallData)) {
    return highCells
      .map((cell, index) => summarizeArea([{ ...cell, kind: 'spot' }], bands, index))
      .sort((a, b) => b.maxWallLoss - a.maxWallLoss || a.minTube - b.minTube);
  }

  const cellMap = new Map(highCells.map((cell) => [makeCellKey(cell.rowIndex, cell.dataTubeIndex), cell]));
  const visited = new Set();
  const areas = [];

  highCells.forEach((startCell) => {
    const startKey = makeCellKey(startCell.rowIndex, startCell.dataTubeIndex);
    if (visited.has(startKey)) return;

    const queue = [startCell];
    const group = [];
    visited.add(startKey);

    while (queue.length) {
      const cell = queue.shift();
      group.push(cell);

      [
        [cell.rowIndex - 1, cell.dataTubeIndex],
        [cell.rowIndex + 1, cell.dataTubeIndex],
        [cell.rowIndex, cell.dataTubeIndex - 1],
        [cell.rowIndex, cell.dataTubeIndex + 1],
      ].forEach(([rowIndex, dataTubeIndex]) => {
        const key = makeCellKey(rowIndex, dataTubeIndex);
        const next = cellMap.get(key);

        if (next && !visited.has(key)) {
          visited.add(key);
          queue.push(next);
        }
      });
    }

    areas.push(summarizeArea(group, bands, areas.length));
  });

  return areas.sort((a, b) => b.maxWallLoss - a.maxWallLoss || b.count - a.count);
}
