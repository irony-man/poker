'use client';

import { useId } from 'react';

/** Subtle branded backdrop for the hands path — no park illustration. */
export function MapPark({ width, height }: { width: number; height: number }) {
  const uid = useId().replace(/:/g, '');
  const dotId = `hands-dots-${uid}`;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-mushroom" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-mushroom to-mushroom/90" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.35]" width={width} height={height}>
        <defs>
          <pattern id={dotId} width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="1.2" fill="rgb(var(--sidebar))" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${dotId})`} />
      </svg>
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sidebar/[0.04] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-sidebar/[0.06] to-transparent" />
    </div>
  );
}
