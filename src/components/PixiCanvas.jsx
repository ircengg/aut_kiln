import { Application, Container, Graphics, Sprite, Text as PixiText } from 'pixi.js';
import { useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hoverCellAtom,
  panAtom,
  selectedCellAtom,
  selectedWallAtom,
  zoomAtom,
} from '../state/inspectionAtoms';
import { getWallTexture } from '../utils/textureCache';
import { formatMeasurement, getDisplayValue } from '../utils/measurements';
import Tooltip from './Tooltip';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const AXIS_COLOR = 0x1f2937;
const GRID_COLOR = 0x64748b;

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
      fill: '#1f2937',
      fontFamily: 'system-ui, Segoe UI, sans-serif',
      fontSize: 11,
      fontWeight: '500',
    },
  });

  label.anchor.set(align === 'right' ? 1 : align === 'left' ? 0 : 0.5, 0.5);
  label.position.set(x, y);

  return label;
}

function PixiCanvas({ inspection, wallData, bounds, size, colorRange, displayMode, displayRange }) {
  const hostRef = useRef(null);
  const appRef = useRef(null);
  const containerRef = useRef(null);
  const spriteRef = useRef(null);
  const separatorRef = useRef(null);
  const selectionRef = useRef(null);
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
  const rowCount = wallData.height || wallData.elevations.length || 0;
  const rowHeight = bounds.height / Math.max(rowCount, 1);
  const diameter = Math.min(wallData.tubeDiameter || pitch * 0.72, pitch * 0.92);

  useEffect(() => {
    let disposed = false;
    let initialized = false;
    const app = new Application();
    const container = new Container();
    const sprite = new Sprite();
    const separators = new Graphics();
    const selection = new Graphics();
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

        container.addChild(sprite, separators, selection);
        app.stage.addChild(container, axis);
        hostRef.current.appendChild(app.canvas);

        appRef.current = app;
        containerRef.current = container;
        spriteRef.current = sprite;
        separatorRef.current = separators;
        selectionRef.current = selection;
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

    const x = selectedCell.tubeIndex * pitch + (pitch - diameter) / 2;
    const flippedY = (rowCount - 1 - selectedCell.rowIndex) * rowHeight;
    graphics.rect(x, flippedY, diameter, rowHeight);
    graphics.stroke({ width: Math.max(2 / zoom, 0.4), color: 0x111827, alpha: 0.95 });
  }, [diameter, pitch, pixiReady, rowCount, rowHeight, selectedCell, selectedWall, zoom]);

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
      axis.addChild(makeAxisLabel(String(tubeIndex + 1), x, clamp(screenBottom + 12, 12, size.height - 10)));
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
    graphics.stroke({ width: 1, color: AXIS_COLOR, alpha: 0.35 });
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
      const tubeIndex = Math.floor(worldX / pitch);
      const rowFromTop = Math.floor(worldY / rowHeight);
      const rowIndex = rowCount - 1 - rowFromTop;
      const tubeX = worldX - tubeIndex * pitch;
      const tubeStart = (pitch - diameter) / 2;
      const tubeEnd = tubeStart + diameter;

      if (tubeIndex < 0 || tubeIndex >= tubeCount || rowIndex < 0 || rowIndex >= rowCount) {
        return null;
      }

      if (tubeX < tubeStart || tubeX > tubeEnd) {
        return null;
      }

      const thickness = wallData.values[rowIndex * tubeCount + tubeIndex];
      const displayValue = getDisplayValue(thickness, displayMode, wallData.tubeNominal);

      return {
        rowIndex,
        tubeIndex,
        tube: tubeIndex + 1,
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
      pan.x,
      pan.y,
      pitch,
      rowCount,
      rowHeight,
      selectedWall,
      tubeCount,
      diameter,
      displayMode,
      wallData.elevations,
      wallData.tubeNominal,
      wallData.values,
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
