'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

/** Two-column lobby card: thematic image + form/content. */
export function LobbySplitCard({
  imageSrc,
  imageAlt,
  children,
  imageRight = false,
}: {
  imageSrc: string;
  imageAlt: string;
  children: ReactNode;
  /** Put the image on the right (desktop). */
  imageRight?: boolean;
}) {
  return (
    <div className="hud-panel grid w-full overflow-hidden p-0 lg:grid-cols-2">
      <div
        className={`relative min-h-[11rem] w-full sm:min-h-[14rem] lg:min-h-[22rem] ${
          imageRight ? 'order-first lg:order-last' : ''
        }`}
      >
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover object-center"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-sidebar/35 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-sidebar/15"
          aria-hidden
        />
      </div>
      <div className="flex min-w-0 flex-col justify-start gap-3 p-4 sm:gap-3.5 sm:p-6 lg:p-8">
        {children}
      </div>
    </div>
  );
}
