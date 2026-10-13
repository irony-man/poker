'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceRow } from '@/components/ChoiceRow';
import { BotGroupPicker } from '@/components/BotGroupPicker';
import { FriendInvitePicker } from '@/components/FriendInvitePicker';
import { NewBadge } from '@/components/NewBadge';
import { StakeChoiceRow } from '@/components/StakeChoiceRow';
import { Button } from '@/components/ui/Button';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { TextField } from '@/components/ui/TextField';
import { createTable, fetchPublicBotGroupsWithLabels, type BotGroupLabels, type PublicBotGroup } from '@/lib/api';
import { DEFAULT_BOT_GROUP_LABELS } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { markFeatureSeen } from '@/lib/newFeatures';
import { useNewFeature } from '@/lib/useNewFeature';
import { DEFAULT_STAKE_ID, STAKE_PRESETS, stakeById } from '@poker/protocol';

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export function HostTableForm({
  sessionToken,
  ensureSession,
  disabled,
  onError,
}: {
  sessionToken: string | null;
  ensureSession: () => Promise<{ name: string; sessionToken: string }>;
  disabled?: boolean;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [maxSeats, setMaxSeats] = useState(6);
  const [botCount, setBotCount] = useState(0);
  const [botGroups, setBotGroups] = useState<PublicBotGroup[]>([]);
  const [botGroupLabels, setBotGroupLabels] = useState<BotGroupLabels>([
    ...DEFAULT_BOT_GROUP_LABELS,
  ]);
  const [botGroupId, setBotGroupId] = useState<string | null>(null);
  const [hostStakeId, setHostStakeId] = useState(DEFAULT_STAKE_ID);
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const botGroupsNew = useNewFeature('host-bot-groups');

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
    void fetchPublicBotGroupsWithLabels().then(({ groups, labels }) => {
      if (cancelled) return;
      setBotGroups(groups);
      setBotGroupLabels(labels);
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
    onError(null);
    try {
      const session = await ensureSession();
      const stake = stakeById(hostStakeId) ?? STAKE_PRESETS[1]!;
      const code = customRoomCode.trim();
      if (code && !/^\d{4,8}$/.test(code)) {
        onError('Room code must be 4–8 digits');
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
          lobby: true,
          ...(code ? { inviteCode: code } : {}),
          inviteFriendIds,
        },
        session.sessionToken,
      );
      router.push(`/table/${table.tableId}?invite=${table.inviteCode}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onCreate} className="flex flex-col gap-6">
      <StakeChoiceRow
        name="host-stakes"
        selected={hostStakeId}
        onSelect={setHostStakeId}
        disabled={disabled || busy}
      />
      <ChoiceRow
        label="Seats"
        name="host-seats"
        selected={maxSeats}
        options={SEAT_OPTIONS}
        onSelect={setMaxSeats}
        disabled={disabled || busy}
        trackClassName="grid grid-cols-4 gap-2.5 sm:flex sm:flex-wrap"
        optionClassName="inline-flex min-h-11 min-w-11 items-center justify-center px-0 py-0 text-base font-bold tabular-nums"
      />

      <CollapsibleSection
        title="Bots & room code"
        summary={moreSummary}
        badge={botGroupsNew && botGroups.length > 0 ? <NewBadge tone="light" /> : null}
        onOpenChange={(open) => {
          if (open && botGroups.length > 0) markFeatureSeen('host-bot-groups');
        }}
      >
        <ChoiceRow
          label="Starting bots"
          name="host-bots"
          selected={botCount}
          options={Array.from({ length: maxBots + 1 }, (_, n) => n)}
          onSelect={setBotCount}
          format={(n) => (n === 0 ? 'None' : String(n))}
          disabled={disabled || busy}
          trackClassName="gap-2.5"
          optionClassName="min-h-11 min-w-11 px-3"
        />
        {botCount > 0 && botGroups.length > 0 ? (
          <BotGroupPicker
            groups={botGroups}
            labels={botGroupLabels}
            name="host-bot-group"
            selectedId={botGroupId ?? botGroups[0]!.id}
            onSelect={setBotGroupId}
            disabled={disabled || busy}
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
          disabled={disabled || busy}
        />
      </CollapsibleSection>

      <FriendInvitePicker
        sessionToken={sessionToken}
        selectedIds={inviteFriendIds}
        onChange={setInviteFriendIds}
        disabled={disabled || busy}
        maxSelect={Math.max(0, maxFriendInvites)}
        title="Invite friends"
        help={
          maxFriendInvites === 0
            ? 'Free a seat (reduce bots) to invite friends.'
            : 'They get a table invite in Friends. Optional — share the room code too.'
        }
      />

      <Button disabled={disabled || busy} type="submit" className="mt-1 min-h-12 w-full text-sm">
        {busy
          ? 'Creating…'
          : inviteFriendIds.length > 0
            ? `Create table · invite ${inviteFriendIds.length}`
            : 'Create private table'}
      </Button>
    </form>
  );
}
