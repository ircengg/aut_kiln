import { Group, NavLink, ScrollArea, Stack, Switch, Text, Title } from '@mantine/core';
import { useAtom } from 'jotai';
import {
  inspectionsAtom,
  selectedInspectionAtom,
  selectedWallAtom,
  soundEnabledAtom,
  WALL_LABELS,
  WALLS,
} from '../state/inspectionAtoms';
import { playUiSound } from '../utils/sound';
import ColorLegend from './ColorLegend';

function Sidebar() {
  const [inspections] = useAtom(inspectionsAtom);
  const [selectedInspection, setSelectedInspection] = useAtom(selectedInspectionAtom);
  const [selectedWall, setSelectedWall] = useAtom(selectedWallAtom);
  const [soundEnabled, setSoundEnabled] = useAtom(soundEnabledAtom);

  return (
    <Stack gap="md" h="100%">
      <div>
        <div className="brand-lockup">
          <img src="/irc logo.png" alt="IRC Engineering logo" className="brand-logo" />
          <div>
            <Title order={3}>IRC Engineering</Title>
            <Text size="xs" c="dimmed">
              AUT Command
            </Text>
          </div>
        </div>
        <Text size="xs" c="dimmed">
          Boiler wall intelligence
        </Text>
      </div>

      <Group justify="space-between" className="sound-toggle">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">
          Sound
        </Text>
        <Switch
          size="xs"
          checked={soundEnabled}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            setSoundEnabled(enabled);
            playUiSound('select', enabled);
          }}
        />
      </Group>

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
                onClick={() => {
                  playUiSound('select', soundEnabled);
                  setSelectedInspection(inspection.id);
                }}
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
              onClick={() => {
                playUiSound('select', soundEnabled);
                setSelectedWall(wall);
              }}
            />
          ))}
        </Stack>
      </ScrollArea>

      <ColorLegend />
    </Stack>
  );
}

export default Sidebar;
