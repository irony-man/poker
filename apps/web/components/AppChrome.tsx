'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useIsNarrow } from '@/lib/tableLayout';

/** Hides the global brand header on play routes when the viewport is narrow. */
export function AppChrome({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const narrow = useIsNarrow();
  const playRoute = pathname.startsWith('/table/') || pathname === '/offline';
  const immersive = narrow && playRoute;

  return (
    <>
      {!immersive && header}
      <main
        className={`flex-1 min-h-0 ${
          immersive ? 'px-1.5 py-1' : 'px-3 sm:px-6 lg:px-8 py-2 sm:py-5'
        }`}
      >
        {children}
      </main>
    </>
  );
}
