'use client';

import { useCallback, useRef, useState } from 'react';
import { CardFaceView } from '@/components/CardFaceView';
import { parseCardPreviewCode } from '@/lib/cardCodeParse';
import type { CardFaceLayer, CardFaceSnapStep, CardFaceTheme, SuitKey } from '@/lib/cardFaceTheme';
import { snapUnit } from '@/lib/cardFaceTheme';

type DragMode = {
  kind: 'move' | 'resize';
  id: string;
  startY: number;
  origin: Pick<CardFaceLayer, 'x' | 'y' | 'size'>;
};

function hitSize(layer: CardFaceLayer, faceH: number): number {
  const fontSize = layer.size * faceH;
  if (layer.kind === 'svg') return Math.max(fontSize, 28);
  return Math.max(fontSize * 1.2, 24);
}

export function CardLayoutEditor({
  theme,
  layers,
  suitKey,
  sampleCode,
  selectedLayerId,
  snapEnabled,
  snapStep,
  onSelect,
  onChangeLayer,
}: {
  theme: CardFaceTheme;
  layers: CardFaceLayer[];
  suitKey: SuitKey;
  sampleCode: string;
  selectedLayerId: string;
  snapEnabled: boolean;
  snapStep: CardFaceSnapStep;
  onSelect: (id: string) => void;
  onChangeLayer: (id: string, patch: Partial<Pick<CardFaceLayer, 'x' | 'y' | 'size'>>) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [face, setFace] = useState({ w: 0, h: 0 });
  const dragRef = useRef<DragMode | null>(null);
  const preview = parseCardPreviewCode(sampleCode);

  const maybeSnap = useCallback(
    (value: number) => (snapEnabled ? snapUnit(value, snapStep) : value),
    [snapEnabled, snapStep],
  );

  const patchFromPointer = useCallback(
    (mode: DragMode, clientX: number, clientY: number) => {
      const board = boardRef.current;
      if (!board || face.w <= 0 || face.h <= 0) return;
      const rect = board.getBoundingClientRect();
      const localX = maybeSnap((clientX - rect.left) / face.w);
      const localY = maybeSnap((clientY - rect.top) / face.h);
      if (mode.kind === 'move') {
        onChangeLayer(mode.id, {
          x: Math.min(1, Math.max(0, localX)),
          y: Math.min(1, Math.max(0, localY)),
        });
        return;
      }
      const dy = clientY - mode.startY;
      let nextSize = mode.origin.size + dy / face.h;
      if (snapEnabled) nextSize = snapUnit(nextSize, snapStep);
      onChangeLayer(mode.id, {
        size: Math.min(0.8, Math.max(0.02, nextSize)),
      });
    },
    [face.h, face.w, maybeSnap, onChangeLayer, snapEnabled, snapStep],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const mode = dragRef.current;
      if (!mode) return;
      patchFromPointer(mode, e.clientX, e.clientY);
    },
    [patchFromPointer],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }, [onPointerMove]);

  const startMove = (layer: CardFaceLayer, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(layer.id);
    dragRef.current = {
      kind: 'move',
      id: layer.id,
      startY: e.clientY,
      origin: { x: layer.x, y: layer.y, size: layer.size },
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  const startResize = (layer: CardFaceLayer, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      kind: 'resize',
      id: layer.id,
      startY: e.clientY,
      origin: { x: layer.x, y: layer.y, size: layer.size },
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  const gridStepPct = `${snapStep * 100}%`;

  return (
    <div
      ref={boardRef}
      className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-[0.35rem] shadow-[0_4px_12px_rgba(0,0,0,0.35)] ring-1 ring-black/40"
      style={{ aspectRatio: '5 / 7' }}
    >
      {snapEnabled ? (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden
          style={{
            backgroundImage: `
              linear-gradient(to right, rgb(29 4 50 / 0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(29 4 50 / 0.06) 1px, transparent 1px)
            `,
            backgroundSize: `${gridStepPct} ${gridStepPct}`,
          }}
        />
      ) : null}
      <CardFaceView
        theme={theme}
        suitKey={suitKey}
        rank={preview.rank}
        suitGlyph={preview.suitGlyph}
        cardCode={preview.engineCode}
        layers={layers}
        interactive
        selectedLayerId={selectedLayerId}
        onMeasure={(w, h) => setFace({ w, h })}
      />
      {face.w > 0 && face.h > 0
        ? layers.map((layer) => {
            const left = layer.x * face.w;
            const top = layer.y * face.h;
            const hit = hitSize(layer, face.h);
            const selected = selectedLayerId === layer.id;
            return (
              <div
                key={`hit-${layer.id}`}
                className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 touch-none"
                style={{ left, top, width: hit, height: hit }}
                onPointerDown={(e) => startMove(layer, e)}
              >
                {selected ? (
                  <span
                    className="pointer-events-none absolute -inset-1 rounded border-2 border-sky-500"
                    aria-hidden
                  />
                ) : null}
                {selected ? (
                  <span
                    role="presentation"
                    className="absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-sm border border-white bg-sky-500 shadow"
                    onPointerDown={(e) => startResize(layer, e)}
                  />
                ) : null}
              </div>
            );
          })
        : null}
    </div>
  );
}
