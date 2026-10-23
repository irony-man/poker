'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_STAKE_ID } from '@poker/protocol';
import { FriendInvitePicker } from '@/components/FriendInvitePicker';
import {
  createTable,
  fetchPublicBotGroupsWithLabels,
  type PublicBotGroup,
} from '@/lib/api';
import { presetStakeSelection } from '@/components/StakeChoiceRow';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { PkButton } from '../Button';
import { PkPageHeader } from '../Bits';
import { PkCodeInput } from '../CodeInput';
import { PkSegmented, PkSelect, PkStakeCards } from '../Choice';
import { PkGate } from '../Gate';
import { PkScope } from '../PkScope';
import { resolveInvite, resolveContestInvite, resolveCourtpieceInvite, resolveLudoInvite, resolveMemoryInvite, resolveSnakesInvite } from '@/lib/api';

const SEATS = [2, 3, 4, 5, 6, 7, 8, 9];

export function PkPlayScreen({ mode }: { mode: 'host' | 'join' }) {
  const { authReady, signedIn } = useLobbySession();
  const [gate, setGate] = useState<string | null>(null);
  if (!authReady) return <PkScope><p className="p-pk-6 text-muted">Loading…</p></PkScope>;
  return (
    <PkScope>
      <div className="mx-auto w-full max-w-3xl px-pk-4 py-pk-6">
        <PkPageHeader
          title={mode === 'join' ? 'Join with code' : 'Host a table'}
          subtitle={
            mode === 'join'
              ? 'Enter the room code from your host.'
              : 'Private No-Limit Hold’em. You get a code to share.'
          }
        />
        {mode === 'host' ? (
          <PkHost signedIn={signedIn} onLocked={() => setGate('Sign in to host a table')} />
        ) : (
          <PkJoin signedIn={signedIn} onLocked={() => setGate('Sign in to sit at this table')} />
        )}
      </div>
      <PkGate
        open={gate != null}
        title={gate ?? 'Sign in to continue'}
        body="Create an account or sign in. You’ll come back to this page."
        next={mode === 'join' ? '/play?mode=join' : '/play'}
        onClose={() => setGate(null)}
      />
    </PkScope>
  );
}

function PkHost({ signedIn, onLocked }: { signedIn: boolean; onLocked: () => void }) {
  const router = useRouter();
  const { sessionToken, ensureSession } = useLobbySession();
  const [stakeId, setStakeId] = useState(DEFAULT_STAKE_ID);
  const [seats, setSeats] = useState('6');
  const [bots, setBots] = useState('0');
  const [groups, setGroups] = useState<PublicBotGroup[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [friends, setFriends] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBotGroupsWithLabels().then(({ groups: next }) => {
      if (cancelled) return;
      setGroups(next);
      setGroupId(next.find((group) => group.isDefault)?.id ?? next[0]?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!signedIn) {
      onLocked();
      return;
    }
    const stakes = presetStakeSelection(stakeId);
    if (stakes.error) {
      setError(stakes.error);
      return;
    }
    enterMobileFullscreen();
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession();
      const room = code.trim();
      if (room && !/^\d{4,8}$/.test(room)) {
        setError('Room code must be 4–8 digits');
        setBusy(false);
        return;
      }
      const botCount = Number(bots);
      const table = await createTable(
        {
          name: `${session.name}'s Table`,
          smallBlind: stakes.smallBlind,
          bigBlind: stakes.bigBlind,
          buyIn: stakes.stack,
          turnTimeMs: 20000,
          maxSeats: Number(seats),
          botCount,
          ...(botCount > 0 && groupId ? { botGroupId: groupId } : {}),
          isPrivate: true,
          lobby: true,
          ...(room ? { inviteCode: room } : {}),
          inviteFriendIds: friends,
        },
        session.sessionToken,
      );
      router.push(`/table/${table.tableId}?invite=${table.inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onCreate(event)} className="flex flex-col gap-pk-5">
      <PkStakeCards selected={stakeId} onSelect={setStakeId} disabled={busy} />
      <PkSegmented
        label="Seats"
        value={seats}
        onChange={setSeats}
        disabled={busy}
        options={SEATS.map((seat) => ({ id: String(seat), label: String(seat) }))}
      />
      <PkSegmented
        label="Starting bots"
        value={bots}
        onChange={setBots}
        disabled={busy}
        options={Array.from({ length: Number(seats) }, (_, index) => ({
          id: String(index),
          label: String(index),
        }))}
      />
      {groups.length > 0 ? (
        <PkSelect
          label="Bot pack"
          value={groupId ?? groups[0]!.id}
          onChange={setGroupId}
          disabled={busy}
          options={groups.map((group) => ({ id: group.id, label: group.name }))}
        />
      ) : null}
      <div>
        <p className="mb-pk-2 text-pk-label">Room code (optional)</p>
        <PkCodeInput value={code} onChange={setCode} disabled={busy} label="Room code" />
      </div>
      {signedIn ? (
        <FriendInvitePicker
          sessionToken={sessionToken}
          selectedIds={friends}
          onChange={setFriends}
          maxSelect={Math.max(0, Number(seats) - Number(bots) - 1)}
          title="Invite friends"
        />
      ) : (
        <p className="text-pk-caption text-muted">Sign in to invite friends and host.</p>
      )}
      {error ? (
        <p role="alert" className="text-pk-caption text-danger">
          {error}
        </p>
      ) : null}
      <PkButton type="submit" disabled={busy} className="w-full">
        {signedIn ? 'Create private table' : 'Sign in to host'}
      </PkButton>
    </form>
  );
}

function PkJoin({ signedIn, onLocked }: { signedIn: boolean; onLocked: () => void }) {
  const router = useRouter();
  const { ensureSession } = useLobbySession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enter(mode: 'play' | 'spectate') {
    if (!signedIn && mode === 'play') {
      onLocked();
      return;
    }
    if (!signedIn && mode === 'spectate') {
      onLocked();
      return;
    }
    enterMobileFullscreen();
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession();
      const spectate = mode === 'spectate' ? '&mode=spectate' : '';
      try {
        const table = await resolveInvite(code.trim());
        router.push(`/table/${table.tableId}?invite=${table.inviteCode}${spectate}`);
        return;
      } catch {
        /* try the other invite types */
      }
      try {
        const { contest } = await resolveContestInvite(code.trim());
        const { registerContest } = await import('@/lib/api');
        await registerContest(contest.id, { sessionToken: session.sessionToken });
        router.push(`/contest/${contest.id}`);
        return;
      } catch {
        /* continue */
      }
      try {
        const board = await resolveLudoInvite(code.trim());
        router.push(`/ludo/${board.ludoId}?invite=${board.inviteCode}${spectate}`);
        return;
      } catch {
        /* continue */
      }
      try {
        const board = await resolveSnakesInvite(code.trim());
        router.push(`/snakes/${board.snakesId}?invite=${board.inviteCode}${spectate}`);
        return;
      } catch {
        /* continue */
      }
      try {
        const board = await resolveMemoryInvite(code.trim());
        router.push(`/memory/${board.memoryId}?invite=${board.inviteCode}${spectate}`);
        return;
      } catch {
        /* continue */
      }
      const board = await resolveCourtpieceInvite(code.trim());
      router.push(`/courtpiece/${board.courtpieceId}?invite=${board.inviteCode}${spectate}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void enter('play');
      }}
      className="flex flex-col gap-pk-5"
    >
      <PkCodeInput value={code} onChange={setCode} disabled={busy} />
      {error ? (
        <p role="alert" className="text-pk-caption text-danger">
          {error}
        </p>
      ) : null}
      {!signedIn ? <p className="text-pk-caption text-muted">Your code stays here. Sign in to take a seat.</p> : null}
      <PkButton type="submit" disabled={busy || code.replace(/\D/g, '').length < 4}>
        {signedIn ? 'Enter table' : 'Sign in to sit'}
      </PkButton>
      <PkButton type="button" variant="secondary" disabled={busy} onClick={() => void enter('spectate')}>
        Watch
      </PkButton>
    </form>
  );
}
