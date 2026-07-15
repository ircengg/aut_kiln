import { Texture } from 'pixi.js';
import { getThicknessRgba } from './heatmap';
import { getDisplayValue } from './measurements';

const textureCache = new Map();
const SLOT_PIXELS = 10;
const MUTED_COLOR = [188, 194, 202, 140];
const WALL_LOSS_COLORS = {
  low: [0, 255, 0, 255],
  medium: [255, 255, 0, 255],
  high: [204, 102, 0, 255],
};

function getWallLossColor(value) {
  if (value < 10) return WALL_LOSS_COLORS.low;
  if (value <= 20) return WALL_LOSS_COLORS.medium;

  return WALL_LOSS_COLORS.high;
}

function getScaleRange(wallData, mode, displayRange) {
  if (Number.isFinite(displayRange?.min) && Number.isFinite(displayRange?.max)) {
    return displayRange;
  }

  if (mode === 'wallLoss') {
    return { min: 0, max: 100 };
  }

  return { min: wallData.min, max: wallData.max };
}

function buildCanvasTexture(wallData, focusRange, mode, displayRange) {
  const tubeCount = Math.max(wallData.tubeCount || 1, 1);
  const pitch = wallData.tubePitch || wallData.tubeDiameter || 1;
  const diameter = Math.min(wallData.tubeDiameter || pitch * 0.72, pitch * 0.92);
  const tubePixels = Math.max(1, Math.round((diameter / pitch) * SLOT_PIXELS));
  const tubeOffset = Math.max(0, Math.floor((SLOT_PIXELS - tubePixels) / 2));
  const width = tubeCount * SLOT_PIXELS;
  const height = Math.max(wallData.height || wallData.elevations?.length || 1, 1);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: false });

  if (!context) {
    throw new Error('Unable to create a 2D canvas context for the wall texture.');
  }

  const imageData = new ImageData(width, height);
  const scaleRange = getScaleRange(wallData, mode, displayRange);

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    for (let tubeIndex = 0; tubeIndex < tubeCount; tubeIndex += 1) {
      const value = getDisplayValue(
        wallData.values[rowIndex * tubeCount + tubeIndex],
        mode,
        wallData.tubeNominal,
      );
      const isInFocus =
        Number.isFinite(value) &&
        value >= (focusRange?.min ?? scaleRange.min) &&
        value <= (focusRange?.max ?? scaleRange.max);
      const [red, green, blue, alpha] = isInFocus
        ? mode === 'wallLoss'
          ? getWallLossColor(value)
          : getThicknessRgba(value, scaleRange.min, scaleRange.max)
        : MUTED_COLOR;
      const textureRow = height - 1 - rowIndex;

      for (let tubePixel = 0; tubePixel < tubePixels; tubePixel += 1) {
        const x = tubeIndex * SLOT_PIXELS + tubeOffset + tubePixel;
        const offset = (textureRow * width + x) * 4;
        imageData.data[offset] = red;
        imageData.data[offset + 1] = green;
        imageData.data[offset + 2] = blue;
        imageData.data[offset + 3] = alpha;
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
  const key = `${inspectionId}:${wallName}:${mode}:${displayRange?.min}:${displayRange?.max}:${min}:${max}`;
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
