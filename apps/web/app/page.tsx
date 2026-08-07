'use client';

import { HomeLanding } from '@/components/HomeLanding';
import { useLobbySession } from '@/lib/useLobbySession';

export default function HomePage() {
  const { authReady, signedIn } = useLobbySession();

  if (!authReady) {
    return <p className="pt-12 text-center text-ink-strong-muted">Loading…</p>;
  }

  return <HomeLanding signedIn={signedIn} />;
}
