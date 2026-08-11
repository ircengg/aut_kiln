import { Button, Group, Paper, Select, Stack, Text, Title } from '@mantine/core';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  appViewAtom,
  inspectionsAtom,
  selectedCoilAtom,
  selectedInspectionAtom,
  selectedWallAtom,
  soundEnabledAtom,
} from '../state/inspectionAtoms';
import { playUiSound } from '../utils/sound';

function getWallClass(sectionName) {
  const name = sectionName.toLowerCase();
  if (name === 'front wall') return 'boiler-wall-FrontWall';
  if (name === 'rear wall') return 'boiler-wall-RearWall';
  if (name === 'left wall') return 'boiler-wall-LeftSideWall';
  if (name === 'right wall') return 'boiler-wall-RightSideWall';
  return '';
}

function KilnNavigator() {
  const inspections = useAtomValue(inspectionsAtom);
  const [selectedInspection, setSelectedInspection] = useAtom(selectedInspectionAtom);
  const [selectedWall, setSelectedWall] = useAtom(selectedWallAtom);
  const setSelectedCoil = useSetAtom(selectedCoilAtom);
  const setView = useSetAtom(appViewAtom);
  const soundEnabled = useAtomValue(soundEnabledAtom);
  const inspection = inspections.find((item) => item.id === selectedInspection);
  const availableSections = inspection?.availableSections || [];
  const positionedSections = availableSections.filter((section) =>
    ['front wall', 'rear wall', 'left wall', 'right wall'].includes(section.name.toLowerCase()),
  );
  const traySections = availableSections.filter((section) => !positionedSections.includes(section));
  const inspectionOptions = inspections.map((item) => ({
    value: item.id,
    label: `${item.inspectionName}${item.inspectionDate ? ` - ${item.inspectionDate}` : ''}`,
  }));

  const selectSection = (sectionId) => {
    playUiSound('open', soundEnabled);
    setSelectedWall(sectionId);
    setSelectedCoil(null);
    setView('viewer');
  };

  const selectInspection = (value) => {
    playUiSound('click', soundEnabled);
    setSelectedInspection(value);
    const nextInspection = inspections.find((item) => item.id === value);
    setSelectedWall(nextInspection?.availableSections?.[0]?.id || nextInspection?.sections?.[0]?.id || 'FrontWall');
    setSelectedCoil(null);
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
            Kiln Navigation
          </Text>
          <Title order={1}>Choose the inspection component.</Title>
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
            {positionedSections.map((section) => (
              <button
                type="button"
                key={section.id}
                className={`boiler-wall ${getWallClass(section.name)} ${selectedWall === section.id ? 'is-active' : ''}`}
                onClick={() => selectSection(section.id)}
              >
                <span>{section.name}</span>
              </button>
            ))}
            {traySections.length > 0 && (
              <div className="component-tray">
                {traySections.map((section) => (
                  <button
                    type="button"
                    key={section.id}
                    className={`component-chip ${selectedWall === section.id ? 'is-active' : ''}`}
                    onClick={() => selectSection(section.id)}
                  >
                    <span>{section.name}</span>
                    <small>{section.layout}</small>
                  </button>
                ))}
              </div>
            )}
            <div className="boiler-map-core">
              <div className="core-ring" />
              <div className="core-pulse" />
              <Text size="xs" fw={700}>
                Kiln
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
              onChange={selectInspection}
              allowDeselect={false}
            />
          </Paper>

          <Group grow>
            <Button variant="subtle" onClick={() => setView('welcome')}>
              Back
            </Button>
            <Text size="xs" c="dimmed">
              Click a kiln section with sheet data to launch the 3D heatmap.
            </Text>
          </Group>
        </Stack>
      </div>
    </section>
  );
}

export default KilnNavigator;
