import { Stack, Text } from '@mantine/core';

function LegendRow({ color, label }) {
  return (
    <div className="legend-row">
      <span className="legend-swatch" style={{ background: color }} />
      <Text size="xs">{label}</Text>
    </div>
  );
}

function ColorLegend() {
  return (
    <Stack gap="xs" className="sidebar-legend">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        Wall Loss Legend
      </Text>
      <LegendRow color="rgb(0, 255, 0)" label="< 10%" />
      <LegendRow color="rgb(255, 255, 0)" label="10% - 20%" />
      <LegendRow color="rgb(204, 102, 0)" label="> 20%" />
      <LegendRow color="rgba(188, 194, 202, 0.55)" label="Outside focus" />
    </Stack>
  );
}

export default ColorLegend;
