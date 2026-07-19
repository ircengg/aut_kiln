export const DISPLAY_MODES = {
  thickness: {
    label: 'Thickness',
    unit: 'mm',
  },
  wallLoss: {
    label: 'Wall Loss',
    unit: '%',
  },
};

export function getDisplayValue(thickness, mode, nominal) {
  if (!Number.isFinite(thickness)) return Number.NaN;
  if (mode !== 'wallLoss') return thickness;
  if (!Number.isFinite(nominal) || nominal <= 0) return Number.NaN;

  return ((nominal - thickness) / nominal) * 100;
}

export function getDisplayRange(wallData, mode) {
  if (!wallData?.values?.length) return { min: null, max: null };
  if (mode === 'thickness') return { min: wallData.min, max: wallData.max };

  let min = Infinity;
  let max = -Infinity;

  wallData.values.forEach((thickness) => {
    const value = getDisplayValue(thickness, mode, wallData.tubeNominal);

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

export function formatMeasurement(value, mode) {
  if (!Number.isFinite(value)) return 'ND';

  return `${value.toFixed(2)} ${DISPLAY_MODES[mode]?.unit || ''}`.trim();
}
