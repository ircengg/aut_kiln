import { Button, Group, RangeSlider, SegmentedControl, Text } from '@mantine/core';
import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import {
  colorRangeAtom,
  displayModeAtom,
  panAtom,
  selectedCellAtom,
  zoomAtom,
} from '../state/inspectionAtoms';
import { fitViewToSize } from '../utils/fitView';
import { DISPLAY_MODES } from '../utils/measurements';

function Toolbar({ bounds, size, displayRange }) {
  const [zoom, setZoom] = useAtom(zoomAtom);
  const [colorRange, setColorRange] = useAtom(colorRangeAtom);
  const [displayMode, setDisplayMode] = useAtom(displayModeAtom);
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
  const step = hasRange ? Math.max((displayRange.max - displayRange.min) / 100, 0.01) : 0.01;
  const modeLabel = DISPLAY_MODES[displayMode]?.label || 'Value';
  const modeUnit = DISPLAY_MODES[displayMode]?.unit || '';

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
        <SegmentedControl
          size="xs"
          value={displayMode}
          onChange={setDisplayMode}
          data={[
            { label: 'Thickness', value: 'thickness' },
            { label: 'Wall Loss %', value: 'wallLoss' },
          ]}
        />
        <Button size="xs" variant="light" onClick={() => setZoom((value) => value * 1.2)}>
          Zoom In
        </Button>
        <Button size="xs" variant="light" onClick={() => setZoom((value) => value / 1.2)}>
          Zoom Out
        </Button>
        <Button size="xs" variant="light" onClick={fit}>
          Fit
        </Button>
        <Button size="xs" variant="subtle" onClick={reset}>
          Reset
        </Button>
      </Group>
      <Group gap="sm" className="toolbar-range">
        {hasRange && (
          <>
            <Text size="xs" c="dimmed" miw={112}>
              Focus {modeLabel} {draftRange[0].toFixed(2)}-{draftRange[1].toFixed(2)} {modeUnit}
            </Text>
            <RangeSlider
              min={displayRange.min}
              max={displayRange.max}
              step={step}
              value={draftRange}
              onChange={setDraftRange}
              onChangeEnd={([min, max]) => setColorRange({ min, max })}
              minRange={step}
              w={220}
              size="xs"
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
