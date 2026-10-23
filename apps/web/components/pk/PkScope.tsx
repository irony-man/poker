'use client';

import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const display = localFont({
  src: [
    {
      path: '../../../../design/redesign-v2/brand/fonts/outfit-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../../../design/redesign-v2/brand/fonts/outfit-700.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-pk-display',
  display: 'swap',
});

const body = localFont({
  src: [
    {
      path: '../../../../design/redesign-v2/brand/fonts/inter-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../../../design/redesign-v2/brand/fonts/inter-600.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  variable: '--font-pk-body',
  display: 'swap',
});

/** Poker v2 scope. Fonts and tokens stay off every other page. */
export function PkScope({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('pk-v2 pk-desktop-scale flex min-h-0 flex-1 flex-col', display.variable, body.variable, className)}>{children}</div>;
}
