export function getElevationBands(wallData, fallbackLength) {
  const elevations = wallData?.elevations || [];
  const tubeLength =
    wallData?.tubeLength || fallbackLength || Math.max(...elevations.filter(Number.isFinite), 1);

  return elevations.map((elevation, index) => {
    const previous = elevations[index - 1];
    const next = elevations[index + 1];
    const previousStep = Number.isFinite(previous) ? Math.abs(elevation - previous) : null;
    const nextStep = Number.isFinite(next) ? Math.abs(next - elevation) : null;
    const halfBefore = (previousStep ?? nextStep ?? tubeLength) / 2;
    const halfAfter = (nextStep ?? previousStep ?? tubeLength) / 2;
    const lower = elevation - halfBefore;
    const upper = elevation + halfAfter;

    return {
      lower: Math.max(0, Math.min(lower, tubeLength)),
      upper: Math.max(0, Math.min(upper, tubeLength)),
    };
  });
}
