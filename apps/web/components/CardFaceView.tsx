'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { CardFaceLayer, CardFaceTheme, SuitKey } from '@/lib/cardFaceTheme';
import { inkForCardCode, layerContent, layerFontWeight, themeLayersForSuit } from '@/lib/cardFaceTheme';

function layerBoxStyle(
  layer: CardFaceLayer,
  faceW: number,
  faceH: number,
  selected: boolean,
  interactive: boolean,
): { className: string; style: CSSProperties } {
  const left = faceW > 0 ? layer.x * faceW : 0;
  const top = faceH > 0 ? layer.y * faceH : 0;
  const opacity = layer.opacity ?? 1;
  const className = `absolute z-[1] flex -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center leading-none ${
    interactive ? 'cursor-move' : 'pointer-events-none'
  } ${selected ? 'ring-2 ring-sky-500 ring-offset-1' : ''}`;

  if (layer.kind === 'svg' && layer.svg) {
    const box = faceH > 0 ? layer.size * faceH : 0;
    return {
      className,
      style: {
        left,
        top,
        opacity,
        width: box > 0 ? box : undefined,
        height: box > 0 ? box : undefined,
        color: 'inherit',
      },
    };
  }

  const fontSize = faceH > 0 ? layer.size * faceH : 0;
  return {
    className,
    style: {
      left,
      top,
      opacity,
      fontSize: fontSize > 0 ? fontSize : undefined,
      fontWeight: layerFontWeight(layer),
      fontVariantEmoji: 'text',
    },
  };
}

function LayerVisual({
  layer,
  rank,
  suitGlyph,
}: {
  layer: CardFaceLayer;
  rank: string;
  suitGlyph: string;
}) {
  if (layer.kind === 'svg' && layer.svg) {
    return (
      <div
        className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: layer.svg }}
      />
    );
  }
  return <>{layerContent(layer, rank, suitGlyph)}</>;
}

export function CardFaceView({
  theme,
  suitKey,
  rank,
  suitGlyph,
  cardCode,
  layers: layersOverride,
  interactive = false,
  selectedLayerId = null,
  onSelectLayer,
  onMeasure,
}: {
  theme: CardFaceTheme;
  suitKey: SuitKey;
  rank: string;
  suitGlyph: string;
  /** Engine code (`Th`) for suit ink color. */
  cardCode: string;
  /** Admin preview may pass explicit layer stack for the edited suit. */
  layers?: CardFaceLayer[];
  interactive?: boolean;
  selectedLayerId?: string | null;
  onSelectLayer?: (id: string) => void;
  onMeasure?: (faceW: number, faceH: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [face, setFace] = useState({ w: 0, h: 0 });
  const ink = inkForCardCode(theme, cardCode);
  const layers = layersOverride ?? themeLayersForSuit(theme, suitKey);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const w = box.width;
      const h = box.height;
      setFace({ w, h });
      onMeasure?.(w, h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasure]);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0"
      style={{
        color: ink,
        background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 48%, #f2f2f2 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[55%]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.55) 55%, transparent 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-[8%] top-[42%] h-px opacity-40"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.08), transparent)',
        }}
      />

      {layers.map((layer) => {
        const selected = selectedLayerId === layer.id;
        const { className, style } = layerBoxStyle(layer, face.w, face.h, selected, interactive);
        if (interactive) {
          return (
            <button
              key={layer.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectLayer?.(layer.id);
              }}
              className={className}
              style={style}
            >
              <LayerVisual layer={layer} rank={rank} suitGlyph={suitGlyph} />
            </button>
          );
        }
        return (
          <span key={layer.id} className={className} style={style} aria-hidden>
            <LayerVisual layer={layer} rank={rank} suitGlyph={suitGlyph} />
          </span>
        );
      })}
    </div>
  );
}
