'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

const ZERO = new THREE.Vector3(0, 0, 0);

const FACE_ROTATION: Record<number, [number, number, number]> = {
  // Box materials: +x=3, -x=4, +y=2, -y=5, +z=1, -z=6 — rotate so face faces camera (+z).
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, -Math.PI / 2, 0],
  4: [0, Math.PI / 2, 0],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, Math.PI],
};

function pipPositions(value: number): Array<[number, number]> {
  switch (value) {
    case 1:
      return [[0, 0]];
    case 2:
      return [
        [-0.28, 0.28],
        [0.28, -0.28],
      ];
    case 3:
      return [
        [-0.28, 0.28],
        [0, 0],
        [0.28, -0.28],
      ];
    case 4:
      return [
        [-0.28, 0.28],
        [0.28, 0.28],
        [-0.28, -0.28],
        [0.28, -0.28],
      ];
    case 5:
      return [
        [-0.28, 0.28],
        [0.28, 0.28],
        [0, 0],
        [-0.28, -0.28],
        [0.28, -0.28],
      ];
    default:
      return [
        [-0.28, 0.32],
        [0.28, 0.32],
        [-0.28, 0],
        [0.28, 0],
        [-0.28, -0.32],
        [0.28, -0.32],
      ];
  }
}

function makeFaceTexture(value: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#f4efec');
  grad.addColorStop(1, '#e4d8d4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(29, 4, 50, 0.12)';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  ctx.fillStyle = '#1d0432';
  const r = size * 0.08;
  for (const [x, y] of pipPositions(value)) {
    ctx.beginPath();
    ctx.arc(size * (0.5 + x), size * (0.5 - y), r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function shortestAngle(from: number, to: number): number {
  return from + (THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI);
}

function DiceMesh({
  value,
  rolling,
  interactive,
}: {
  value: number | null;
  rolling: boolean;
  interactive: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(new THREE.Vector3(8.5, 10.2, 6.8));
  const hopPhase = useRef(0);
  const settleFrom = useRef(new THREE.Euler());
  const settleTo = useRef(new THREE.Euler());
  const settleT = useRef(1);
  const lastValue = useRef<number | null>(null);
  const idleT = useRef(0);
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const materials = useMemo(() => {
    // BoxGeometry material order: +x, -x, +y, -y, +z, -z
    const faces = [3, 4, 2, 5, 1, 6];
    return faces.map(
      (face) =>
        new THREE.MeshStandardMaterial({
          map: makeFaceTexture(face),
          roughness: 0.42,
          metalness: 0.08,
        }),
    );
  }, []);

  useEffect(() => {
    return () => {
      for (const mat of materials) {
        mat.map?.dispose();
        mat.dispose();
      }
    };
  }, [materials]);

  useEffect(() => {
    if (rolling) {
      spin.current.set(
        9 + Math.random() * 5,
        10 + Math.random() * 6,
        7 + Math.random() * 4,
      );
      hopPhase.current = 0;
      settleT.current = 1;
      return;
    }
    if (value == null || !group.current) return;
    const [tx, ty, tz] = FACE_ROTATION[value] ?? FACE_ROTATION[1]!;
    if (reducedMotion || lastValue.current === value) {
      group.current.rotation.set(tx, ty, tz);
      group.current.position.set(0, 0, 0);
      settleT.current = 1;
      lastValue.current = value;
      return;
    }
    settleFrom.current.copy(group.current.rotation);
    settleTo.current.set(
      shortestAngle(settleFrom.current.x, tx),
      shortestAngle(settleFrom.current.y, ty),
      shortestAngle(settleFrom.current.z, tz),
    );
    settleT.current = 0;
    lastValue.current = value;
  }, [rolling, value, reducedMotion]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    if (rolling && !reducedMotion) {
      hopPhase.current += dt * 10;
      g.rotation.x += spin.current.x * dt;
      g.rotation.y += spin.current.y * dt;
      g.rotation.z += spin.current.z * dt;
      g.position.y = 0.22 + Math.abs(Math.sin(hopPhase.current)) * 0.38;
      g.position.x = Math.sin(hopPhase.current * 1.35) * 0.12;
      g.position.z = Math.cos(hopPhase.current * 0.95) * 0.08;
      return;
    }

    if (value != null && settleT.current < 1) {
      settleT.current = Math.min(1, settleT.current + dt / 0.45);
      const t = 1 - (1 - settleT.current) ** 3;
      g.rotation.x = THREE.MathUtils.lerp(settleFrom.current.x, settleTo.current.x, t);
      g.rotation.y = THREE.MathUtils.lerp(settleFrom.current.y, settleTo.current.y, t);
      g.rotation.z = THREE.MathUtils.lerp(settleFrom.current.z, settleTo.current.z, t);
      const bounce = Math.sin(t * Math.PI) * (1 - t) * 0.22;
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0, t) + bounce;
      g.position.x = THREE.MathUtils.lerp(g.position.x, 0, t);
      g.position.z = THREE.MathUtils.lerp(g.position.z, 0, t);
      return;
    }

    g.position.lerp(ZERO, Math.min(1, dt * 8));
    if (value != null && interactive && !rolling && !reducedMotion) {
      idleT.current += dt;
      const [bx, by, bz] = FACE_ROTATION[value] ?? FACE_ROTATION[1]!;
      g.rotation.set(
        bx + Math.sin(idleT.current * 1.4) * 0.06,
        by,
        bz + Math.cos(idleT.current * 1.1) * 0.05,
      );
    }
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <boxGeometry args={[1.15, 1.15, 1.15]} />
        {materials.map((mat, i) => (
          <primitive key={i} object={mat} attach={`material-${i}`} />
        ))}
      </mesh>
      <mesh>
        <boxGeometry args={[1.18, 1.18, 1.18]} />
        <meshBasicMaterial color="#1d0432" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

function Scene({
  value,
  rolling,
  interactive,
}: {
  value: number | null;
  rolling: boolean;
  interactive: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} color="#fff6ea" />
      <directionalLight position={[-2.5, -1.5, 2]} intensity={0.32} color="#f0e4d4" />
      <DiceMesh value={value} rolling={rolling} interactive={interactive} />
    </>
  );
}

function FlatDieFace({ value, rolling }: { value: number | null; rolling: boolean }) {
  const pips = value != null && value >= 1 && value <= 6 ? pipPositions(value) : [];
  return (
    <span
      className={`relative block h-[86%] w-[86%] rounded-[18%] bg-gradient-to-br from-white to-[#e8e0dc] shadow-[inset_0_0_0_1px_rgba(29,4,50,0.12)] ${
        rolling ? 'animate-spin' : ''
      }`}
      aria-hidden
    >
      {pips.map(([x, y], i) => (
        <span
          key={i}
          className="absolute h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1d0432]"
          style={{ left: `${50 + x * 100}%`, top: `${50 - y * 100}%` }}
        />
      ))}
    </span>
  );
}

export function LudoDice3D({
  value,
  rolling = false,
  interactive = false,
  onRoll,
  className = '',
  label,
  compact = false,
}: {
  value: number | null;
  rolling?: boolean;
  interactive?: boolean;
  onRoll?: () => void;
  className?: string;
  label?: ReactNode;
  compact?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (rolling || value == null) {
      setShowResult(false);
      return;
    }
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 460;
    const id = window.setTimeout(() => setShowResult(true), delay);
    return () => window.clearTimeout(id);
  }, [rolling, value]);

  const canClick = interactive && !rolling && Boolean(onRoll);
  const isSix = value === 6;

  if (compact) {
    return (
      <button
        type="button"
        disabled={!canClick}
        onClick={() => {
          if (canClick) onRoll?.();
        }}
        aria-label={
          rolling
            ? 'Rolling dice'
            : value != null
              ? `Dice showing ${value}`
              : canClick
                ? 'Roll dice'
                : 'Dice'
        }
        className={`relative flex h-10 w-10 items-center justify-center rounded-md bg-[#f6d6d0] sm:h-12 sm:w-12 ${
          canClick ? 'cursor-pointer' : 'cursor-default'
        } disabled:opacity-100 ${className}`.trim()}
      >
        <FlatDieFace value={rolling ? null : value} rolling={rolling} />
      </button>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`.trim()}>
      <button
        type="button"
        disabled={!canClick}
        onClick={() => {
          if (canClick) onRoll?.();
        }}
        aria-label={
          rolling
            ? 'Rolling dice'
            : value != null
              ? `Dice showing ${value}`
              : canClick
                ? 'Roll dice'
                : 'Dice'
        }
        className={`relative h-28 w-28 rounded-2xl border transition sm:h-32 sm:w-32 ${
          canClick
            ? 'cursor-pointer border-sidebar/25 bg-gradient-to-b from-white to-[#efe6e2] shadow-[0_10px_28px_rgb(29_4_50_/_0.18)] hover:border-sidebar/45 hover:shadow-[0_12px_32px_rgb(29_4_50_/_0.24)] active:scale-[0.98]'
            : 'cursor-default border-sidebar/15 bg-gradient-to-b from-white/95 to-[#efe6e2] shadow-[0_8px_22px_rgb(29_4_50_/_0.14)]'
        } disabled:opacity-100`}
      >
        {mounted ? (
          <Canvas
            className="h-full w-full"
            dpr={[1, 1.75]}
            camera={{ position: [0, 0, 3.1], fov: 35 }}
            gl={{ antialias: true, alpha: true }}
          >
            <Scene value={value} rolling={rolling} interactive={canClick} />
          </Canvas>
        ) : (
          <span className="flex h-full items-center justify-center font-display text-3xl font-bold text-sidebar/40">
            {value ?? '?'}
          </span>
        )}
        {showResult && value != null ? (
          <span
            className={`pointer-events-none absolute inset-x-1 bottom-1 z-10 flex items-center justify-center rounded-md px-1.5 py-0.5 font-display font-bold tabular-nums leading-none ${
              isSix
                ? 'bg-[#F1C40F] text-neutral-900 shadow-[0_2px_8px_rgb(241_196_15_/_0.55)] animate-pulse text-sm sm:text-base'
                : 'bg-black/70 text-white text-xs sm:text-sm'
            }`}
          >
            {isSix ? 'Six!' : value}
          </span>
        ) : null}
      </button>
      {label ? (
        <div className="text-center text-[11px] font-display font-semibold uppercase tracking-[0.14em] text-ink-strong">
          {label}
        </div>
      ) : null}
    </div>
  );
}
