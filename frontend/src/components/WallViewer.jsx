import { Center, Paper, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  colorRangeAtom,
  inspectionsAtom,
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
import ComparisonModal from './ComparisonModal';
import ObservationsModal from './ObservationsModal';
import PixiCanvas from './PixiCanvas';
import KilnCanvas from './KilnCanvas';
import Toolbar from './Toolbar';

const easeOutCubic = (value) => 1 - (1 - value) ** 3;

function WallViewer({ inspection }) {
  const { ref, width, height } = useElementSize();
  const inspections = useAtomValue(inspectionsAtom);
  const selectedWall = useAtomValue(selectedWallAtom);
  const [selectedCoil, setSelectedCoil] = useAtom(selectedCoilAtom);
  const [zoom, setZoom] = useAtom(zoomAtom);
  const [pan, setPan] = useAtom(panAtom);
  const [colorRange, setColorRange] = useAtom(colorRangeAtom);
  const [selectedCell, setSelectedCell] = useAtom(selectedCellAtom);
  const displayMode = 'wallLoss';
  const [focusIndex, setFocusIndex] = useState(-1);
  const [isFocusPlaying, setIsFocusPlaying] = useState(false);
  const [observationsOpened, setObservationsOpened] = useState(false);
  const [comparisonOpened, setComparisonOpened] = useState(false);
  const cameraFrameRef = useRef(null);
  const kilnRef = useRef(null);
  const [corrosionExaggeration, setCorrosionExaggeration] = useState(1);
  const [kilnRotating, setKilnRotating] = useState(true);
  const [corrosionReveal, setCorrosionReveal] = useState(1);
  const [kilnLabelsVisible, setKilnLabelsVisible] = useState(true);
  const [kilnGridVisible, setKilnGridVisible] = useState(true);
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
  const isKiln = inspection?.assetType === 'kiln' || wallData?.assetType === 'kiln';
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
    if (!isKiln) return undefined;
    setCorrosionReveal(0.02);
    const started = performance.now();
    let frame;
    const animate = (now) => {
      const progress = Math.min((now - started) / 850, 1);
      setCorrosionReveal(easeOutCubic(progress));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [inspection?.id, isKiln, selectedWall]);

  useEffect(() => {
    if (!isFocusPlaying || !focusAreas.length) return undefined;

    const timer = window.setInterval(() => {
      setFocusIndex((current) => (current + 1) % focusAreas.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [focusAreas.length, isFocusPlaying]);

  useEffect(() => {
    if (!focusedArea || !width || !canvasHeight) return undefined;

    setColorRange({ min: 20, max: Math.max(displayRange.max ?? focusedArea.maxWallLoss, 20.001) });

    if (isKiln) return undefined;

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
    setPan,
    setZoom,
    wallData?.tubeDiameter,
    wallData?.tubePitch,
    width,
    isKiln,
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
          onOpenComparison={() => setComparisonOpened(true)}
          canCompare={Boolean(selectedCell?.wall === selectedWall)}
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
        onOpenComparison={() => setComparisonOpened(true)}
        canCompare={Boolean(selectedCell?.wall === selectedWall)}
        lengthLabel={lengthLabel}
        isKiln={isKiln}
        corrosionExaggeration={corrosionExaggeration}
        onCorrosionExaggeration={setCorrosionExaggeration}
        kilnRotating={kilnRotating}
        onToggleKilnRotation={() => setKilnRotating((value) => !value)}
        onFit3d={() => kilnRef.current?.fit()}
        onReset3d={() => kilnRef.current?.reset()}
        kilnLabelsVisible={kilnLabelsVisible}
        onToggleKilnLabels={() => setKilnLabelsVisible((value) => !value)}
        kilnGridVisible={kilnGridVisible}
        onToggleKilnGrid={() => setKilnGridVisible((value) => !value)}
      />
      {isKiln ? (
        <KilnCanvas
          ref={kilnRef}
          inspection={inspection}
          wallData={wallData}
          colorRange={colorRange}
          displayMode={displayMode}
          displayRange={displayRange}
          focusedArea={focusedArea}
          exaggeration={corrosionExaggeration}
          rotating={kilnRotating}
          reveal={corrosionReveal}
          showLabels={kilnLabelsVisible}
          showGrid={kilnGridVisible}
        />
      ) : (
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
      )}
      <ObservationsModal
        opened={observationsOpened}
        onClose={() => setObservationsOpened(false)}
        observations={observations}
        sectionName={wallData?.name || selectedWall}
      />
      <ComparisonModal
        opened={comparisonOpened}
        onClose={() => setComparisonOpened(false)}
        inspections={inspections}
        selectedCell={selectedCell?.wall === selectedWall ? selectedCell : null}
        selectedCoil={selectedCoil}
        sectionName={wallData?.name || selectedWall}
        lengthLabel={lengthLabel}
      />
    </Paper>
  );
}

export default WallViewer;
