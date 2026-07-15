import { NavLink, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { useAtom } from 'jotai';
import {
  inspectionsAtom,
  selectedInspectionAtom,
  selectedWallAtom,
  WALL_LABELS,
  WALLS,
} from '../state/inspectionAtoms';
import ColorLegend from './ColorLegend';

function Sidebar() {
  const [inspections] = useAtom(inspectionsAtom);
  const [selectedInspection, setSelectedInspection] = useAtom(selectedInspectionAtom);
  const [selectedWall, setSelectedWall] = useAtom(selectedWallAtom);

  return (
    <Stack gap="md" h="100%">
      <div>
        <Title order={3}>AUT Viewer</Title>
        <Text size="xs" c="dimmed">
          Loaded from project data folder
        </Text>
      </div>

      <ScrollArea flex={1} offsetScrollbars>
        <Stack gap="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Inspections
          </Text>
          {inspections.length === 0 ? (
            <Text size="sm" c="dimmed">
              Loading Excel inspections from data folder.
            </Text>
          ) : (
            inspections.map((inspection) => (
              <NavLink
                key={inspection.id}
                label={inspection.inspectionName}
                description={inspection.inspectionDate || inspection.fileName}
                active={selectedInspection === inspection.id}
                onClick={() => setSelectedInspection(inspection.id)}
              />
            ))
          )}

          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="md">
            Walls
          </Text>
          {WALLS.map((wall) => (
            <NavLink
              key={wall}
              label={WALL_LABELS[wall]}
              active={selectedWall === wall}
              onClick={() => setSelectedWall(wall)}
            />
          ))}
        </Stack>
      </ScrollArea>

      <ColorLegend />
    </Stack>
  );
}

export default Sidebar;
