'use client';

import { useId } from 'react';

/** Felt table backdrop for the hands path. */
export function MapPark({
  width,
  height,
  tableColorId = 0,
}: {
  width: number;
  height: number;
  tableColorId?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const feltId = `hands-felt-${uid}`;
  const suits = ['♠', '♥', '♦', '♣'] as const;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="felt-surface absolute inset-0" data-table-color={String(tableColorId)} />
      <svg className="absolute inset-0 h-full w-full opacity-[0.22]" width={width} height={height}>
        <defs>
          <pattern id={feltId} width="56" height="56" patternUnits="userSpaceOnUse">
            <path
              d="M28 4 L52 28 L28 52 L4 28 Z"
              fill="none"
              stroke="rgb(var(--mushroom))"
              strokeWidth="0.8"
              opacity="0.35"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${feltId})`} />
      </svg>
      <div className="absolute inset-0 text-[2.4rem] leading-none text-mushroom/15">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className="absolute"
            style={{
              left: `${12 + ((i * 37) % 76)}%`,
              top: `${8 + ((i * 53) % 84)}%`,
              transform: `rotate(${(i * 23) % 40 - 20}deg)`,
            }}
          >
            {suits[i % 4]}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/35 to-transparent" />
    </div>
  );
}
