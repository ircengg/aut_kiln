import { Center, Paper, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';
import {
  colorRangeAtom,
  displayModeAtom,
  panAtom,
  selectedWallAtom,
  zoomAtom,
} from '../state/inspectionAtoms';
import { fitViewToSize, getWallBounds } from '../utils/fitView';
import { getDisplayRange } from '../utils/measurements';
import PixiCanvas from './PixiCanvas';
import Toolbar from './Toolbar';

function WallViewer({ inspection }) {
  const { ref, width, height } = useElementSize();
  const selectedWall = useAtomValue(selectedWallAtom);
  const [, setZoom] = useAtom(zoomAtom);
  const [, setPan] = useAtom(panAtom);
  const [colorRange, setColorRange] = useAtom(colorRangeAtom);
  const displayMode = useAtomValue(displayModeAtom);
  const wallConfig = useMemo(
    () => inspection?.walls?.[selectedWall] || {},
    [inspection, selectedWall],
  );
  const wallData = useMemo(
    () => inspection?.wallData?.[selectedWall],
    [inspection, selectedWall],
  );
  const bounds = useMemo(() => getWallBounds(wallConfig, wallData), [wallConfig, wallData]);
  const displayRange = useMemo(() => getDisplayRange(wallData, displayMode), [displayMode, wallData]);
  const canvasHeight = Math.max(height - 42, 1);
  const size = { width, height: canvasHeight };

  useEffect(() => {
    if (!inspection || !wallData?.values?.length || !width || !canvasHeight) return;
    const next = fitViewToSize(bounds, { width, height: canvasHeight });
    setZoom(next.zoom);
    setPan(next.pan);
  }, [bounds, canvasHeight, inspection, selectedWall, setPan, setZoom, wallData?.values?.length, width]);

  useEffect(() => {
    setColorRange({ min: displayRange.min, max: displayRange.max });
  }, [displayMode, displayRange.max, displayRange.min, inspection?.id, selectedWall, setColorRange]);

  if (!inspection) {
    return (
      <Paper ref={ref} className="canvas-panel" withBorder>
        <Center h="100%">
          <Text c="dimmed">Loading inspections from the data folder.</Text>
        </Center>
      </Paper>
    );
  }

  if (!wallData?.values?.length) {
    return (
      <Paper ref={ref} className="canvas-panel" withBorder>
        <Toolbar bounds={bounds} size={size} displayRange={displayRange} />
        <Center h="calc(100% - 42px)">
          <Text c="dimmed">No sheet data found for this wall.</Text>
        </Center>
      </Paper>
    );
  }

  return (
    <Paper ref={ref} className="canvas-panel" withBorder>
      <Toolbar bounds={bounds} size={size} displayRange={displayRange} />
      <PixiCanvas
        inspection={inspection}
        wallData={wallData}
        bounds={bounds}
        size={size}
        colorRange={colorRange}
        displayMode={displayMode}
        displayRange={displayRange}
      />
    </Paper>
  );
}

export default WallViewer;
