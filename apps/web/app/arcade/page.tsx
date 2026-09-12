'use client';

import Link from 'next/link';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { ARCADE_GAMES } from '@/lib/arcadeGames';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

export default function ArcadePage() {
  const { authReady, signedIn } = useLobbySession();
  const pageCopy = usePageCopy('arcade');

  if (!authReady) {
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <LobbyPageShell
      title={pageCopy.title}
      subtitle={pageCopy.subtitle}
      signedIn={signedIn}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ARCADE_GAMES.map((game) => (
          <div key={game.id} className="surface-card flex flex-col gap-3 p-4">
            <div>
              <p className="font-display text-lg font-bold uppercase tracking-wider text-ink-strong">
                {game.title}
              </p>
              <p className="mt-1 text-sm text-ink-strong-muted">{game.blurb}</p>
            </div>
            <Button href={game.href} className="mt-auto min-h-11 w-full">
              Play
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-ink-strong-muted">
        Prefer a direct link?{' '}
        <Link href="/ludo" className="underline hover:text-ink-strong">
          Ludo
        </Link>
        {' · '}
        <Link href="/snakes" className="underline hover:text-ink-strong">
          Snakes
        </Link>
        {' · '}
        <Link href="/memory" className="underline hover:text-ink-strong">
          Memory
        </Link>
      </p>
    </LobbyPageShell>
  );
}
