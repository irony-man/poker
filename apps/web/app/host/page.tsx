'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceRow } from '@/components/ChoiceRow';
import { FriendInvitePicker } from '@/components/FriendInvitePicker';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { createTable } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { DEFAULT_STAKE_ID, STAKE_PRESETS, stakeById } from '@poker/protocol';

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function HostPage() {
  const router = useRouter();
  const { authReady, signedIn, sessionToken, ensureSession } = useLobbySession();
  const [maxSeats, setMaxSeats] = useState(6);
  const [botCount, setBotCount] = useState(2);
  const [hostStakeId, setHostStakeId] = useState(DEFAULT_STAKE_ID);
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxBots = Math.max(0, maxSeats - 1);
  const maxFriendInvites = Math.min(8, Math.max(0, maxSeats - botCount - 1));

  useEffect(() => {
    if (botCount > maxBots) setBotCount(maxBots);
  }, [maxSeats, botCount, maxBots]);

  useEffect(() => {
    if (inviteFriendIds.length > maxFriendInvites) {
      setInviteFriendIds((ids) => ids.slice(0, maxFriendInvites));
    }
  }, [maxFriendInvites, inviteFriendIds.length]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    enterMobileFullscreen();
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession();
      const stake = stakeById(hostStakeId) ?? STAKE_PRESETS[1]!;
      const code = customRoomCode.trim();
      if (code && !/^\d{4,8}$/.test(code)) {
        setError('Room code must be 4–8 digits');
        setBusy(false);
        return;
      }
      const table = await createTable(
        {
          name: `${session.name}'s Table`,
          smallBlind: stake.smallBlind,
          bigBlind: stake.bigBlind,
          buyIn: stake.buyIn,
          turnTimeMs: 20000,
          maxSeats,
          botCount,
          isPrivate: true,
          ...(code ? { inviteCode: code } : {}),
          inviteFriendIds,
        },
        session.sessionToken,
      );
      router.push(`/table/${table.tableId}?invite=${table.inviteCode}`);
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
    <LobbyPageShell
      title="Create a table"
      subtitle="Set stakes and seats, choose starting bots, and open a private Hold'em room with a code you pick or we generate."
      signedIn={signedIn}
      error={error}
    >
      <form onSubmit={onCreate}>
        <LobbySplitCard imageSrc="/host-table.png" imageAlt="Host a private table for your group">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-sidebar">
              Create table
            </h2>
            <span className="text-[10px] font-display uppercase tracking-[0.2em] text-ink-strong-muted">
              Online
            </span>
          </div>
          <ChoiceRow
            label="Stakes"
            name="host-stakes"
            selected={hostStakeId}
            options={STAKE_PRESETS.map((s) => s.id)}
            onSelect={setHostStakeId}
            format={(id) => {
              const s = stakeById(id)!;
              return (
                <span className="inline-flex flex-col items-start leading-tight">
                  <span>{s.label}</span>
                  <span className="text-[10px] font-medium opacity-70">
                    ${s.buyIn} · {s.smallBlind}/{s.bigBlind}
                  </span>
                </span>
              );
            }}
          />
          <ChoiceRow
            label="Seats"
            name="host-seats"
            selected={maxSeats}
            options={SEAT_OPTIONS}
            onSelect={setMaxSeats}
          />
          <ChoiceRow
            label="Starting bots"
            name="host-bots"
            selected={botCount}
            options={Array.from({ length: maxBots + 1 }, (_, n) => n)}
            onSelect={setBotCount}
            format={(n) => (n === 0 ? 'None' : String(n))}
          />
          <label className="block">
            <span className="hud-label">Room code (optional)</span>
            <input
              value={customRoomCode}
              onChange={(e) => setCustomRoomCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="hud-input font-mono tracking-[0.2em]"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              autoComplete="off"
            />
            <span className="field-help">
              Leave blank to auto-generate, or enter 4–8 digits
            </span>
          </label>

          <FriendInvitePicker
            sessionToken={sessionToken}
            selectedIds={inviteFriendIds}
            onChange={setInviteFriendIds}
            disabled={busy}
            maxSelect={Math.max(0, maxFriendInvites)}
            title="Invite friends"
            help={
              maxFriendInvites === 0
                ? 'Free a seat (reduce bots) to invite friends.'
                : 'They get a table invite in Friends. Optional — share the room code too.'
            }
          />

          <button disabled={busy} type="submit" className="btn-primary mt-1 min-h-11 w-full">
            {busy
              ? 'Creating…'
              : inviteFriendIds.length > 0
                ? `Create table · invite ${inviteFriendIds.length}`
                : 'Create private table'}
          </button>
        </LobbySplitCard>
      </form>
    </LobbyPageShell>
  );
}
