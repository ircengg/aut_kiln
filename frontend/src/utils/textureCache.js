import { Texture } from 'pixi.js';
import { getElevationBands } from './elevationBands';
import { getThicknessRgba, getWallLossRgba } from './heatmap';
import { isSpotInspection } from './inspectionType';
import { isHorizontalLayout } from './layout';
import { getDisplayValue } from './measurements';

const textureCache = new Map();
const SLOT_PIXELS = 10;
const MAX_TEXTURE_HEIGHT = 8192;
const MUTED_COLOR = [188, 194, 202, 140];
const SPOT_TUBE_COLOR = [132, 143, 148, 190];

function getScaleRange(wallData, mode, displayRange) {
  if (Number.isFinite(displayRange?.min) && Number.isFinite(displayRange?.max)) {
    return displayRange;
  }

  if (mode === 'wallLoss') {
    return { min: 0, max: 100 };
  }

  return { min: wallData.min, max: wallData.max };
}

function getTextureHeight(wallData) {
  const elevations = wallData.elevations || [];
  const tubeLength = wallData.tubeLength || Math.max(...elevations, 1);
  let minStep = Infinity;

  for (let index = 1; index < elevations.length; index += 1) {
    const step = Math.abs(elevations[index] - elevations[index - 1]);
    if (step > 0) minStep = Math.min(minStep, step);
  }

  if (!Number.isFinite(minStep)) return Math.max(elevations.length, 1);

  return Math.min(
    MAX_TEXTURE_HEIGHT,
    Math.max(elevations.length, Math.ceil(tubeLength / minStep)),
  );
}

function buildCanvasTexture(wallData, focusRange, mode, displayRange) {
  const tubeCount = Math.max(wallData.tubeCount || wallData.dataTubeCount || 1, 1);
  const dataTubeCount = Math.max(wallData.dataTubeCount || wallData.tubeNumbers?.length || tubeCount, 1);
  const tubeNumbers = wallData.tubeNumbers?.length
    ? wallData.tubeNumbers
    : Array.from({ length: dataTubeCount }, (_, index) => index + 1);
  const pitch = wallData.tubePitch || wallData.tubeDiameter || 1;
  const isHorizontal = isHorizontalLayout(wallData.layout);
  const diameter = Math.min(wallData.tubeDiameter || pitch * 0.72, pitch * 0.92);
  const tubePixels = Math.max(1, Math.round((diameter / pitch) * SLOT_PIXELS));
  const tubeOffset = isHorizontal ? 0 : Math.max(0, Math.floor((SLOT_PIXELS - tubePixels) / 2));
  const lengthPixels = getTextureHeight(wallData);
  const tubeSpanPixels = isHorizontal
    ? Math.max((tubeCount - 1) * SLOT_PIXELS + tubePixels, tubePixels)
    : tubeCount * SLOT_PIXELS;
  const width = isHorizontal ? lengthPixels : tubeSpanPixels;
  const height = isHorizontal ? tubeSpanPixels : lengthPixels;
  const tubeLength = wallData.tubeLength || Math.max(...(wallData.elevations || [1]), 1);
  const elevationBands = getElevationBands(wallData);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: false });

  if (!context) {
    throw new Error('Unable to create a 2D canvas context for the wall texture.');
  }

  const imageData = new ImageData(width, height);
  const scaleRange = getScaleRange(wallData, mode, displayRange);

  if (isSpotInspection(wallData)) {
    for (let tubeIndex = 0; tubeIndex < tubeCount; tubeIndex += 1) {
      for (let tubePixel = 0; tubePixel < tubePixels; tubePixel += 1) {
        const tubeSlotPixel = tubeIndex * SLOT_PIXELS + tubeOffset + tubePixel;

        for (let lengthPixel = 0; lengthPixel < lengthPixels; lengthPixel += 1) {
          const x = isHorizontal ? lengthPixel : tubeSlotPixel;
          const y = isHorizontal ? tubeSlotPixel : height - 1 - lengthPixel;
          const offset = (y * width + x) * 4;
          imageData.data[offset] = SPOT_TUBE_COLOR[0];
          imageData.data[offset + 1] = SPOT_TUBE_COLOR[1];
          imageData.data[offset + 2] = SPOT_TUBE_COLOR[2];
          imageData.data[offset + 3] = SPOT_TUBE_COLOR[3];
        }
      }
    }

    context.putImageData(imageData, 0, 0);

    const texture = Texture.from(canvas);
    texture.source.scaleMode = 'nearest';

    return texture;
  }

  for (let rowIndex = 0; rowIndex < elevationBands.length; rowIndex += 1) {
    const band = elevationBands[rowIndex];
    const lengthStart = Math.max(0, Math.floor((band.lower / tubeLength) * lengthPixels));
    const lengthEnd = Math.min(
      lengthPixels,
      Math.max(lengthStart + 1, Math.ceil((band.upper / tubeLength) * lengthPixels)),
    );

    for (let dataTubeIndex = 0; dataTubeIndex < dataTubeCount; dataTubeIndex += 1) {
      const tubeNumber = tubeNumbers[dataTubeIndex];
      const tubeIndex = Number.isFinite(tubeNumber) ? tubeNumber - 1 : dataTubeIndex;

      if (tubeIndex < 0 || tubeIndex >= tubeCount) continue;

      const value = getDisplayValue(
        wallData.values[rowIndex * dataTubeCount + dataTubeIndex],
        mode,
        wallData.tubeNominal,
      );
      const isInFocus =
        Number.isFinite(value) &&
        value >= (focusRange?.min ?? scaleRange.min) &&
        value <= (focusRange?.max ?? scaleRange.max);
      const [red, green, blue, alpha] = isInFocus
        ? mode === 'wallLoss'
          ? getWallLossRgba(value)
          : getThicknessRgba(value, scaleRange.min, scaleRange.max)
        : MUTED_COLOR;

      for (let tubePixel = 0; tubePixel < tubePixels; tubePixel += 1) {
        const tubeSlotPixel = tubeIndex * SLOT_PIXELS + tubeOffset + tubePixel;

        for (let lengthPixel = lengthStart; lengthPixel < lengthEnd; lengthPixel += 1) {
          const x = isHorizontal ? lengthPixel : tubeSlotPixel;
          const y = isHorizontal ? tubeSlotPixel : height - 1 - lengthPixel;
          const offset = (y * width + x) * 4;
          imageData.data[offset] = red;
          imageData.data[offset + 1] = green;
          imageData.data[offset + 2] = blue;
          imageData.data[offset + 3] = alpha;
        }
      }
    }
  }

  context.putImageData(imageData, 0, 0);

  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';

  return texture;
}

export function getWallTexture(inspectionId, wallName, wallData, focusRange, mode, displayRange) {
  const min = focusRange?.min;
  const max = focusRange?.max;
  const key = `${inspectionId}:${wallName}:${wallData?.dataKey || 'all'}:${wallData?.layout || 'vertical'}:${wallData?.inspectionType || 'Mapping'}:${wallData?.tubeCount}:${wallData?.tubeLength}:${mode}:${displayRange?.min}:${displayRange?.max}:${min}:${max}`;
  const cached = textureCache.get(key);

  if (cached) return cached;

  const texture = buildCanvasTexture(wallData, focusRange, mode, displayRange);
  textureCache.set(key, texture);

  return texture;
}

export function clearTextureCache() {
  textureCache.forEach((texture) => texture.destroy(true));
  textureCache.clear();
}
