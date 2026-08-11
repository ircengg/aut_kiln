import { Button, Group, Paper, Text, Title } from "@mantine/core";
import { useAtomValue, useSetAtom } from "jotai";
import { appViewAtom, soundEnabledAtom } from "../state/inspectionAtoms";
import { playUiSound } from "../utils/sound";

const steps = ["Rotary Kiln", "AUT Inspection", "Section Selection", "3D Thickness Map"];

function WelcomeExperience({ inspections }) {
  const setView = useSetAtom(appViewAtom);
  const soundEnabled = useAtomValue(soundEnabledAtom);

  const enterKiln = () => {
    playUiSound("launch", soundEnabled);
    setView("viewer");
  };

  return (
    <section className="welcome-stage scene-enter scene-enter-sweep">
      <div className="welcome-copy">
        <Text size="xs" fw={700} tt="uppercase" className="signal-text">
          Cement Kiln Inspection Platform
        </Text>
        <Title className="welcome-title">
          Kiln intelligence, wrapped in 3D.
        </Title>
        <Text className="welcome-subtitle">
          Explore dense AUT and UT thickness data across every axial and
          circumferential position of the rotary kiln.
        </Text>
        <Group gap="sm">
          <Button size="md" onClick={enterKiln} className="primary-action">
            Enter Kiln
          </Button>
          <Text size="sm" c="dimmed">
            {inspections.length} inspection workbook
            {inspections.length === 1 ? "" : "s"} loaded
          </Text>
        </Group>
      </div>

      <div className="welcome-visual" aria-hidden="true">
        <div className="kiln-home-assembly">
          <div className="kiln-home-shell">
            <span className="kiln-home-band band-one" />
            <span className="kiln-home-band band-two" />
            <span className="kiln-home-band band-three" />
            <span className="kiln-home-scan" />
          </div>
          <div className="kiln-home-tyre tyre-one" />
          <div className="kiln-home-tyre tyre-two" />
          <div className="kiln-home-support support-one" />
          <div className="kiln-home-support support-two" />
          <div className="kiln-home-flame" />
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
