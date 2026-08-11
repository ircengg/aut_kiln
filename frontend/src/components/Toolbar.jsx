import {
  ActionIcon,
  Group,
  RangeSlider,
  Select,
  Text,
  Tooltip,
} from "@mantine/core";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import {
  colorRangeAtom,
  panAtom,
  selectedCellAtom,
  zoomAtom,
} from "../state/inspectionAtoms";
import { fitViewToSize } from "../utils/fitView";
import { DISPLAY_MODES } from "../utils/measurements";

function Toolbar({
  bounds,
  size,
  displayRange,
  focusAreas = [],
  focusIndex = -1,
  focusedArea = null,
  isFocusPlaying = false,
  onFocusNext,
  onFocusPrevious,
  onFocusPlay,
  coilOptions = [],
  selectedCoil = null,
  onCoilChange,
  observations = [],
  criticalObservationCount = 0,
  onOpenObservations,
  onOpenComparison,
  canCompare = false,
  lengthLabel = "Elevation",
  isKiln = false,
  corrosionExaggeration = 1,
  onCorrosionExaggeration,
  kilnRotating = false,
  onToggleKilnRotation,
  onFit3d,
  onReset3d,
}) {
  const [zoom, setZoom] = useAtom(zoomAtom);
  const [colorRange, setColorRange] = useAtom(colorRangeAtom);
  const displayMode = 'wallLoss';
  const setPan = useSetAtom(panAtom);
  const setSelectedCell = useSetAtom(selectedCellAtom);
  const hasRange =
    Number.isFinite(displayRange?.min) &&
    Number.isFinite(displayRange?.max) &&
    displayRange.max > displayRange.min;
  const sliderMin = colorRange.min ?? displayRange?.min ?? 0;
  const sliderMax = colorRange.max ?? displayRange?.max ?? 1;
  const sliderValue = [sliderMin, sliderMax];
  const [draftRange, setDraftRange] = useState(sliderValue);
  const step = hasRange
    ? Math.max((displayRange.max - displayRange.min) / 1000, 0.001)
    : 0.001;
  const modeLabel = DISPLAY_MODES[displayMode]?.label || "Value";
  const modeUnit = DISPLAY_MODES[displayMode]?.unit || "";
  const formatRangeValue = (value) => value.toFixed(3);
  const focusCount = focusAreas.length;
  const isSpotFocus = focusedArea?.kind === "spot" || focusAreas[0]?.kind === "spot";
  const focusSummary = focusedArea
    ? isKiln
      ? `Area ${focusIndex + 1}/${focusCount} | Axial ${Math.round(focusedArea.minAxial)}-${Math.round(focusedArea.maxAxial)} mm | Circumference ${Math.round(focusedArea.minCircumference)}-${Math.round(focusedArea.maxCircumference)} mm | Angle ${focusedArea.minAngleDegrees.toFixed(1)}°-${focusedArea.maxAngleDegrees.toFixed(1)}° | Max loss ${focusedArea.maxWallLoss.toFixed(1)}% | Min ${focusedArea.minThickness.toFixed(2)} mm`
      : isSpotFocus
      ? `Spot ${focusIndex + 1}/${focusCount} | Tube ${focusedArea.minTube} | ${lengthLabel} ${Math.round(focusedArea.centerElevation)} mm | Wall loss ${focusedArea.maxWallLoss.toFixed(1)}% | ${focusedArea.minThickness.toFixed(2)} mm`
      : `Area ${focusIndex + 1}/${focusCount} | Tubes ${focusedArea.minTube}-${focusedArea.maxTube} | ${lengthLabel} ${Math.round(focusedArea.minElevation)}-${Math.round(focusedArea.maxElevation)} mm | Max ${focusedArea.maxWallLoss.toFixed(1)}% | Min ${focusedArea.minThickness.toFixed(2)} mm`
    : focusCount
      ? isKiln
        ? `${focusCount} kiln corrosion areas > 20% wall loss`
        : isSpotFocus
        ? `${focusCount} critical spots > 20%`
        : `${focusCount} high wall-loss areas > 20%`
      : isSpotFocus
        ? "No critical spots > 20%"
        : "No wall-loss areas > 20%";
  const commitRange = ([min, max]) => {
    setColorRange({
      min: Number(min.toFixed(3)),
      max: Number(max.toFixed(3)),
    });
  };

  useEffect(() => {
    setDraftRange([sliderMin, sliderMax]);
  }, [sliderMax, sliderMin]);

  const fit = () => {
    if (isKiln) { onFit3d?.(); return; }
    const next = fitViewToSize(bounds, size);
    setZoom(next.zoom);
    setPan(next.pan);
  };

  const reset = () => {
    if (isKiln) { onReset3d?.(); setSelectedCell(null); return; }
    setZoom(1);
    setPan({ x: 24, y: 24 });
    setSelectedCell(null);
  };

  return (
    <Group justify="space-between" className="toolbar">
      <Group gap="xs">
        {/* <Tooltip label="Home">
          <ActionIcon
            aria-label="Home"
            size="sm"
            variant="light"
            onClick={() => setAppView("welcome")}
          >
            ⌂
          </ActionIcon>
        </Tooltip> */}
        <Text size="xs" fw={800} className="wall-loss-mode-label">Wall Loss %</Text>
        {coilOptions.length > 0 && (
          <Select
            aria-label="Select coil"
            size="xs"
            className="coil-select"
            data={coilOptions}
            value={selectedCoil === null ? null : String(selectedCoil)}
            onChange={(value) =>
              onCoilChange?.(value === null ? null : Number(value))
            }
            allowDeselect={false}
          />
        )}
        <Tooltip label="Zoom in">
          <ActionIcon
            aria-label="Zoom in"
            size="sm"
            variant="light"
            onClick={() => setZoom((value) => value * 1.2)}
          >
            +
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Zoom out">
          <ActionIcon
            aria-label="Zoom out"
            size="sm"
            variant="light"
            onClick={() => setZoom((value) => value / 1.2)}
          >
            -
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Fit view">
          <ActionIcon
            aria-label="Fit view"
            size="sm"
            variant="light"
            onClick={fit}
          >
            ⛶
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Reset view">
          <ActionIcon
            aria-label="Reset view"
            size="sm"
            variant="subtle"
            onClick={reset}
          >
            ↺
          </ActionIcon>
        </Tooltip>
        {isKiln && (
          <Tooltip label={kilnRotating ? "Pause kiln rotation" : "Rotate kiln"}>
            <ActionIcon aria-label="Toggle kiln rotation" size="sm" variant={kilnRotating ? "filled" : "light"} onClick={onToggleKilnRotation}>
              {kilnRotating ? "II" : "R"}
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label="Inspection observations">
          <ActionIcon
            aria-label="Inspection observations"
            size="sm"
            variant={criticalObservationCount ? "filled" : "light"}
            color={criticalObservationCount ? "red" : undefined}
            disabled={!observations.length}
            onClick={onOpenObservations}
          >
            {criticalObservationCount ? "!" : "i"}
          </ActionIcon>
        </Tooltip>
        <Tooltip label={canCompare ? "Compare selected area" : "Select a tube reading to compare"}>
          <ActionIcon
            aria-label="Compare selected area"
            size="sm"
            variant={canCompare ? "filled" : "light"}
            disabled={!canCompare}
            onClick={onOpenComparison}
          >
            C
          </ActionIcon>
        </Tooltip>
        <Group gap={4} className="focus-nav">
          <Tooltip label="Previous corroded area">
            <ActionIcon
              aria-label="Previous corroded area"
              size="sm"
              variant="light"
              disabled={!focusCount}
              onClick={onFocusPrevious}
            >
              &lt;
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={isFocusPlaying ? "Pause focus scan" : "Play focus scan"}
          >
            <ActionIcon
              aria-label={
                isFocusPlaying ? "Pause focus scan" : "Play focus scan"
              }
              size="sm"
              variant={isFocusPlaying ? "filled" : "light"}
              disabled={!focusCount}
              onClick={onFocusPlay}
            >
              {isFocusPlaying ? "II" : ">"}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Next corroded area">
            <ActionIcon
              aria-label="Next corroded area"
              size="sm"
              variant="light"
              disabled={!focusCount}
              onClick={onFocusNext}
            >
              &gt;
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Group gap="sm" className="toolbar-range">
        {isKiln && (
          <Group gap={6} wrap="nowrap">
            <Text size="xs" c="dimmed">Corrosion {corrosionExaggeration.toFixed(0)}x</Text>
            <RangeSlider
              min={0}
              max={50}
              step={1}
              value={[0, corrosionExaggeration]}
              onChange={(value) => onCorrosionExaggeration?.(value[1])}
              minRange={0}
              w={110}
              size="xs"
              label={(value) => `${value}x`}
            />
          </Group>
        )}
        <Text size="xs" className="focus-summary" title={focusSummary}>
          {focusSummary}
        </Text>
        {hasRange && (
          <>
            <Text size="xs" c="dimmed" miw={176}>
              Focus {modeLabel} {formatRangeValue(draftRange[0])}-
              {formatRangeValue(draftRange[1])} {modeUnit}
            </Text>
            <RangeSlider
              min={displayRange.min}
              max={displayRange.max}
              step={step}
              value={draftRange}
              onChange={setDraftRange}
              onChangeEnd={commitRange}
              minRange={step}
              w={220}
              size="xs"
              label={formatRangeValue}
            />
          </>
        )}
        <Text size="xs" c="dimmed" miw={72} ta="right">
          Zoom {zoom.toFixed(2)}x
        </Text>
      </Group>
    </Group>
  );
}

export default Toolbar;
