'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, ContactShadows } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import * as THREE from 'three';

const CHIP_COLORS = [
  { face: '#b91c1c', rim: '#fecaca' },
  { face: '#1d4ed8', rim: '#bfdbfe' },
  { face: '#15803d', rim: '#bbf7d0' },
  { face: '#111111', rim: '#c9a227' },
  { face: '#5b21b6', rim: '#ddd6fe' },
];

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
    ref.current.rotation.z += dt * 0.15;
  });

  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2.2, 0, 0]} scale={scale} castShadow>
      <cylinderGeometry args={[0.28, 0.28, 0.06, 32]} />
      <meshStandardMaterial color={color.face} metalness={0.25} roughness={0.35} />
      {/* rim ring */}
      <mesh>
        <torusGeometry args={[0.28, 0.025, 8, 32]} />
        <meshStandardMaterial color={color.rim} metalness={0.4} roughness={0.3} />
      </mesh>
    </mesh>
  );
}

function OrbitingChips({ celebrate }: { celebrate: boolean }) {
  const group = useRef<Group>(null);
  const chips = useMemo(
    () =>
      CHIP_COLORS.map((color, i) => {
        const a = (i / CHIP_COLORS.length) * Math.PI * 2;
        return {
          color,
          position: [Math.cos(a) * 1.35, 0.15 + (i % 2) * 0.08, Math.sin(a) * 0.85] as [
            number,
            number,
            number,
          ],
          scale: 0.85 + (i % 3) * 0.1,
        };
      }),
    [],
  );

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = state.clock.elapsedTime * (celebrate ? 0.85 : 0.28);
    group.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.06;
  });

  return (
    <group ref={group}>
      {chips.map((c, i) => (
        <Float key={i} speed={1.4 + i * 0.15} rotationIntensity={0.35} floatIntensity={0.5}>
          <Chip3D position={c.position} color={c.color} scale={c.scale * (celebrate ? 1.15 : 1)} />
        </Float>
      ))}
    </group>
  );
}

function SoftCards({ dealKey }: { dealKey: number }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
  });

  const cards = useMemo(() => {
    void dealKey;
    return [-0.35, 0, 0.35].map((x, i) => ({
      x,
      z: -0.15 + i * 0.02,
      rot: -0.2 + i * 0.2,
    }));
  }, [dealKey]);

  return (
    <group ref={ref} position={[0, 0.35, -0.2]}>
      {cards.map((c, i) => (
        <mesh key={`${dealKey}-${i}`} position={[c.x, 0.02 * i, c.z]} rotation={[-0.9, c.rot, 0.1]} castShadow>
          <boxGeometry args={[0.42, 0.62, 0.02]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#f3efe6' : '#0d2244'} metalness={0.1} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function SceneContent({ celebrate, dealKey }: { celebrate: boolean; dealKey: number }) {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 5, 2]} intensity={1.25} color="#fff4de" />
      <pointLight position={[-2, 2, 1]} intensity={celebrate ? 1.6 : 0.55} color="#c9a227" />
      <OrbitingChips celebrate={celebrate} />
      <SoftCards dealKey={dealKey} />
      <ContactShadows opacity={0.25} scale={5} blur={2.5} far={2.5} color="#000000" />
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
    <div className="pointer-events-none absolute inset-0 z-0 opacity-90">
      <Canvas
        camera={{ position: [0, 2.2, 3.4], fov: 40 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#000000'), 0);
        }}
      >
        <SceneContent celebrate={celebrate} dealKey={dealKey} />
      </Canvas>
    </div>
  );
}
