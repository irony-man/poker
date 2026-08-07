'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { resolveContestInvite, resolveInvite } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';

export default function JoinPage() {
  const router = useRouter();
  const { authReady, signedIn, ensureSession } = useLobbySession();
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enterContestCode(code: string) {
    const session = await ensureSession();
    const { contest } = await resolveContestInvite(code);
    const { registerContest } = await import('@/lib/api');
    await registerContest(contest.id, { sessionToken: session.sessionToken });
    router.push(`/contest/${contest.id}`);
  }

  async function enterInvite(mode: 'play' | 'spectate') {
    enterMobileFullscreen();
    setBusy(true);
    setError(null);
    try {
      await ensureSession();
      try {
        const t = await resolveInvite(invite.trim());
        const spectate = mode === 'spectate' ? '&mode=spectate' : '';
        router.push(`/table/${t.tableId}?invite=${t.inviteCode}${spectate}`);
      } catch {
        await enterContestCode(invite.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return <p className="pt-4 text-ink-strong-muted">Loading…</p>;
  }

  return (
    <LobbyPageShell title="Join" signedIn={signedIn} error={error}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enterInvite('play');
        }}
      >
        <LobbySplitCard imageSrc="/home-cards.png" imageAlt="Playing cards and chips on felt">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-sidebar">
              Invite
            </h2>
            <span className="text-[10px] font-display uppercase tracking-[0.2em] text-ink-strong-muted">
              Table or contest
            </span>
          </div>
          <label className="block">
            <span className="hud-label">Invite code</span>
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value.trim())}
              className="hud-input font-mono tracking-[0.2em]"
              inputMode="numeric"
              maxLength={8}
              required
              autoComplete="off"
            />
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2.5">
            <button disabled={busy} type="submit" className="btn-primary min-h-11 w-full">
              Enter table
            </button>
            <button
              disabled={busy || !invite.trim()}
              type="button"
              onClick={() => void enterInvite('spectate')}
              className="btn-ghost min-h-11 w-full"
            >
              Spectate
            </button>
          </div>
        </LobbySplitCard>
      </form>
    </LobbyPageShell>
  );
}
