'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { resolveContestInvite, resolveInvite, resolveLudoInvite } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';

export function JoinTableForm({
  ensureSession,
  disabled,
  onError,
}: {
  ensureSession: () => Promise<{ sessionToken: string }>;
  disabled?: boolean;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);

  async function enterInvite(mode: 'play' | 'spectate') {
    enterMobileFullscreen();
    setBusy(true);
    onError(null);
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
      onError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enterInvite('play');
      }}
      className="flex flex-col gap-5"
    >
      <TextField
        variant="hud"
        label="Invite code"
        value={invite}
        onChange={(e) => setInvite(e.target.value.trim())}
        className="min-h-12 font-mono tracking-[0.2em] text-base"
        inputMode="numeric"
        maxLength={8}
        required
        autoComplete="off"
        disabled={disabled || busy}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <Button disabled={disabled || busy} type="submit" className="min-h-12 w-full">
          Enter table
        </Button>
        <Button
          disabled={disabled || busy || !invite.trim()}
          type="button"
          variant="ghost"
          onClick={() => void enterInvite('spectate')}
          className="min-h-12 w-full"
        >
          Spectate
        </Button>
      </div>
    </form>
  );
}
