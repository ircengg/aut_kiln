import {
  AppShell,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import BoilerNavigator from "../components/BoilerNavigator";
import Sidebar from "../components/Sidebar";
import WelcomeExperience from "../components/WelcomeExperience";
import WallViewer from "../components/WallViewer";
import {
  appViewAtom,
  hoverCellAtom,
  inspectionsAtom,
  selectedCoilAtom,
  selectedInspectionAtom,
  selectedWallAtom,
} from "../state/inspectionAtoms";
import { formatMeasurement } from "../utils/measurements";
import { loadDataInspections } from "../utils/dataFiles";

function Home() {
  const inspections = useAtomValue(inspectionsAtom);
  const setInspections = useSetAtom(inspectionsAtom);
  const setSelectedInspection = useSetAtom(selectedInspectionAtom);
  const setSelectedWall = useSetAtom(selectedWallAtom);
  const setSelectedCoil = useSetAtom(selectedCoilAtom);
  const selectedInspection = useAtomValue(selectedInspectionAtom);
  const selectedWall = useAtomValue(selectedWallAtom);
  const hoverCell = useAtomValue(hoverCellAtom);
  const appView = useAtomValue(appViewAtom);
  const loadedRef = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const inspection =
    inspections.find((item) => item.id === selectedInspection) || null;

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    loadDataInspections()
      .then((loadedInspections) => {
        setInspections(loadedInspections);
        setSelectedInspection(loadedInspections[0]?.id || null);
        setSelectedWall(
          loadedInspections[0]?.availableSections?.[0]?.id ||
            loadedInspections[0]?.sections?.[0]?.id ||
            "FrontWall",
        );
        setSelectedCoil(null);
        setLoadError("");
      })
      .catch((error) => {
        setInspections([]);
        setSelectedInspection(null);
        setSelectedWall(null);
        setSelectedCoil(null);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load this project.",
        );
      })
      .finally(() => setIsLoading(false));
  }, [setInspections, setSelectedCoil, setSelectedInspection, setSelectedWall]);

  if (loadError) {
    return (
      <main className="full-page-shell project-error-page">
        <Paper className="project-error-panel" p="xl" radius="md" withBorder>
          <Stack gap="md">
            <Text className="signal-text" tt="uppercase" fw={800} size="xs">
              Project unavailable
            </Text>
            <Title order={1}>Unable to open inspection viewer</Title>
            <Text c="dimmed">{loadError}</Text>
            <Text size="sm" c="dimmed">
              Use a URL like <strong>/?project=your_project_id</strong>, or open
              the project from the admin list.
            </Text>
          </Stack>
        </Paper>
      </main>
    );
  }

  if (appView === "welcome") {
    return (
      <main className="full-page-shell">
        <WelcomeExperience inspections={inspections} isLoading={isLoading} />
      </main>
    );
  }

  if (appView === "boiler") {
    return (
      <main className="full-page-shell">
        <BoilerNavigator />
      </main>
    );
  }

  return (
    <AppShell
      navbar={{ width: 300, breakpoint: "sm" }}
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
            {inspection ? inspection.inspectionName : "No inspection selected"}
          </Text>
          <Text size="xs">
            Component: {inspection?.walls?.[selectedWall]?.name || selectedWall}
          </Text>
          {hoverCell?.coil && <Text size="xs">Coil: {hoverCell.coil}</Text>}
          <Text size="xs">Tube: {hoverCell?.tube ?? "-"}</Text>
          <Text size="xs">
            {hoverCell?.lengthLabel || "Elevation"}: {hoverCell?.elevation ?? "-"} mm
          </Text>
          <Text size="xs">
            Thickness: {formatMeasurement(hoverCell?.thickness, "thickness")}
          </Text>
          {hoverCell?.displayMode === "wallLoss" && (
            <Text size="xs">Wall Loss: {hoverCell.displayLabel}</Text>
          )}
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}

export default Home;
