import { Application, Container, Graphics, Sprite, Text as PixiText } from 'pixi.js';
import { useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  hoverCellAtom,
  panAtom,
  selectedCellAtom,
  selectedWallAtom,
  zoomAtom,
} from '../state/inspectionAtoms';
import { getWallTexture } from '../utils/textureCache';
import { formatMeasurement, getDisplayValue } from '../utils/measurements';
import { getElevationBands } from '../utils/elevationBands';
import Tooltip from './Tooltip';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const AXIS_COLOR = 0xe8fbf7;
const GRID_COLOR = 0x7ccabf;

function getNiceStep(rawStep) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawStep, 1)));
  const normalized = rawStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return magnitude * 2;
  if (normalized <= 5) return magnitude * 5;

  return magnitude * 10;
}

function makeAxisLabel(text, x, y, align = 'center') {
  const label = new PixiText({
    text,
    style: {
      fill: '#e8fbf7',
      fontFamily: 'system-ui, Segoe UI, sans-serif',
      fontSize: 11,
      fontWeight: '700',
      stroke: { color: '#061114', width: 3 },
      dropShadow: {
        color: '#000000',
        blur: 3,
        alpha: 0.8,
        distance: 1,
      },
    },
  });

  label.anchor.set(align === 'right' ? 1 : align === 'left' ? 0 : 0.5, 0.5);
  label.position.set(x, y);

  return label;
}

function PixiCanvas({
  inspection,
  wallData,
  bounds,
  size,
  colorRange,
  displayMode,
  displayRange,
  focusedArea,
}) {
  const hostRef = useRef(null);
  const appRef = useRef(null);
  const containerRef = useRef(null);
  const spriteRef = useRef(null);
  const separatorRef = useRef(null);
  const selectionRef = useRef(null);
  const focusRef = useRef(null);
  const axisRef = useRef(null);
  const dragRef = useRef(null);
  const [pixiReady, setPixiReady] = useState(false);
  const selectedWall = useAtomValue(selectedWallAtom);
  const [zoom, setZoom] = useAtom(zoomAtom);
  const [pan, setPan] = useAtom(panAtom);
  const [hoverCell, setHoverCell] = useAtom(hoverCellAtom);
  const [selectedCell, setSelectedCell] = useAtom(selectedCellAtom);

  const pitch = wallData.tubePitch || wallData.tubeDiameter || 1;
  const tubeCount = wallData.tubeCount || 0;
  const dataTubeCount = wallData.dataTubeCount || wallData.tubeNumbers?.length || tubeCount;
  const tubeNumbers = useMemo(
    () =>
      wallData.tubeNumbers?.length
        ? wallData.tubeNumbers
        : Array.from({ length: dataTubeCount }, (_, index) => index + 1),
    [dataTubeCount, wallData.tubeNumbers],
  );
  const tubeNumberToDataIndex = useMemo(() => {
    const map = new Map();
    tubeNumbers.forEach((tubeNumber, index) => {
      if (Number.isFinite(tubeNumber)) map.set(tubeNumber, index);
    });
    return map;
  }, [tubeNumbers]);
  const rowCount = wallData.height || wallData.elevations.length || 0;
  const rowHeight = bounds.height / Math.max(rowCount, 1);
  const diameter = Math.min(wallData.tubeDiameter || pitch * 0.72, pitch * 0.92);
  const elevationBands = useMemo(
    () => getElevationBands(wallData, bounds.height),
    [bounds.height, wallData],
  );

  useEffect(() => {
    let disposed = false;
    let initialized = false;
    const app = new Application();
    const container = new Container();
    const sprite = new Sprite();
    const separators = new Graphics();
    const selection = new Graphics();
    const focus = new Graphics();
    const axis = new Container();

    app
      .init({
        width: 1,
        height: 1,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        initialized = true;

        if (disposed || !hostRef.current) {
          app.destroy(true);
          return;
        }

        container.addChild(sprite, separators, selection, focus);
        app.stage.addChild(container, axis);
        hostRef.current.appendChild(app.canvas);

        appRef.current = app;
        containerRef.current = container;
        spriteRef.current = sprite;
        separatorRef.current = separators;
        selectionRef.current = selection;
        focusRef.current = focus;
        axisRef.current = axis;
        setPixiReady(true);
      });

    return () => {
      disposed = true;
      appRef.current = null;
      containerRef.current = null;
      spriteRef.current = null;
      separatorRef.current = null;
      selectionRef.current = null;
      focusRef.current = null;
      axisRef.current = null;

      if (initialized) {
        app.destroy(true, { children: true });
      }
    };
  }, []);

  useEffect(() => {
    if (!pixiReady) return;
    appRef.current?.renderer.resize(size.width, size.height);
  }, [pixiReady, size.height, size.width]);

  useEffect(() => {
    if (!pixiReady) return;
    const sprite = spriteRef.current;
    if (!sprite) return;

    sprite.texture = getWallTexture(
      inspection.id,
      selectedWall,
      wallData,
      colorRange,
      displayMode,
      displayRange,
    );
    sprite.x = 0;
    sprite.y = 0;
    sprite.width = bounds.width;
    sprite.height = bounds.height;
  }, [
    bounds.height,
    bounds.width,
    colorRange,
    displayMode,
    displayRange,
    inspection.id,
    pixiReady,
    selectedWall,
    wallData,
  ]);

  useEffect(() => {
    if (!pixiReady) return;
    const container = containerRef.current;
    if (!container) return;

    container.position.set(pan.x, pan.y);
    container.scale.set(zoom);
  }, [pan.x, pan.y, pixiReady, zoom]);

  useEffect(() => {
    if (!pixiReady) return;
    const graphics = separatorRef.current;
    if (!graphics) return;

    graphics.clear();
    for (let tubeIndex = 1; tubeIndex < tubeCount; tubeIndex += 1) {
      const x = tubeIndex * pitch;
      graphics.moveTo(x, 0);
      graphics.lineTo(x, bounds.height);
    }
    graphics.stroke({ width: Math.max(1 / zoom, 0.2), color: 0x111827, alpha: 0.18 });
  }, [bounds.height, pitch, pixiReady, tubeCount, zoom]);

  useEffect(() => {
    if (!pixiReady) return;
    const graphics = selectionRef.current;
    if (!graphics) return;

    graphics.clear();
    if (!selectedCell || selectedCell.wall !== selectedWall) return;

    const x = (selectedCell.tube - 1) * pitch + (pitch - diameter) / 2;
    const band = elevationBands[selectedCell.rowIndex];
    if (!band) return;

    const y = bounds.height - band.upper;
    const height = Math.max(band.upper - band.lower, rowHeight);
    graphics.rect(x, y, diameter, height);
    graphics.stroke({ width: Math.max(2 / zoom, 0.4), color: 0x111827, alpha: 0.95 });
  }, [bounds.height, diameter, elevationBands, pitch, pixiReady, rowHeight, selectedCell, selectedWall, zoom]);

  useEffect(() => {
    if (!pixiReady) return undefined;
    const graphics = focusRef.current;
    const app = appRef.current;
    if (!graphics || !app) return undefined;

    const drawFocus = () => {
      graphics.clear();
      if (!focusedArea) return;

      const padding = pitch * 0.18;
      const pulse = (Math.sin(performance.now() / 180) + 1) / 2;
      const x = (focusedArea.minTube - 1) * pitch + padding;
      const y = bounds.height - focusedArea.maxUpper;
      const width = (focusedArea.maxTube - focusedArea.minTube + 1) * pitch - padding * 2;
      const height = Math.max(focusedArea.maxUpper - focusedArea.minLower, rowHeight);

      graphics.roundRect(x, y, width, height, Math.max(1 / zoom, 0.3));
      graphics.fill({ color: 0xfff3a0, alpha: 0.08 + pulse * 0.06 });
      graphics.stroke({
        width: Math.max((2.4 + pulse * 2.6) / zoom, 0.55),
        color: 0xfff3a0,
        alpha: 0.72,
      });
    };

    app.ticker.add(drawFocus);

    return () => {
      app.ticker.remove(drawFocus);
      graphics.clear();
    };
  }, [bounds.height, focusedArea, pitch, pixiReady, rowHeight, zoom]);

  useEffect(() => {
    if (!pixiReady) return;
    const axis = axisRef.current;
    if (!axis) return;

    axis.removeChildren().forEach((child) => child.destroy());

    const graphics = new Graphics();
    const screenLeft = Math.max(0, pan.x);
    const screenBottom = Math.min(size.height, pan.y + bounds.height * zoom);
    const screenRight = Math.min(size.width, pan.x + bounds.width * zoom);
    const tubeStep = Math.max(1, Math.ceil(72 / Math.max(pitch * zoom, 1)));
    const visibleFirstTube = Math.max(0, Math.floor(-pan.x / (pitch * zoom)));
    const visibleLastTube = Math.min(tubeCount - 1, Math.ceil((size.width - pan.x) / (pitch * zoom)));
    const elevationStep = getNiceStep(70 / Math.max(zoom, 0.0001));
    const maxElevation = bounds.height;

    for (
      let tubeIndex = Math.ceil(visibleFirstTube / tubeStep) * tubeStep;
      tubeIndex <= visibleLastTube;
      tubeIndex += tubeStep
    ) {
      const x = pan.x + (tubeIndex * pitch + pitch / 2) * zoom;
      graphics.moveTo(x, 0);
      graphics.lineTo(x, size.height);
      axis.addChild(makeAxisLabel(String(tubeIndex + 1), x, clamp(screenBottom - 12, 12, size.height - 14)));
    }

    for (let elevation = 0; elevation <= maxElevation; elevation += elevationStep) {
      const y = pan.y + (bounds.height - elevation) * zoom;
      if (y < 0 || y > size.height) continue;

      graphics.moveTo(0, y);
      graphics.lineTo(size.width, y);
      axis.addChild(makeAxisLabel(String(Math.round(elevation)), clamp(screenLeft - 8, 36, size.width - 4), y, 'right'));
    }

    graphics.stroke({ width: 1, color: GRID_COLOR, alpha: 0.18 });
    graphics.moveTo(screenLeft, 0);
    graphics.lineTo(screenLeft, size.height);
    graphics.moveTo(0, screenBottom);
    graphics.lineTo(size.width, screenBottom);
    graphics.stroke({ width: 1, color: AXIS_COLOR, alpha: 0.58 });
    axis.addChildAt(graphics, 0);
    axis.addChild(makeAxisLabel('Tube', clamp((screenLeft + screenRight) / 2, 50, size.width - 50), size.height - 10));
    axis.addChild(makeAxisLabel('Elevation mm', 42, 14, 'left'));
  }, [bounds.height, bounds.width, pan.x, pan.y, pitch, pixiReady, size.height, size.width, tubeCount, zoom]);

  const getCellFromPointer = useCallback(
    (clientX, clientY) => {
      const box = hostRef.current.getBoundingClientRect();
      const localX = clientX - box.left;
      const localY = clientY - box.top;
      const worldX = (localX - pan.x) / zoom;
      const worldY = (localY - pan.y) / zoom;
      const elevation = bounds.height - worldY;
      const tubeIndex = Math.floor(worldX / pitch);
      const tubeNumber = tubeIndex + 1;
      const dataTubeIndex = tubeNumberToDataIndex.get(tubeNumber);
      const rowIndex = elevationBands.findIndex(
        (band) => elevation >= band.lower && elevation <= band.upper,
      );
      const tubeX = worldX - tubeIndex * pitch;
      const tubeStart = (pitch - diameter) / 2;
      const tubeEnd = tubeStart + diameter;

      if (
        tubeIndex < 0 ||
        tubeIndex >= tubeCount ||
        dataTubeIndex === undefined ||
        rowIndex < 0 ||
        rowIndex >= rowCount
      ) {
        return null;
      }

      if (tubeX < tubeStart || tubeX > tubeEnd) {
        return null;
      }

      const thickness = wallData.values[rowIndex * dataTubeCount + dataTubeIndex];
      const displayValue = getDisplayValue(thickness, displayMode, wallData.tubeNominal);

      return {
        rowIndex,
        dataTubeIndex,
        tubeIndex,
        tube: tubeNumber,
        elevation: wallData.elevations[rowIndex],
        thickness: Number.isFinite(thickness) ? thickness : null,
        displayMode,
        displayValue: Number.isFinite(displayValue) ? displayValue : null,
        displayLabel: formatMeasurement(displayValue, displayMode),
        inspectionName: inspection.inspectionName,
        wall: selectedWall,
        screenX: clientX,
        screenY: clientY,
      };
    },
    [
      inspection.inspectionName,
      bounds.height,
      elevationBands,
      pan.x,
      pan.y,
      pitch,
      rowCount,
      selectedWall,
      tubeCount,
      diameter,
      dataTubeCount,
      displayMode,
      wallData.elevations,
      wallData.tubeNominal,
      wallData.values,
      tubeNumberToDataIndex,
      zoom,
    ],
  );

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pan,
      moved: false,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;

    if (drag?.pointerId === event.pointerId) {
      const nextPan = {
        x: drag.pan.x + event.clientX - drag.startX,
        y: drag.pan.y + event.clientY - drag.startY,
      };
      drag.moved = Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 3;
      setPan(nextPan);
      return;
    }

    setHoverCell(getCellFromPointer(event.clientX, event.clientY));
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    const shouldSelect = drag?.pointerId === event.pointerId && !drag.moved;
    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (shouldSelect) {
      setSelectedCell(getCellFromPointer(event.clientX, event.clientY));
    }
  };

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 1 / 1.12 : 1.12;
    const nextZoom = clamp(zoom * factor, 0.01, 64);
    const box = hostRef.current.getBoundingClientRect();
    const pointer = {
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    };
    const world = {
      x: (pointer.x - pan.x) / zoom,
      y: (pointer.y - pan.y) / zoom,
    };

    setZoom(nextZoom);
    setPan({
      x: pointer.x - world.x * nextZoom,
      y: pointer.y - world.y * nextZoom,
    });
  }, [pan.x, pan.y, setPan, setZoom, zoom]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return undefined;

    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  return (
    <div
      ref={hostRef}
      className="pixi-stage"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => setHoverCell(null)}
    >
      <Tooltip cell={hoverCell} />
    </div>
  );
}

export default PixiCanvas;
