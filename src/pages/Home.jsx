import { AppShell, Group, Text } from '@mantine/core';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import BoilerNavigator from '../components/BoilerNavigator';
import Sidebar from '../components/Sidebar';
import WelcomeExperience from '../components/WelcomeExperience';
import WallViewer from '../components/WallViewer';
import {
  appViewAtom,
  hoverCellAtom,
  inspectionsAtom,
  selectedInspectionAtom,
  selectedWallAtom,
  WALL_LABELS,
} from '../state/inspectionAtoms';
import { formatMeasurement } from '../utils/measurements';
import { loadDataInspections } from '../utils/dataFiles';

function Home() {
  const inspections = useAtomValue(inspectionsAtom);
  const setInspections = useSetAtom(inspectionsAtom);
  const setSelectedInspection = useSetAtom(selectedInspectionAtom);
  const selectedInspection = useAtomValue(selectedInspectionAtom);
  const selectedWall = useAtomValue(selectedWallAtom);
  const hoverCell = useAtomValue(hoverCellAtom);
  const appView = useAtomValue(appViewAtom);
  const loadedRef = useRef(false);
  const inspection = inspections.find((item) => item.id === selectedInspection) || null;

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    loadDataInspections().then((loadedInspections) => {
      setInspections(loadedInspections);
      setSelectedInspection(loadedInspections[0]?.id || null);
    });
  }, [setInspections, setSelectedInspection]);

  if (appView === 'welcome') {
    return (
      <main className="full-page-shell">
        <WelcomeExperience inspections={inspections} />
      </main>
    );
  }

  if (appView === 'boiler') {
    return (
      <main className="full-page-shell">
        <BoilerNavigator />
      </main>
    );
  }

  return (
    <AppShell
      navbar={{ width: 300, breakpoint: 'sm' }}
      footer={{ height: 34 }}
      padding="md"
      className="app-shell"
    >
      <AppShell.Navbar p="md">
        <Sidebar />
      </AppShell.Navbar>

      <AppShell.Main>
        <WallViewer inspection={inspection} />
      </AppShell.Main>

      <AppShell.Footer px="md">
        <Group h="100%" gap="xl" wrap="nowrap">
          <Text size="xs" c="dimmed">
            {inspection ? inspection.inspectionName : 'No inspection selected'}
          </Text>
          <Text size="xs">Wall: {WALL_LABELS[selectedWall]}</Text>
          <Text size="xs">Tube: {hoverCell?.tube ?? '-'}</Text>
          <Text size="xs">Elevation: {hoverCell?.elevation ?? '-'} mm</Text>
          <Text size="xs">Thickness: {formatMeasurement(hoverCell?.thickness, 'thickness')}</Text>
          {hoverCell?.displayMode === 'wallLoss' && (
            <Text size="xs">Wall Loss: {hoverCell.displayLabel}</Text>
          )}
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}

export default Home;
