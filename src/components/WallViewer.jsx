import { Center, Paper, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  colorRangeAtom,
  displayModeAtom,
  panAtom,
  selectedWallAtom,
  zoomAtom,
} from '../state/inspectionAtoms';
import { fitViewToSize, getWallBounds } from '../utils/fitView';
import { getDisplayRange } from '../utils/measurements';
import { getCorrodedAreas } from '../utils/corrosionFocus';
import PixiCanvas from './PixiCanvas';
import Toolbar from './Toolbar';

const easeOutCubic = (value) => 1 - (1 - value) ** 3;

function WallViewer({ inspection }) {
  const { ref, width, height } = useElementSize();
  const selectedWall = useAtomValue(selectedWallAtom);
  const [zoom, setZoom] = useAtom(zoomAtom);
  const [pan, setPan] = useAtom(panAtom);
  const [colorRange, setColorRange] = useAtom(colorRangeAtom);
  const [displayMode, setDisplayMode] = useAtom(displayModeAtom);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [isFocusPlaying, setIsFocusPlaying] = useState(false);
  const cameraFrameRef = useRef(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
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
  const focusAreas = useMemo(() => getCorrodedAreas(wallData), [wallData]);
  const focusedArea = focusIndex >= 0 ? focusAreas[focusIndex] : null;
  const canvasHeight = Math.max(height - 42, 1);
  const size = { width, height: canvasHeight };

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    if (!inspection || !wallData?.values?.length || !width || !canvasHeight) return;
    const next = fitViewToSize(bounds, { width, height: canvasHeight });
    setZoom(next.zoom);
    setPan(next.pan);
  }, [bounds, canvasHeight, inspection, selectedWall, setPan, setZoom, wallData?.values?.length, width]);

  useEffect(() => {
    setColorRange({ min: displayRange.min, max: displayRange.max });
  }, [displayMode, displayRange.max, displayRange.min, inspection?.id, selectedWall, setColorRange]);

  useEffect(() => {
    setFocusIndex(-1);
    setIsFocusPlaying(false);
  }, [inspection?.id, selectedWall]);

  useEffect(() => {
    if (!isFocusPlaying || !focusAreas.length) return undefined;

    const timer = window.setInterval(() => {
      setFocusIndex((current) => (current + 1) % focusAreas.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [focusAreas.length, isFocusPlaying]);

  useEffect(() => {
    if (!focusedArea || !width || !canvasHeight) return undefined;

    if (displayMode !== 'wallLoss') {
      setDisplayMode('wallLoss');
      return undefined;
    }

    setColorRange({ min: 20, max: Math.max(displayRange.max ?? focusedArea.maxWallLoss, 20.001) });

    const pitch = wallData.tubePitch || wallData.tubeDiameter || 1;
    const areaWidth = Math.max((focusedArea.maxTube - focusedArea.minTube + 1) * pitch, pitch);
    const areaHeight = Math.max(focusedArea.maxUpper - focusedArea.minLower, pitch);
    const targetZoom = Math.min(
      18,
      Math.max(
        0.05,
        Math.min(width / (areaWidth * 3.2), canvasHeight / (areaHeight * 5.4)),
      ),
    );
    const centerX = ((focusedArea.minTube + focusedArea.maxTube) / 2 - 0.5) * pitch;
    const centerY = bounds.height - focusedArea.centerElevation;
    const targetPan = {
      x: width / 2 - centerX * targetZoom,
      y: canvasHeight / 2 - centerY * targetZoom,
    };
    const startZoom = zoomRef.current;
    const startPan = panRef.current;
    const startedAt = performance.now();
    const duration = 720;

    if (cameraFrameRef.current) cancelAnimationFrame(cameraFrameRef.current);

    const animate = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = easeOutCubic(progress);

      setZoom(startZoom + (targetZoom - startZoom) * eased);
      setPan({
        x: startPan.x + (targetPan.x - startPan.x) * eased,
        y: startPan.y + (targetPan.y - startPan.y) * eased,
      });

      if (progress < 1) {
        cameraFrameRef.current = requestAnimationFrame(animate);
      }
    };

    cameraFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (cameraFrameRef.current) cancelAnimationFrame(cameraFrameRef.current);
    };
  }, [
    bounds.height,
    canvasHeight,
    displayMode,
    displayRange.max,
    focusedArea,
    setColorRange,
    setDisplayMode,
    setPan,
    setZoom,
    wallData?.tubeDiameter,
    wallData?.tubePitch,
    width,
  ]);

  const showNextFocus = () => {
    if (!focusAreas.length) return;
    setIsFocusPlaying(false);
    setFocusIndex((current) => (current + 1) % focusAreas.length);
  };

  const showPreviousFocus = () => {
    if (!focusAreas.length) return;
    setIsFocusPlaying(false);
    setFocusIndex((current) => (current <= 0 ? focusAreas.length - 1 : current - 1));
  };

  const toggleFocusPlay = () => {
    if (!focusAreas.length) return;
    setFocusIndex((current) => (current < 0 ? 0 : current));
    setIsFocusPlaying((value) => !value);
  };

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
    <Paper ref={ref} className="canvas-panel scene-enter scene-enter-lift" withBorder>
      <Toolbar
        bounds={bounds}
        size={size}
        displayRange={displayRange}
        focusAreas={focusAreas}
        focusIndex={focusIndex}
        focusedArea={focusedArea}
        isFocusPlaying={isFocusPlaying}
        onFocusNext={showNextFocus}
        onFocusPrevious={showPreviousFocus}
        onFocusPlay={toggleFocusPlay}
      />
      <PixiCanvas
        inspection={inspection}
        wallData={wallData}
        bounds={bounds}
        size={size}
        colorRange={colorRange}
        displayMode={displayMode}
        displayRange={displayRange}
        focusedArea={focusedArea}
      />
    </Paper>
  );
}

export default WallViewer;
