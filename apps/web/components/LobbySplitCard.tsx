'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

/**
 * Lobby setup layout: illustration on the page ground (no plate),
 * plus a separate form/content panel.
 */
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
    <div className="grid w-full items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-10 xl:gap-14">
      <div
        className={`relative mx-auto w-full max-w-md lg:max-w-none ${
          imageRight ? 'order-first lg:order-last' : ''
        }`}
      >
        <div className="relative aspect-[4/3] w-full sm:aspect-[5/4]">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            unoptimized={imageSrc.endsWith('.svg')}
            className="object-contain object-center"
            sizes="(max-width: 1024px) 90vw, 48vw"
            priority
          />
        </div>
      </div>

      <div className="hud-panel flex min-h-0 min-w-0 flex-col gap-4 p-5 sm:gap-5 sm:p-7 lg:p-8">
        {children}
      </div>
    </div>
  );
}
