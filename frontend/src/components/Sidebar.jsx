import {
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { useAtom } from "jotai";
import {
  inspectionsAtom,
  selectedCoilAtom,
  selectedInspectionAtom,
  selectedWallAtom,
  soundEnabledAtom,
} from "../state/inspectionAtoms";
import { playUiSound } from "../utils/sound";
import ColorLegend from "./ColorLegend";

function Sidebar() {
  const [inspections] = useAtom(inspectionsAtom);
  const [selectedInspection, setSelectedInspection] = useAtom(
    selectedInspectionAtom,
  );
  const [selectedWall, setSelectedWall] = useAtom(selectedWallAtom);
  const [, setSelectedCoil] = useAtom(selectedCoilAtom);
  const [soundEnabled, setSoundEnabled] = useAtom(soundEnabledAtom);
  const inspection = inspections.find((item) => item.id === selectedInspection);
  const availableSections = inspection?.availableSections || [];

  return (
    <Stack gap="md" h="100%">
      <div>
        <div className="brand-lockup">
          <img
            src="/irc logo.png"
            alt="IRC Engineering logo"
            className="brand-logo"
          />
          <div>
            <Title order={3}>IRC Engineering</Title>
            <Text size="xs" c="dimmed">
              Kiln Intelligence
            </Text>
          </div>
        </div>
        <Text size="xs" c="dimmed">
          Rotary kiln thickness intelligence
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
            playUiSound("select", enabled);
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
                  playUiSound("select", soundEnabled);
                  setSelectedInspection(inspection.id);
                  setSelectedWall(
                    inspection.availableSections?.[0]?.id ||
                      inspection.sections?.[0]?.id ||
                      "FrontWall",
                  );
                  setSelectedCoil(null);
                }}
              />
            ))
          )}

          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="md">
            Components
          </Text>
          {availableSections.length === 0 ? (
            <Text size="sm" c="dimmed">
              No component sheets found in this workbook.
            </Text>
          ) : (
            availableSections.map((section) => (
              <NavLink
                key={section.id}
                label={section.name}
                description={section.layout}
                active={selectedWall === section.id}
                onClick={() => {
                  playUiSound("select", soundEnabled);
                  setSelectedWall(section.id);
                  setSelectedCoil(null);
                }}
              />
            ))
          )}
        </Stack>
      </ScrollArea>

      <ColorLegend />
    </Stack>
  );
}

export default Sidebar;
