import { Center, Paper, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  colorRangeAtom,
  displayModeAtom,
  panAtom,
  selectedCellAtom,
  selectedCoilAtom,
  selectedWallAtom,
  zoomAtom,
} from '../state/inspectionAtoms';
import { fitViewToSize, getWallBounds } from '../utils/fitView';
import { getDisplayRange } from '../utils/measurements';
import { getCorrodedAreas } from '../utils/corrosionFocus';
import { getSectionDataForCoil } from '../utils/excelParser';
import { isHorizontalLayout } from '../utils/layout';
import ObservationsModal from './ObservationsModal';
import PixiCanvas from './PixiCanvas';
import Toolbar from './Toolbar';

const easeOutCubic = (value) => 1 - (1 - value) ** 3;

function WallViewer({ inspection }) {
  const { ref, width, height } = useElementSize();
  const selectedWall = useAtomValue(selectedWallAtom);
  const [selectedCoil, setSelectedCoil] = useAtom(selectedCoilAtom);
  const [zoom, setZoom] = useAtom(zoomAtom);
  const [pan, setPan] = useAtom(panAtom);
  const [colorRange, setColorRange] = useAtom(colorRangeAtom);
  const [, setSelectedCell] = useAtom(selectedCellAtom);
  const [displayMode, setDisplayMode] = useAtom(displayModeAtom);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [isFocusPlaying, setIsFocusPlaying] = useState(false);
  const [observationsOpened, setObservationsOpened] = useState(false);
  const cameraFrameRef = useRef(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const wallConfig = useMemo(
    () => inspection?.walls?.[selectedWall] || {},
    [inspection, selectedWall],
  );
  const rawWallData = useMemo(
    () => inspection?.wallData?.[selectedWall],
    [inspection, selectedWall],
  );
  const wallData = useMemo(
    () => getSectionDataForCoil(rawWallData, selectedCoil),
    [rawWallData, selectedCoil],
  );
  const isHorizontal = isHorizontalLayout(wallData?.layout);
  const lengthLabel = isHorizontal ? 'Distance' : 'Elevation';
  const coilOptions = useMemo(
    () =>
      rawWallData?.coilNumbers?.map((coilNumber) => ({
        value: String(coilNumber),
        label: `Coil ${coilNumber}`,
      })) || [],
    [rawWallData?.coilNumbers],
  );
  const bounds = useMemo(() => getWallBounds(wallConfig, wallData), [wallConfig, wallData]);
  const displayRange = useMemo(() => getDisplayRange(wallData, displayMode), [displayMode, wallData]);
  const focusAreas = useMemo(() => getCorrodedAreas(wallData), [wallData]);
  const observations = wallData?.observations || [];
  const criticalObservationCount = observations.filter((item) => item.isCritical).length;
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
    if (!rawWallData?.hasCoils) {
      if (selectedCoil !== null) setSelectedCoil(null);
      return;
    }

    const nextCoil = rawWallData.coilNumbers?.includes(Number(selectedCoil))
      ? selectedCoil
      : rawWallData.coilNumbers?.[0];

    if (nextCoil !== selectedCoil) {
      setSelectedCoil(nextCoil ?? null);
    }
  }, [rawWallData, selectedCoil, setSelectedCoil]);

  useEffect(() => {
    if (!inspection || !wallData?.values?.length || !width || !canvasHeight) return;
    const next = fitViewToSize(bounds, { width, height: canvasHeight });
    setZoom(next.zoom);
    setPan(next.pan);
  }, [bounds, canvasHeight, inspection, selectedWall, setPan, setZoom, wallData?.dataKey, wallData?.values?.length, width]);

  useEffect(() => {
    setColorRange({ min: displayRange.min, max: displayRange.max });
  }, [displayMode, displayRange.max, displayRange.min, inspection?.id, selectedCoil, selectedWall, setColorRange]);

  useEffect(() => {
    setFocusIndex(-1);
    setIsFocusPlaying(false);
    setSelectedCell(null);
  }, [inspection?.id, selectedCoil, selectedWall, setSelectedCell]);

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
    const tubeAreaSpan = Math.max((focusedArea.maxTube - focusedArea.minTube + 1) * pitch, pitch);
    const elevationAreaSpan = Math.max(
      focusedArea.kind === 'spot' ? pitch : focusedArea.maxUpper - focusedArea.minLower,
      pitch,
    );
    const areaWidth = isHorizontal ? elevationAreaSpan : tubeAreaSpan;
    const areaHeight = isHorizontal ? tubeAreaSpan : elevationAreaSpan;
    const targetZoom = Math.min(
      18,
      Math.max(
        0.05,
        Math.min(
          width / (areaWidth * (focusedArea.kind === 'spot' ? 7.2 : 3.2)),
          canvasHeight / (areaHeight * (focusedArea.kind === 'spot' ? 7.2 : 5.4)),
        ),
      ),
    );
    const centerX = isHorizontal
      ? focusedArea.centerElevation
      : ((focusedArea.minTube + focusedArea.maxTube) / 2 - 0.5) * pitch;
    const centerY = isHorizontal
      ? ((focusedArea.minTube + focusedArea.maxTube) / 2 - 0.5) * pitch
      : bounds.height - focusedArea.centerElevation;
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
    isHorizontal,
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
        <Toolbar
          bounds={bounds}
          size={size}
          displayRange={displayRange}
          coilOptions={coilOptions}
          selectedCoil={selectedCoil}
          onCoilChange={setSelectedCoil}
          observations={observations}
          criticalObservationCount={criticalObservationCount}
          onOpenObservations={() => setObservationsOpened(true)}
          lengthLabel={lengthLabel}
        />
        <Center h="calc(100% - 42px)">
          <Text c="dimmed">No sheet data found for this component.</Text>
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
        coilOptions={coilOptions}
        selectedCoil={selectedCoil}
        onCoilChange={setSelectedCoil}
        observations={observations}
        criticalObservationCount={criticalObservationCount}
        onOpenObservations={() => setObservationsOpened(true)}
        lengthLabel={lengthLabel}
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
      <ObservationsModal
        opened={observationsOpened}
        onClose={() => setObservationsOpened(false)}
        observations={observations}
        sectionName={wallData?.name || selectedWall}
      />
    </Paper>
  );
}

export default WallViewer;
