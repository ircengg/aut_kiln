import {
  ActionIcon,
  Group,
  RangeSlider,
  SegmentedControl,
  Text,
  Tooltip,
} from "@mantine/core";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import {
  appViewAtom,
  colorRangeAtom,
  displayModeAtom,
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
}) {
  const [zoom, setZoom] = useAtom(zoomAtom);
  const [colorRange, setColorRange] = useAtom(colorRangeAtom);
  const [displayMode, setDisplayMode] = useAtom(displayModeAtom);
  const setPan = useSetAtom(panAtom);
  const setSelectedCell = useSetAtom(selectedCellAtom);
  const setAppView = useSetAtom(appViewAtom);
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
  const focusSummary = focusedArea
    ? `Area ${focusIndex + 1}/${focusCount} | Tubes ${focusedArea.minTube}-${focusedArea.maxTube} | Elev ${Math.round(focusedArea.minElevation)}-${Math.round(focusedArea.maxElevation)} mm | Max ${focusedArea.maxWallLoss.toFixed(1)}% | Min ${focusedArea.minThickness.toFixed(2)} mm`
    : focusCount
      ? `${focusCount} high wall-loss areas > 20%`
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
    const next = fitViewToSize(bounds, size);
    setZoom(next.zoom);
    setPan(next.pan);
  };

  const reset = () => {
    setZoom(1);
    setPan({ x: 24, y: 24 });
    setSelectedCell(null);
  };

  return (
    <Group justify="space-between" className="toolbar">
      <Group gap="xs">
        <Tooltip label="Home">
          <ActionIcon aria-label="Home" size="sm" variant="light" onClick={() => setAppView('welcome')}>
            ⌂
          </ActionIcon>
        </Tooltip>
        <SegmentedControl
          size="xs"
          value={displayMode}
          onChange={setDisplayMode}
          data={[
            { label: "Wall Loss %", value: "wallLoss" },
            { label: "Thickness", value: "thickness" },
          ]}
        />
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
          <Tooltip label={isFocusPlaying ? "Pause focus scan" : "Play focus scan"}>
            <ActionIcon
              aria-label={isFocusPlaying ? "Pause focus scan" : "Play focus scan"}
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
