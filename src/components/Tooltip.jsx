import { Paper, Text } from '@mantine/core';
import { WALL_LABELS } from '../state/inspectionAtoms';
import { DISPLAY_MODES, formatMeasurement } from '../utils/measurements';

function Tooltip({ cell }) {
  if (!cell) return null;

  return (
    <Paper className="canvas-tooltip" shadow="md" p="xs" withBorder style={{ left: cell.screenX + 12, top: cell.screenY + 12 }}>
      <Text size="xs" fw={700}>
        Tube {cell.tube}
      </Text>
      <Text size="xs">Elevation {cell.elevation} mm</Text>
      <Text size="xs">Thickness {formatMeasurement(cell.thickness, 'thickness')}</Text>
      {cell.displayMode === 'wallLoss' && (
        <Text size="xs">
          {DISPLAY_MODES.wallLoss.label} {cell.displayLabel}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {cell.inspectionName} / {WALL_LABELS[cell.wall]}
      </Text>
    </Paper>
  );
}

export default Tooltip;
