import { Paper, Text } from '@mantine/core';
import { DISPLAY_MODES, formatMeasurement } from '../utils/measurements';

function Tooltip({ cell }) {
  if (!cell) return null;

  return (
    <Paper className="canvas-tooltip" shadow="md" p="xs" withBorder style={{ left: cell.screenX + 8, top: cell.screenY + 8 }}>
      <Text size="xs" fw={700}>
        {cell.section ? `Section ${cell.section}` : `Tube ${cell.tube}`}
      </Text>
      {cell.coil && <Text size="xs">Coil {cell.coil}</Text>}
      <Text size="xs">
        {cell.lengthLabel || 'Elevation'} {cell.elevation} mm
      </Text>
      {Number.isFinite(cell.axial) && <Text size="xs">Axial {cell.axial} mm</Text>}
      {Number.isFinite(cell.angle) && <Text size="xs">Angle {(cell.angle * 180 / Math.PI).toFixed(1)}°</Text>}
      <Text size="xs">Thickness {formatMeasurement(cell.thickness, 'thickness')}</Text>
      {cell.displayMode === 'wallLoss' && (
        <Text size="xs">
          {DISPLAY_MODES.wallLoss.label} {cell.displayLabel}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {cell.inspectionName} / {cell.sectionName || cell.wall}
      </Text>
    </Paper>
  );
}

export default Tooltip;
