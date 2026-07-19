const STOPS = [
  { at: 0, color: [211, 47, 47] },
  { at: 0.28, color: [245, 124, 0] },
  { at: 0.52, color: [253, 216, 53] },
  { at: 0.74, color: [67, 160, 71] },
  { at: 1, color: [25, 118, 210] },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const mix = (a, b, t) => Math.round(a + (b - a) * t);

export function getThicknessColor(value, min, max) {
  const color = getThicknessRgba(value, min, max);

  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

export function getThicknessRgba(value, min, max) {
  if (!Number.isFinite(value)) return [215, 220, 226, 255];
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [76, 175, 80, 255];

  const ratio = clamp((value - min) / (max - min), 0, 1);
  const nextIndex = STOPS.findIndex((stop) => ratio <= stop.at);
  const right = STOPS[Math.max(1, nextIndex)];
  const left = STOPS[STOPS.indexOf(right) - 1];
  const localRatio = (ratio - left.at) / (right.at - left.at || 1);
  const color = left.color.map((part, index) => mix(part, right.color[index], localRatio));

  return [color[0], color[1], color[2], 255];
}

export function getThicknessRange(values) {
  let min = Infinity;
  let max = -Infinity;

  values.forEach((value) => {
    if (Number.isFinite(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  });

  return {
    min: min === Infinity ? null : min,
    max: max === -Infinity ? null : max,
  };
}
