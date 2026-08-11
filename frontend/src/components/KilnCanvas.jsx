import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { GizmoHelper, GizmoViewcube, Html, Line, OrbitControls } from '@react-three/drei';
import { useAtom, useAtomValue } from 'jotai';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { hoverCellAtom, selectedCellAtom, selectedWallAtom } from '../state/inspectionAtoms';
import { getWallLossRgba } from '../utils/heatmap';
import { formatMeasurement, getDisplayValue } from '../utils/measurements';
import Tooltip from './Tooltip';

const WORLD_SCALE = 0.001;
const seededUnit = (index, salt = 0) => {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

function makeSurfaceGeometry(data, displayMode, displayRange, colorRange, exaggeration) {
  const rows = data.circumferencePositions || data.elevations || [];
  const columns = data.axialPositions || data.tubeNumbers || [];
  const columnCount = columns.length;
  const positions = new Float32Array(rows.length * columnCount * 3);
  const colors = new Float32Array(rows.length * columnCount * 3);
  const readings = new Array(rows.length * columnCount);
  const valid = new Uint8Array(rows.length * columnCount);
  const indices = [];
  const nominal = data.tubeNominal;
  const axialStart = data.axialStart || 0;
  const sectionLength = Math.max(data.axialLength || data.axialMax || 1, 1);
  const min = colorRange?.min ?? displayRange?.min;
  const max = colorRange?.max ?? displayRange?.max;

  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      const index = row * columnCount + column;
      const thickness = data.values[index];
      const sourceAxial = columns[column];
      const isAbsoluteAxial = data.axialCoordinatesAbsolute;
      const localAxial = isAbsoluteAxial ? sourceAxial - axialStart : sourceAxial;
      const axial = axialStart + localAxial;
      const interpolation = THREE.MathUtils.clamp(localAxial / sectionLength, 0, 1);
      const baseRadius = THREE.MathUtils.lerp(data.radiusStart || 1, data.radiusEnd || data.radiusStart || 1, interpolation);
      const angle = rows[row] / baseRadius;
      const corrosionDepth = Number.isFinite(nominal) && Number.isFinite(thickness)
        ? Math.max(0, nominal - thickness) * exaggeration
        : 0;
      const radius = Math.max(baseRadius - corrosionDepth, baseRadius * 0.75);
      const offset = index * 3;
      positions[offset] = axial * WORLD_SCALE;
      positions[offset + 1] = radius * Math.cos(angle) * WORLD_SCALE;
      positions[offset + 2] = radius * Math.sin(angle) * WORLD_SCALE;

      if (!Number.isFinite(thickness)) {
        colors.set([0.08, 0.1, 0.11], offset);
        continue;
      }
      valid[index] = 1;
      const displayValue = getDisplayValue(thickness, displayMode, nominal);
      const rgba = getWallLossRgba(displayValue);
      const inRange = Number.isFinite(displayValue) && displayValue >= min && displayValue <= max;
      const renderedColor = inRange ? rgba : [188, 194, 202, 255];
      colors[offset] = renderedColor[0] / 255;
      colors[offset + 1] = renderedColor[1] / 255;
      colors[offset + 2] = renderedColor[2] / 255;
      readings[index] = { rowIndex: row, dataTubeIndex: column, circumference: rows[row], axial: sourceAxial, angle, thickness, displayValue };
    }
  }

  for (let row = 0; row < rows.length - 1; row += 1) {
    for (let column = 0; column < columnCount - 1; column += 1) {
      const a = row * columnCount + column;
      const b = a + columnCount;
      const c = b + 1;
      const d = a + 1;
      if (valid[a] && valid[b] && valid[d]) indices.push(a, b, d);
      if (valid[b] && valid[c] && valid[d]) indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const maxRadius = Math.max(data.radiusStart || 1, data.radiusEnd || data.radiusStart || 1) * WORLD_SCALE;
  const kilnBounds = new THREE.Box3(
    new THREE.Vector3(axialStart * WORLD_SCALE, -maxRadius, -maxRadius),
    new THREE.Vector3((axialStart + sectionLength) * WORLD_SCALE, maxRadius, maxRadius),
  );
  geometry.boundingSphere = kilnBounds.getBoundingSphere(new THREE.Sphere());
  geometry.userData.readings = readings;
  return geometry;
}

function CameraRig({ controlsRef, cameraApiRef, bounds, focusedArea, wallData, viewRequest }) {
  const { camera, size } = useThree();
  useEffect(() => {
    cameraApiRef.current = {
      setView(view) {
        const sphere = bounds;
        if (!sphere) return;
        const distance = Math.max(sphere.radius * 2.8, 2);
        const directions = {
          top: [0, 1, 0.001],
          front: [0, 0, 1],
          back: [0, 0, -1],
          side: [1, 0, 0],
        };
        const direction = directions[view] || directions.front;
        camera.position.set(
          sphere.center.x + direction[0] * distance,
          sphere.center.y + direction[1] * distance,
          sphere.center.z + direction[2] * distance,
        );
        camera.up.set(0, 1, 0);
        controlsRef.current?.target.copy(sphere.center);
        controlsRef.current?.update();
      },
    };
    return () => { cameraApiRef.current = null; };
  }, [bounds, camera, cameraApiRef, controlsRef]);
  useEffect(() => {
    if (!bounds) return;
    const sphere = bounds;
    const distance = Math.max(sphere.radius * 2.8, 2);
    camera.position.set(sphere.center.x + distance * 0.7, distance * 0.55, distance);
    camera.near = Math.max(distance / 1000, 0.001);
    camera.far = distance * 100;
    if (camera.isOrthographicCamera) {
      camera.zoom = Math.max(18, Math.min(size.width, size.height) / (Math.max(sphere.radius * 2, 0.1) * 1.35));
    }
    camera.updateProjectionMatrix();
    controlsRef.current?.target.copy(sphere.center);
    controlsRef.current?.update();
  }, [bounds, camera, controlsRef, size.height, size.width, viewRequest]);
  useEffect(() => {
    if (!focusedArea || !camera.isOrthographicCamera) return undefined;
    const sourceAxial = focusedArea.centerAxial;
    const localAxial = wallData.axialCoordinatesAbsolute
      ? sourceAxial - (wallData.axialStart || 0)
      : sourceAxial;
    const axial = (wallData.axialStart || 0) + localAxial;
    const fraction = THREE.MathUtils.clamp(localAxial / Math.max(wallData.axialLength || 1, 1), 0, 1);
    const radiusMm = THREE.MathUtils.lerp(wallData.radiusStart || 1, wallData.radiusEnd || wallData.radiusStart || 1, fraction);
    const angle = focusedArea.centerCircumference / radiusMm;
    const radius = radiusMm * WORLD_SCALE;
    const target = new THREE.Vector3(axial * WORLD_SCALE, radius * Math.cos(angle), radius * Math.sin(angle));
    const radial = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle));
    const distance = Math.max(bounds.radius * 2.4, 2);
    const destination = target.clone().addScaledVector(radial, distance);
    const axialSpan = Math.max((focusedArea.maxAxial - focusedArea.minAxial) * WORLD_SCALE, 0.08);
    const circumferenceSpan = Math.max((focusedArea.maxCircumference - focusedArea.minCircumference) * WORLD_SCALE, 0.08);
    const fitZoom = Math.max(
      18,
      Math.min(size.width, size.height) / (Math.max(bounds.radius * 2, 0.1) * 1.35),
    );
    const detailZoom = Math.min(
      size.width / (axialSpan * 2.8),
      size.height / (circumferenceSpan * 2.8),
    );
    const targetZoom = THREE.MathUtils.clamp(detailZoom, fitZoom * 1.15, fitZoom * 2.4);
    const startPosition = camera.position.clone();
    const startTarget = controlsRef.current?.target.clone() || new THREE.Vector3();
    const startZoom = camera.zoom;
    const startedAt = performance.now();
    let frame;
    const animate = (now) => {
      const progress = Math.min((now - startedAt) / 720, 1);
      const eased = 1 - (1 - progress) ** 3;
      camera.position.lerpVectors(startPosition, destination, eased);
      camera.zoom = THREE.MathUtils.lerp(startZoom, targetZoom, eased);
      controlsRef.current?.target.lerpVectors(startTarget, target, eased);
      camera.updateProjectionMatrix();
      controlsRef.current?.update();
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [bounds.radius, camera, controlsRef, focusedArea, size.height, size.width, wallData]);
  return null;
}

function ringPoints(x, radius, segments = 96) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return [x, radius * Math.cos(angle), radius * Math.sin(angle)];
  });
}

function KilnReferenceGrid({ sections, showLabels }) {
  const bodySections = sections.filter((section) => !/tyre|tire|support|ring/i.test(section.name));
  const gridSections = bodySections.length ? bodySections : sections;
  const start = Math.min(...gridSections.map((section) => section.axialStart || 0));
  const end = Math.max(...gridSections.map((section) => (section.axialStart || 0) + (section.axialLength || 0)));
  const maxRadius = Math.max(...gridSections.flatMap((section) => [section.radiusStart || 1, section.radiusEnd || section.radiusStart || 1])) * WORLD_SCALE;
  const radiusAt = (axial) => {
    const section = gridSections.find((item) => axial >= (item.axialStart || 0) && axial <= (item.axialStart || 0) + (item.axialLength || 0));
    if (!section) return maxRadius / WORLD_SCALE;
    const local = axial - (section.axialStart || 0);
    const fraction = THREE.MathUtils.clamp(local / Math.max(section.axialLength || 1, 1), 0, 1);
    return THREE.MathUtils.lerp(section.radiusStart || 1, section.radiusEnd || section.radiusStart || 1, fraction);
  };
  const rawStep = Math.max((end - start) / 6, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.ceil(rawStep / magnitude) * magnitude;
  const axialTicks = [];
  for (let value = Math.ceil(start / step) * step; value <= end; value += step) axialTicks.push(value);

  return (
    <group>
      {axialTicks.map((value) => (
        <group key={value}>
          <Line points={ringPoints(value * WORLD_SCALE, radiusAt(value) * WORLD_SCALE * 1.012, 72)} color="#7f969c" lineWidth={0.65} transparent opacity={0.5} />
          {showLabels && <Html position={[value * WORLD_SCALE, -radiusAt(value) * WORLD_SCALE * 1.18, 0]} center><span className="kiln-grid-label">{value.toLocaleString()} mm</span></Html>}
        </group>
      ))}
      {Array.from({ length: 12 }, (_, index) => index * 30).map((degrees) => {
        const angle = THREE.MathUtils.degToRad(degrees);
        const linePoints = Array.from({ length: 65 }, (_, index) => {
          const axial = start + (index / 64) * (end - start);
          const radius = radiusAt(axial) * WORLD_SCALE * 1.015;
          return [axial * WORLD_SCALE, radius * Math.cos(angle), radius * Math.sin(angle)];
        });
        const startRadius = radiusAt(start) * WORLD_SCALE * 1.015;
        const y = startRadius * Math.cos(angle);
        const z = startRadius * Math.sin(angle);
        return (
          <group key={degrees}>
            <Line points={linePoints} color="#66858c" lineWidth={degrees % 90 === 0 ? 0.9 : 0.45} transparent opacity={degrees % 90 === 0 ? 0.62 : 0.32} />
            {showLabels && <Html position={[start * WORLD_SCALE - 0.25, y, z]} center><span className="kiln-grid-label kiln-angle-label">{degrees}°</span></Html>}
          </group>
        );
      })}
      {showLabels && <Html position={[(start + end) * 0.5 * WORLD_SCALE, -maxRadius * 1.42, 0]} center><span className="kiln-axis-label">AXIAL DISTANCE (mm) →</span></Html>}
      {showLabels && <Html position={[start * WORLD_SCALE, maxRadius * 1.42, 0]} center><span className="kiln-axis-label">CIRCUMFERENCE / ANGLE ↻</span></Html>}
    </group>
  );
}

function KilnProcessInterior({ sections, active }) {
  const flameRef = useRef();
  const glowRef = useRef();
  const particlesRef = useRef();
  const dustRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const start = Math.min(...sections.map((section) => section.axialStart || 0)) * WORLD_SCALE;
  const end = Math.max(...sections.map((section) => (section.axialStart || 0) + (section.axialLength || 0))) * WORLD_SCALE;
  const length = Math.max(end - start, 0.1);
  const innerRadius = Math.min(...sections.flatMap((section) => [section.radiusStart || 1, section.radiusEnd || section.radiusStart || 1])) * WORLD_SCALE * 0.78;
  const particles = useMemo(() => Array.from({ length: 900 }, (_, index) => {
    const seed = seededUnit(index, 1);
    const seed2 = seededUnit(index, 2);
    const seed3 = seededUnit(index, 3);
    return {
      axial: (index + seed) / 900,
      angle: Math.PI * (0.62 + seed2 * 0.76),
      radius: innerRadius * (0.26 + seed3 * 0.64),
      size: 0.055 + seed2 * 0.13,
      speed: 0.11 + seed3 * 0.34,
      wobble: seed * Math.PI * 2,
      color: seed3 > 0.72 ? '#e09a3d' : seed2 > 0.48 ? '#a9672d' : '#6f4327',
    };
  }), [innerRadius]);
  const flames = useMemo(() => Array.from({ length: 20 }, (_, index) => ({
    axialOffset: (index / 19) * length * 0.88,
    radialOffset: (seededUnit(index, 7) - 0.5) * innerRadius * 0.38,
    lateralOffset: (seededUnit(index, 8) - 0.5) * innerRadius * 0.38,
    radius: innerRadius * (0.11 + seededUnit(index, 9) * 0.12),
    length: Math.min(length * (0.035 + seededUnit(index, 10) * 0.035), innerRadius * 1.8),
    phase: seededUnit(index, 11) * Math.PI * 2,
  })), [innerRadius, length]);
  const dust = useMemo(() => {
    const values = new Float32Array(520 * 3);
    for (let index = 0; index < 520; index += 1) {
      const seed = seededUnit(index, 4);
      const seed2 = seededUnit(index, 5);
      const seed3 = seededUnit(index, 6);
      values[index * 3] = start + ((index + seed) / 520) * length;
      values[index * 3 + 1] = (seed2 - 0.5) * innerRadius * 1.25;
      values[index * 3 + 2] = (seed3 - 0.5) * innerRadius * 1.25;
    }
    return values;
  }, [innerRadius, length, start]);

  useEffect(() => {
    if (!particlesRef.current) return;
    particles.forEach((particle, index) => particlesRef.current.setColorAt(index, new THREE.Color(particle.color)));
    if (particlesRef.current.instanceColor) particlesRef.current.instanceColor.needsUpdate = true;
  }, [active, particles]);

  useFrame(({ clock }) => {
    if (!active) return;
    const time = clock.getElapsedTime();
    if (flameRef.current) {
      flameRef.current.children.forEach((flame, index) => {
        const config = flames[index];
        const pulse = 0.82 + Math.sin(time * (7.4 + index * 0.31) + config.phase) * 0.13 + Math.sin(time * 13.2 + index) * 0.05;
        flame.scale.set(0.8 + index * 0.06, pulse, pulse * (0.82 + (index % 3) * 0.09));
        flame.position.y = config.axialOffset + Math.sin(time * (2.8 + index * 0.11) + config.phase) * innerRadius * 0.035;
        flame.position.x = config.radialOffset + Math.sin(time * (5.2 + index * 0.13) + index) * innerRadius * 0.08;
        flame.position.z = config.lateralOffset + Math.cos(time * (4.7 + index * 0.17) + index * 1.7) * innerRadius * 0.08;
      });
    }
    if (glowRef.current) glowRef.current.intensity = 2.2 + Math.sin(time * 7) * 0.45;
    if (particlesRef.current) {
      particles.forEach((particle, index) => {
        const tumble = particle.angle + time * particle.speed;
        const axialDrift = (particle.axial + time * (0.003 + particle.speed * 0.006)) % 1;
        const cascade = Math.max(0, Math.sin(tumble)) * Math.sin(time * 2.4 + particle.wobble) * innerRadius * 0.12;
        dummy.position.set(
          start + axialDrift * length,
          Math.cos(tumble) * particle.radius - innerRadius * 0.22 - cascade,
          Math.sin(tumble) * particle.radius + cascade * 0.45,
        );
        dummy.rotation.set(tumble, time * particle.speed, tumble * 0.5);
        dummy.scale.setScalar(particle.size);
        dummy.updateMatrix();
        particlesRef.current.setMatrixAt(index, dummy.matrix);
      });
      particlesRef.current.instanceMatrix.needsUpdate = true;
    }
    if (dustRef.current) {
      const positions = dustRef.current.geometry.attributes.position.array;
      for (let index = 0; index < positions.length / 3; index += 1) {
        const offset = index * 3;
        positions[offset] += 0.00045 + (index % 7) * 0.000025;
        if (positions[offset] > end) positions[offset] = start;
        positions[offset + 1] += Math.sin(time * 0.9 + index * 1.37) * 0.00035;
        positions[offset + 2] += Math.cos(time * 0.75 + index * 0.91) * 0.0003;
      }
      dustRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (!active) return null;

  return (
    <group>
      <group ref={flameRef} position={[end - length * 0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        {flames.map((flame, index) => (
          <mesh key={index} position={[flame.radialOffset, flame.axialOffset, flame.lateralOffset]}>
            <coneGeometry args={[
              flame.radius,
              flame.length,
              18,
              1,
              true,
            ]} />
            <meshBasicMaterial
              color={index % 3 === 0 ? '#fff2a1' : index % 2 === 0 ? '#ff9b24' : '#ff4b12'}
              transparent
              opacity={0.48 + (index % 3) * 0.13}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
      <pointLight ref={glowRef} position={[end - length * 0.18, 0, 0]} color="#ff7a1a" intensity={2.4} distance={Math.max(length * 0.65, innerRadius * 5)} decay={1.5} />
      <instancedMesh ref={particlesRef} args={[undefined, undefined, particles.length]} frustumCulled={false} renderOrder={5}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#b97831" emissive="#7a310d" emissiveIntensity={0.7} roughness={0.9} depthTest={false} depthWrite={false} />
      </instancedMesh>
      <points ref={dustRef} frustumCulled={false} renderOrder={6}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dust, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#d6a463" size={0.075} transparent opacity={0.6} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}

function KilnNozzles({ nozzles = [], sections, showLabels }) {
  return nozzles.map((nozzle) => {
    const candidates = sections.filter((section) => {
      const start = section.axialStart || 0;
      return nozzle.axialPosition >= start && nozzle.axialPosition <= start + (section.axialLength || 0);
    });
    const section = candidates.sort((a, b) =>
      Math.max(b.radiusStart || 0, b.radiusEnd || 0) - Math.max(a.radiusStart || 0, a.radiusEnd || 0),
    )[0];
    if (!section) return null;
    const localAxial = nozzle.axialPosition - (section.axialStart || 0);
    const fraction = THREE.MathUtils.clamp(localAxial / Math.max(section.axialLength || 1, 1), 0, 1);
    const radius = THREE.MathUtils.lerp(section.radiusStart || 1, section.radiusEnd || section.radiusStart || 1, fraction) * WORLD_SCALE;
    const radial = new THREE.Vector3(0, Math.cos(nozzle.angle), Math.sin(nozzle.angle));
    const position = new THREE.Vector3(nozzle.axialPosition * WORLD_SCALE, 0, 0).addScaledVector(radial, radius);
    const labelPosition = position.clone().addScaledVector(radial, Math.max(nozzle.diameter * WORLD_SCALE * 1.78, 0.22));
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
    const nozzleRadius = Math.max(nozzle.diameter * WORLD_SCALE / 2, 0.025);
    const neckLength = Math.max(nozzle.diameter * WORLD_SCALE * 1.15, 0.12);

    return (
      <group key={nozzle.id}>
        <group position={position.toArray()} quaternion={quaternion.toArray()}>
          <mesh position={[0, neckLength / 2, 0]}>
            <cylinderGeometry args={[nozzleRadius, nozzleRadius, neckLength, 28, 1, true]} />
            <meshStandardMaterial color="#718a91" metalness={0.62} roughness={0.32} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, neckLength, 0]}>
            <cylinderGeometry args={[nozzleRadius * 1.42, nozzleRadius * 1.42, Math.max(nozzleRadius * 0.34, 0.025), 32]} />
            <meshStandardMaterial color="#eef4f5" metalness={0.68} roughness={0.25} />
          </mesh>
          <mesh position={[0, neckLength * 1.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[nozzleRadius * 1.08, nozzleRadius * 0.12, 10, 32]} />
            <meshStandardMaterial color="#4f686e" metalness={0.72} roughness={0.26} />
          </mesh>
        </group>
        {showLabels && <Html position={labelPosition.toArray()} center>
          <span className="kiln-nozzle-label">
            {nozzle.name} · Ø{nozzle.diameter} mm · {nozzle.axialPosition} mm · {nozzle.circumferenceDegrees}°
          </span>
        </Html>}
      </group>
    );
  });
}

function Surface({ geometry, inspection, wallData, displayMode, reveal, rotating, focusedArea, showLabels, showGrid }) {
  const groupRef = useRef();
  const selectedWall = useAtomValue(selectedWallAtom);
  const [, setHoverCell] = useAtom(hoverCellAtom);
  const [, setSelectedCell] = useAtom(selectedCellAtom);
  const sections = inspection.sections?.filter((section) => section.assetType === 'kiln') || [wallData];

  useFrame((_, delta) => {
    if (rotating && groupRef.current) groupRef.current.rotation.x += delta * 0.22;
  });

  const getReading = (event) => {
    const vertexIndex = event.face?.a;
    const reading = geometry.userData.readings?.[vertexIndex];
    if (!reading) return null;
    return {
      ...reading,
      tube: reading.axial,
      elevation: reading.circumference,
      lengthLabel: 'Circumference',
      section: selectedWall,
      wall: selectedWall,
      sectionName: wallData.name || selectedWall,
      inspectionName: inspection.inspectionName,
      displayMode,
      displayLabel: formatMeasurement(reading.displayValue, displayMode),
      source: `${inspection.fileName} / ${wallData.sheetName}`,
      screenX: event.nativeEvent.offsetX,
      screenY: event.nativeEvent.offsetY,
    };
  };

  return (
    <group ref={groupRef} scale={[reveal, reveal, reveal]}>
      {sections.map((section) => {
        const length = (section.axialLength || 1) * WORLD_SCALE;
        const start = (section.axialStart || 0) * WORLD_SCALE;
        const radiusStart = (section.radiusStart || 1) * WORLD_SCALE;
        const radiusEnd = (section.radiusEnd || section.radiusStart || 1) * WORLD_SCALE;
        const isSelected = section.id === selectedWall;
        return (
          <group key={section.id}>
            <mesh position={[start + length / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <cylinderGeometry args={[radiusEnd, radiusStart, length, 96, 1, true]} />
              <meshStandardMaterial color={isSelected ? '#267984' : '#9aacb0'} transparent opacity={isSelected ? 0.3 : 0.16} depthWrite={false} side={THREE.DoubleSide} roughness={0.8} metalness={0.15} />
            </mesh>
            <Line points={ringPoints(start, radiusStart * 1.012)} color="#ffffff" lineWidth={2} />
            <Line points={ringPoints(start + length, radiusEnd * 1.012)} color="#ffffff" lineWidth={2} />
            {showLabels && <Html position={[start + length / 2, radiusStart * 1.12, 0]} center>
              <span className={`kiln-section-label ${isSelected ? 'is-active' : ''}`}>
                {section.name} · {section.axialStart || 0}–{(section.axialStart || 0) + (section.axialLength || 0)} mm
              </span>
            </Html>}
          </group>
        );
      })}
      <KilnNozzles nozzles={inspection.nozzles} sections={sections} showLabels={showLabels} />
      {rotating && <KilnProcessInterior sections={sections} active />}
      {showGrid && <KilnReferenceGrid sections={sections} showLabels={showLabels} />}
      <mesh
        geometry={geometry}
        onPointerMove={(event) => { event.stopPropagation(); setHoverCell(getReading(event)); }}
        onPointerOut={() => setHoverCell(null)}
        onClick={(event) => { event.stopPropagation(); setSelectedCell(getReading(event)); }}
      >
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {focusedArea && (
        <mesh position={(() => {
          const sourceAxial = focusedArea.centerAxial;
          const localAxial = wallData.axialCoordinatesAbsolute ? sourceAxial - (wallData.axialStart || 0) : sourceAxial;
          const axial = (wallData.axialStart || 0) + localAxial;
          const fraction = THREE.MathUtils.clamp(localAxial / Math.max(wallData.axialLength || 1, 1), 0, 1);
          const radius = THREE.MathUtils.lerp(wallData.radiusStart || 1, wallData.radiusEnd || wallData.radiusStart || 1, fraction);
          const angle = focusedArea.centerCircumference / radius;
          return [axial * WORLD_SCALE, radius * Math.cos(angle) * WORLD_SCALE, radius * Math.sin(angle) * WORLD_SCALE];
        })()}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshBasicMaterial color="#fff3a0" transparent opacity={0.95} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

const KilnCanvas = forwardRef(function KilnCanvas({ inspection, wallData, colorRange, displayMode, displayRange, focusedArea, exaggeration = 1, rotating = false, reveal = 1, showLabels = true, showGrid = true }, ref) {
  const controlsRef = useRef();
  const cameraApiRef = useRef();
  const [viewRequest, setViewRequest] = useState(0);
  const geometry = useMemo(
    () => makeSurfaceGeometry(wallData, displayMode, displayRange, colorRange, exaggeration),
    [colorRange, displayMode, displayRange, exaggeration, wallData],
  );
  const assemblyBounds = useMemo(() => {
    const sections = inspection.sections?.filter((section) => section.assetType === 'kiln') || [wallData];
    const start = Math.min(...sections.map((section) => section.axialStart || 0)) * WORLD_SCALE;
    const end = Math.max(...sections.map((section) => (section.axialStart || 0) + (section.axialLength || 0))) * WORLD_SCALE;
    const radius = Math.max(...sections.flatMap((section) => [section.radiusStart || 1, section.radiusEnd || section.radiusStart || 1])) * WORLD_SCALE * 1.5;
    return new THREE.Box3(
      new THREE.Vector3(start, -radius, -radius),
      new THREE.Vector3(end, radius, radius),
    ).getBoundingSphere(new THREE.Sphere());
  }, [inspection.sections, wallData]);
  const hoverCell = useAtomValue(hoverCellAtom);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useImperativeHandle(ref, () => ({
    fit: () => setViewRequest((value) => value + 1),
    reset: () => { controlsRef.current?.reset(); },
  }), []);

  return (
    <div className="kiln-stage">
      <Canvas orthographic dpr={[1, 2]} camera={{ position: [18, 10, 18], zoom: 50, near: 0.01, far: 200 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#f4f7f8']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 7]} intensity={2.2} />
        <Surface geometry={geometry} inspection={inspection} wallData={wallData} displayMode={displayMode} reveal={reveal} rotating={rotating} focusedArea={focusedArea} showLabels={showLabels} showGrid={showGrid} />
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} minZoom={8} maxZoom={500} />
        <CameraRig controlsRef={controlsRef} cameraApiRef={cameraApiRef} bounds={assemblyBounds} focusedArea={focusedArea} wallData={wallData} viewRequest={viewRequest} />
        <GizmoHelper alignment="bottom-right" margin={[78, 78]}>
          <GizmoViewcube color="#ffffff" hoverColor="#d8eef0" textColor="#183238" strokeColor="#688086" />
        </GizmoHelper>
      </Canvas>
      <Tooltip cell={hoverCell} />
      {inspection.note && (
        <div className="kiln-inspection-note" role="note">
          <strong>Note:</strong> {inspection.note}
        </div>
      )}
    </div>
  );
});

export default KilnCanvas;
