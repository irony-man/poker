'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { resolvePublicImage } from '@/lib/assets';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { resolveContestInvite, resolveInvite, resolveLudoInvite } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

export default function JoinPage() {
  const router = useRouter();
  const { authReady, signedIn, ensureSession } = useLobbySession();
  const pageCopy = usePageCopy('join');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enterInvite(mode: 'play' | 'spectate') {
    enterMobileFullscreen();
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession();
      const code = invite.trim();
      const spectate = mode === 'spectate' ? '&mode=spectate' : '';
      try {
        const t = await resolveInvite(code);
        router.push(`/table/${t.tableId}?invite=${t.inviteCode}${spectate}`);
        return;
      } catch {
        /* not a poker table — try contest, then Ludo */
      }
      try {
        const { contest } = await resolveContestInvite(code);
        const { registerContest } = await import('@/lib/api');
        await registerContest(contest.id, { sessionToken: session.sessionToken });
        router.push(`/contest/${contest.id}`);
        return;
      } catch {
        /* not a contest — try Ludo */
      }
      const board = await resolveLudoInvite(code);
      router.push(`/ludo/${board.ludoId}?invite=${board.inviteCode}${spectate}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <LobbyPageShell
      title={pageCopy.title}
      subtitle={pageCopy.subtitle}
      signedIn={signedIn}
      error={error}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enterInvite('play');
        }}
      >
        <LobbySplitCard
          imageSrc={resolvePublicImage(pageCopy.image ?? '/join-table.png')}
          imageAlt={pageCopy.imageAlt ?? 'Enter a table with an invite code'}
        >
          <TextField
            variant="hud"
            label="Invite code"
            value={invite}
            onChange={(e) => setInvite(e.target.value.trim())}
            className="font-mono tracking-[0.2em]"
            inputMode="numeric"
            maxLength={8}
            required
            autoComplete="off"
          />
          <div className="mt-1 grid grid-cols-2 gap-2.5">
            <Button disabled={busy} type="submit" className="min-h-11 w-full">
              Enter table
            </Button>
            <Button
              disabled={busy || !invite.trim()}
              type="button"
              variant="ghost"
              onClick={() => void enterInvite('spectate')}
              className="min-h-11 w-full"
            >
              Spectate
            </Button>
          </div>
        </LobbySplitCard>
      </form>
    </LobbyPageShell>
  );
}
