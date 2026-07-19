import { isHorizontalLayout } from './layout';

export function getWallBounds(wallConfig, wallData) {
  const tubeCount = wallData?.tubeCount || wallConfig?.tubeCount || 1;
  const pitch =
    wallData?.tubePitch || wallConfig?.tubePitch || wallData?.tubeDiameter || wallConfig?.tubeDiameter || 1;
  const diameter = Math.min(
    wallData?.tubeDiameter || wallConfig?.tubeDiameter || pitch * 0.72,
    pitch * 0.92,
  );
  const length =
    wallData?.tubeLength || wallConfig?.tubeLength || Math.max(...(wallData?.elevations || [1]), 1);
  const tubeLength = Math.max(length, 1);

  if (isHorizontalLayout(wallData?.layout || wallConfig?.layout)) {
    const tubeSpan = Math.max((tubeCount - 1) * pitch + diameter, diameter);

    return {
      width: tubeLength,
      height: tubeSpan,
    };
  }

  return {
    width: Math.max(tubeCount * pitch, pitch),
    height: tubeLength,
  };
}

export function fitViewToSize(bounds, size, padding = 28) {
  const width = Math.max(size.width - padding * 2, 1);
  const height = Math.max(size.height - padding * 2, 1);
  const scale = Math.min(width / bounds.width, height / bounds.height);
  const zoom = Number.isFinite(scale) && scale > 0 ? scale : 1;

  return {
    zoom,
    pan: {
      x: (size.width - bounds.width * zoom) / 2,
      y: (size.height - bounds.height * zoom) / 2,
    },
  };
}
