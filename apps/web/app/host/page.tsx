'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceRow } from '@/components/ChoiceRow';
import { FriendInvitePicker } from '@/components/FriendInvitePicker';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { resolvePublicImage } from '@/lib/assets';
import { Button } from '@/components/ui/Button';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { TextField } from '@/components/ui/TextField';
import { createTable, fetchPublicBotGroups, type PublicBotGroup } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';
import { DEFAULT_STAKE_ID, STAKE_PRESETS, stakeById } from '@poker/protocol';
import { MoneyAmount } from '@/components/CurrencyIcon';

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function HostPage() {
  const router = useRouter();
  const { authReady, signedIn, sessionToken, ensureSession } = useLobbySession();
  const pageCopy = usePageCopy('host');
  const [maxSeats, setMaxSeats] = useState(6);
  const [botCount, setBotCount] = useState(0);
  const [botGroups, setBotGroups] = useState<PublicBotGroup[]>([]);
  const [botGroupId, setBotGroupId] = useState<string | null>(null);
  const [hostStakeId, setHostStakeId] = useState(DEFAULT_STAKE_ID);
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxBots = Math.max(0, maxSeats - 1);
  const maxFriendInvites = Math.min(8, Math.max(0, maxSeats - botCount - 1));
  const codePreview = customRoomCode.trim();
  const moreSummary =
    `${botCount === 0 ? 'No bots' : `${botCount} bot${botCount === 1 ? '' : 's'}`}` +
    ` · ${codePreview ? `code ${codePreview}` : 'auto code'}`;

  useEffect(() => {
    if (botCount > maxBots) setBotCount(maxBots);
  }, [maxSeats, botCount, maxBots]);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBotGroups().then((groups) => {
      if (cancelled) return;
      setBotGroups(groups);
      setBotGroupId((cur) => {
        if (cur && groups.some((g) => g.id === cur)) return cur;
        return groups.find((g) => g.isDefault)?.id ?? groups[0]?.id ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
          ...(botCount > 0 && botGroupId ? { botGroupId } : {}),
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
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <LobbyPageShell
      title={pageCopy.title}
      subtitle={pageCopy.subtitle}
      signedIn={signedIn}
      error={error}
    >
      <form onSubmit={onCreate}>
        <LobbySplitCard
          imageSrc={resolvePublicImage(pageCopy.image ?? '/host-table.png')}
          imageAlt={pageCopy.imageAlt ?? 'Host a private table for your group'}
        >
          <ChoiceRow
            label="Stakes"
            name="host-stakes"
            selected={hostStakeId}
            options={STAKE_PRESETS.map((s) => s.id)}
            onSelect={setHostStakeId}
            format={(id) => {
              const s = stakeById(id)!;
              return (
                <div className="inline-flex flex-col items-start leading-tight">
                  <div>{s.label}</div>
                  <div className="text-[10px] flex items-center gap-1 font-medium opacity-70">
                    <MoneyAmount
                        amount={s.buyIn}
                        showChips
                        chipsClassName="!h-3.5 sm:!h-3.5"
                      />
                      <div>
                        {s.smallBlind}/{s.bigBlind}
                      </div>
                  </div>
                </div>
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

          <CollapsibleSection title="Bots & room code" summary={moreSummary}>
              <ChoiceRow
                label="Starting bots"
                name="host-bots"
                selected={botCount}
                options={Array.from({ length: maxBots + 1 }, (_, n) => n)}
                onSelect={setBotCount}
                format={(n) => (n === 0 ? 'None' : String(n))}
              />
              {botCount > 0 && botGroups.length > 0 ? (
                <ChoiceRow
                  name="host-bot-group"
                  selected={botGroupId ?? botGroups[0]!.id}
                  options={botGroups.map((g) => g.id)}
                  onSelect={setBotGroupId}
                  format={(id) => {
                    const g = botGroups.find((x) => x.id === id);
                    if (!g) return id;
                    return (
                      <span className="inline-flex flex-col items-start leading-tight">
                        {g.name}
                      </span>
                    );
                  }}
                />
              ) : null}
              <TextField
                variant="hud"
                label="Room code (optional)"
                value={customRoomCode}
                onChange={(e) => setCustomRoomCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="font-mono tracking-[0.2em]"
                inputMode="numeric"
                pattern="\d{4,8}"
                maxLength={8}
                autoComplete="off"
                help="Leave blank to auto-generate, or enter 4–8 digits"
              />
          </CollapsibleSection>

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

          <Button disabled={busy} type="submit" className="mt-1 min-h-11 w-full">
            {busy
              ? 'Creating…'
              : inviteFriendIds.length > 0
                ? `Create table · invite ${inviteFriendIds.length}`
                : 'Create private table'}
          </Button>
        </LobbySplitCard>
      </form>
    </LobbyPageShell>
  );
}
