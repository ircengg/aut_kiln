import { Button, Group, Paper, Text, Title } from "@mantine/core";
import { useAtomValue, useSetAtom } from "jotai";
import { appViewAtom, soundEnabledAtom } from "../state/inspectionAtoms";
import { playUiSound } from "../utils/sound";

const steps = ["Boiler", "AUT Inspection", "Wall Selection", "Thickness Map"];

function WelcomeExperience({ inspections }) {
  const setView = useSetAtom(appViewAtom);
  const soundEnabled = useAtomValue(soundEnabledAtom);

  const enterBoiler = () => {
    playUiSound("launch", soundEnabled);
    setView("boiler");
  };

  return (
    <section className="welcome-stage scene-enter scene-enter-sweep">
      <div className="welcome-copy">
        <Text size="xs" fw={700} tt="uppercase" className="signal-text">
          AUT Waterwall Console
        </Text>
        <Title className="welcome-title">
          Boiler intelligence, live on the wall.
        </Title>
        <Text className="welcome-subtitle">
          Select an inspection, enter the boiler, choose a wall, then launch the
          tubes visualization.
        </Text>
        <Group gap="sm">
          <Button size="md" onClick={enterBoiler} className="primary-action">
            Enter Boiler
          </Button>
          <Text size="sm" c="dimmed">
            {inspections.length} inspection workbook
            {inspections.length === 1 ? "" : "s"} loaded
          </Text>
        </Group>
      </div>

      <div className="welcome-visual" aria-hidden="true">
        <div className="boiler-core">
          <div className="boiler-glow" />
          <div className="wall wall-front" />
          <div className="wall wall-rear" />
          <div className="wall wall-left" />
          <div className="wall wall-right" />
          <div className="scan-line scan-one" />
          <div className="scan-line scan-two" />
          <div className="tube-ridges" />
        </div>
      </div>

      <div className="workflow-strip">
        {steps.map((step, index) => (
          <Paper key={step} className="workflow-step" withBorder>
            <span className="workflow-index">{index + 1}</span>
            <Text size="sm" fw={700}>
              {step}
            </Text>
          </Paper>
        ))}
      </div>
    </section>
  );
}

export default WelcomeExperience;
