'use client';

import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { getApiInflightCount, subscribeApiInflight } from '@/lib/api/client';

const SHOW_DELAY_MS = 150;

/** Chip-shuffle overlay while tracked REST calls are in flight. */
export function ApiLoadingOverlay() {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setCount(getApiInflightCount());
    return subscribeApiInflight(setCount);
  }, []);

  useEffect(() => {
    if (count <= 0) {
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [count]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-page/50 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingScreen compact label="Loading…" />
    </div>
  );
}
