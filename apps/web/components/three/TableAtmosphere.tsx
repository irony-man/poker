'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import * as THREE from 'three';

const CHIP_COLORS = [
  { face: '#b91c1c', rim: '#fecaca' },
  { face: '#1d4ed8', rim: '#bfdbfe' },
  { face: '#15803d', rim: '#bbf7d0' },
  { face: '#111111', rim: '#c9a227' },
  { face: '#5b21b6', rim: '#ddd6fe' },
  { face: '#92400e', rim: '#fde68a' },
];

/** Tiny decorative chip — kept small so it never competes with the 2D UI. */
function Chip3D({
  position,
  color,
  scale = 1,
}: {
  position: [number, number, number];
  color: { face: string; rim: string };
  scale?: number;
}) {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.z += dt * 0.35;
  });

  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2.15, 0, 0]} scale={scale} castShadow>
      <cylinderGeometry args={[0.11, 0.11, 0.028, 24]} />
      <meshStandardMaterial color={color.face} metalness={0.3} roughness={0.4} />
      <mesh>
        <torusGeometry args={[0.11, 0.012, 6, 24]} />
        <meshStandardMaterial color={color.rim} metalness={0.45} roughness={0.35} />
      </mesh>
    </mesh>
  );
}

/**
 * Chips orbit near the felt rim only — center stays clear for pot / community cards.
 */
function RimChips({ celebrate }: { celebrate: boolean }) {
  const group = useRef<Group>(null);
  const chips = useMemo(
    () =>
      CHIP_COLORS.map((color, i) => {
        const a = (i / CHIP_COLORS.length) * Math.PI * 2 + 0.2;
        const rx = 2.55 + (i % 2) * 0.18;
        const rz = 1.45 + (i % 3) * 0.12;
        return {
          color,
          position: [Math.cos(a) * rx, 0.04 + (i % 2) * 0.03, Math.sin(a) * rz] as [
            number,
            number,
            number,
          ],
          scale: 0.75 + (i % 3) * 0.08,
        };
      }),
    [],
  );

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = state.clock.elapsedTime * (celebrate ? 0.55 : 0.12);
  });

  return (
    <group ref={group}>
      {chips.map((c, i) => (
        <Float
          key={i}
          speed={0.9 + i * 0.08}
          rotationIntensity={0.15}
          floatIntensity={celebrate ? 0.45 : 0.18}
        >
          <Chip3D position={c.position} color={c.color} scale={c.scale * (celebrate ? 1.2 : 1)} />
        </Float>
      ))}
    </group>
  );
}

function SceneContent({ celebrate }: { celebrate: boolean; dealKey: number }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 4, 2]} intensity={0.85} color="#fff4de" />
      <pointLight position={[0, 1.5, 0]} intensity={celebrate ? 0.9 : 0.25} color="#c9a227" />
      <RimChips celebrate={celebrate} />
    </>
  );
}

export function TableAtmosphere({
  celebrate = false,
  dealKey = 0,
}: {
  celebrate?: boolean;
  dealKey?: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-45">
      <Canvas
        camera={{ position: [0, 4.2, 0.15], fov: 42, near: 0.1, far: 20 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(new THREE.Color('#000000'), 0);
          camera.lookAt(0, 0, 0);
        }}
      >
        <SceneContent celebrate={celebrate} dealKey={dealKey} />
      </Canvas>
    </div>
  );
}
