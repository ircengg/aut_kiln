import { Button, Group, Paper, Select, Stack, Text, Title } from '@mantine/core';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  appViewAtom,
  inspectionsAtom,
  selectedInspectionAtom,
  selectedWallAtom,
  soundEnabledAtom,
  WALL_LABELS,
  WALLS,
} from '../state/inspectionAtoms';
import { playUiSound } from '../utils/sound';

function BoilerNavigator() {
  const inspections = useAtomValue(inspectionsAtom);
  const [selectedInspection, setSelectedInspection] = useAtom(selectedInspectionAtom);
  const [selectedWall, setSelectedWall] = useAtom(selectedWallAtom);
  const setView = useSetAtom(appViewAtom);
  const soundEnabled = useAtomValue(soundEnabledAtom);
  const inspectionOptions = inspections.map((inspection) => ({
    value: inspection.id,
    label: `${inspection.inspectionName}${inspection.inspectionDate ? ` · ${inspection.inspectionDate}` : ''}`,
  }));

  const selectWall = (wall) => {
    playUiSound('open', soundEnabled);
    setSelectedWall(wall);
    setView('viewer');
  };

  return (
    <section className="boiler-nav-stage scene-enter scene-enter-rotate">
      <div className="smoke-field" aria-hidden="true">
        <span className="smoke smoke-one" />
        <span className="smoke smoke-two" />
        <span className="smoke smoke-three" />
        <span className="smoke smoke-four" />
      </div>
      <div className="boiler-nav-header">
        <div>
          <Text size="xs" fw={700} tt="uppercase" className="signal-text">
            Boiler Navigation
          </Text>
          <Title order={1}>Choose the inspection wall.</Title>
        </div>
        <Button variant="light" onClick={() => setView('welcome')}>
          Back Home
        </Button>
      </div>

      <div className="boiler-console">
        <Paper className="boiler-map-panel" withBorder>
          <div className="boiler-map">
            <div className="chimney-stack" aria-hidden="true">
              <span className="chimney-smoke chimney-smoke-one" />
              <span className="chimney-smoke chimney-smoke-two" />
              <span className="chimney-smoke chimney-smoke-three" />
            </div>
            <div className="heat-haze" aria-hidden="true" />
            <div className="ember-field" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            {WALLS.map((wall) => (
              <button
                type="button"
                key={wall}
                className={`boiler-wall boiler-wall-${wall} ${selectedWall === wall ? 'is-active' : ''}`}
                onClick={() => selectWall(wall)}
              >
                <span>{WALL_LABELS[wall]}</span>
              </button>
            ))}
            <div className="boiler-map-core">
              <div className="core-ring" />
              <div className="core-pulse" />
              <Text size="xs" fw={700}>
                Boiler
              </Text>
            </div>
          </div>
        </Paper>

        <Stack gap="md" className="boiler-side-panel">
          <Paper p="md" withBorder className="control-panel">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Inspection
            </Text>
            <Select
              mt="xs"
              data={inspectionOptions}
              value={selectedInspection}
              onChange={(value) => {
                playUiSound('click', soundEnabled);
                setSelectedInspection(value);
              }}
              allowDeselect={false}
            />
          </Paper>

          <Group grow>
            <Button variant="subtle" onClick={() => setView('welcome')}>
              Back
            </Button>
            <Text size="xs" c="dimmed">
              Click a boiler wall to launch the heatmap.
            </Text>
          </Group>
        </Stack>
      </div>
    </section>
  );
}

export default BoilerNavigator;
