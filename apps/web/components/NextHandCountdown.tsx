'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/** “Next hand in Xs” for auto-deal (public) tables. */
export function NextHandCountdown({ at, className }: { at: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [at]);

  const seconds = Math.max(0, Math.ceil((at - now) / 1000));
  return (
    <p className={cn('text-center text-xs font-medium tabular-nums text-muted', className)}>
      {seconds > 0 ? `Next hand in ${seconds}s` : 'Dealing…'}
    </p>
  );
}
