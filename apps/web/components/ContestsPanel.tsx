'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { contestModeLabel } from '@/lib/contestLabels';
import {
  type ContestMode,
  type ContestView,
  createContest,
} from '@/lib/api';
import { useSession } from '@/lib/store';
import { LobbySplitCard } from './LobbySplitCard';
import { resolvePublicImage } from '@/lib/assets';
import { ChoiceRow } from './ChoiceRow';
import { FriendInvitePicker } from './FriendInvitePicker';
import { Button } from '@/components/ui/Button';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { StatusChip } from '@/components/ui/StatusChip';
import type { StatusChipTone } from '@/components/ui/StatusChip';

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9] as const;
const HAND_LIMITS = [10, 15, 20, 30, 50] as const;

const FORMAT_TABS: {
  id: ContestMode;
  label: string;
  title: string;
  body: string;
  points: string[];
}[] = [
  {
    id: 'chips',
    label: 'Knockout',
    title: 'Knockout freezeout',
    body: 'Equal start stack for everyone. No top-ups once play begins.',
    points: [
      'Same stack for every seat at the start',
      "Bust out and you're eliminated",
      'Last player standing wins ranking Whuffies',
    ],
  },
  {
    id: 'rounds',
    label: 'Rounds',
    title: 'Fixed-hand session',
    body: 'Play a set number of hands. Top-ups allowed if you go broke.',
    points: [
      'Top ups between hands when stack is zero',
      'Session ends after the hand limit',
      'Stack rank decides place — win ranking Whuffies',
    ],
  },
];

function sizeBlurb(fieldSize: number): string {
  if (fieldSize === 2) return 'Max 2 seats — heads-up when the contest starts';
  return `Up to ${fieldSize} seats; start once at least 2 players have joined`;
}

function handsBlurb(handLimit: number): string {
  return `${handLimit} hands, then standings by stack`;
}

function statusLabel(status: ContestView['status']): string {
  switch (status) {
    case 'registering':
      return 'Registering';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

function statusChipTone(status: ContestView['status']): StatusChipTone {
  switch (status) {
    case 'completed':
      return 'neutral';
    case 'running':
      return 'running';
    case 'cancelled':
      return 'danger';
    default:
      return 'muted';
  }
}

function ContestListItem({
  contest,
  meta,
  disabled,
  onOpen,
}: {
  contest: ContestView;
  meta?: string;
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-sidebar/10 bg-mushroom/60 px-3 py-2.5 text-left transition hover:border-sidebar/25 hover:bg-sidebar/[0.04] disabled:opacity-50"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink-strong">{contest.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusChip
              tone={statusChipTone(contest.status)}
              className="px-1.5 py-0.5 text-[9px] tracking-[0.12em]"
            >
              {statusLabel(contest.status)}
            </StatusChip>
            {meta ? (
              <span className="text-[11px] text-ink-strong-muted">{meta}</span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-ink-strong-muted">
          {contestModeLabel(contest.mode)} · {contest.entrants.length}/{contest.fieldSize}
          {contest.mode === 'rounds' && contest.handLimit ? ` · ${contest.handLimit}h` : ''}
        </span>
      </button>
    </li>
  );
}

export function ContestsPanel({
  disabled,
  sessionToken,
  displayName,
  imageSrc,
  imageAlt,
  onEnsureSession,
  onOpenContest,
  onJoinCode,
}: {
  disabled?: boolean;
  sessionToken: string | null;
  displayName: string;
  imageSrc?: string;
  imageAlt?: string;
  onEnsureSession: () => Promise<{ userId: string; name: string; sessionToken: string }>;
  onOpenContest: (contestId: string) => void;
  onJoinCode: (code: string) => Promise<void>;
}) {
  const open = useSession((s) => s.publicContests);
  const [mode, setMode] = useState<ContestMode>('chips');
  const [fieldSize, setFieldSize] = useState(6);
  const [handLimit, setHandLimit] = useState(20);
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listError: string | null = null;

  const maxFriendInvites = Math.min(8, Math.max(0, fieldSize - 1));
  const moreSummary =
    inviteFriendIds.length === 0
      ? 'No invites'
      : `${inviteFriendIds.length} invite${inviteFriendIds.length === 1 ? '' : 's'}`;

  useEffect(() => {
    if (inviteFriendIds.length > maxFriendInvites) {
      setInviteFriendIds((ids) => ids.slice(0, maxFriendInvites));
    }
  }, [maxFriendInvites, inviteFriendIds.length]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken && !displayName.trim()) {
      setError('Sign in to host a contest');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await onEnsureSession();
      const { contest } = await createContest(
        {
          name: `${session.name}'s ${contestModeLabel(mode)} Contest`,
          mode,
          fieldSize,
          startingStack: 1000,
          smallBlind: 5,
          bigBlind: 10,
          isPrivate: true,
          autoStart: false,
          handLimit: mode === 'rounds' ? handLimit : undefined,
          inviteFriendIds,
        },
        session.sessionToken,
      );
      onOpenContest(contest.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!invite.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onJoinCode(invite.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const ctaLabel =
    mode === 'rounds'
      ? `Create · max ${fieldSize} · ${handLimit} hands`
      : `Create · max ${fieldSize} freezeout`;
  const submitLabel =
    inviteFriendIds.length > 0
      ? `${ctaLabel} · invite ${inviteFriendIds.length}`
      : ctaLabel;

  return (
    <LobbySplitCard
      imageSrc={resolvePublicImage(imageSrc || '/home-knockout.png')}
      imageAlt={imageAlt || 'Multi-seat tournament table ready to fill'}
      alignTop
    >
      <form onSubmit={onCreate} className="flex flex-col gap-5">
        <div className="min-w-0">
          <ChoiceRow
            label="Contest format"
            name="contest-format"
            variant="segmented"
            selected={mode}
            options={FORMAT_TABS.map((tab) => tab.id)}
            onSelect={setMode}
            disabled={disabled || busy}
            format={(id) => FORMAT_TABS.find((tab) => tab.id === id)?.label ?? id}
          />

          {FORMAT_TABS.map((tab) => {
            if (tab.id !== mode) return null;
            return (
              <div
                key={tab.id}
                className="mt-3 rounded-xl border border-sidebar/10 bg-gradient-to-b from-mushroom/70 to-mushroom/35 px-3.5 py-3.5 sm:px-4"
              >
                <p className="font-display text-sm font-semibold tracking-tight text-ink-strong">
                  {tab.title}
                </p>
                <p className="font-prose-muted mt-1">{tab.body}</p>
                <ul className="mt-3 space-y-1.5">
                  {tab.points.map((point) => (
                    <li
                      key={point}
                      className="flex gap-2 text-xs leading-snug text-ink-strong-muted"
                    >
                      <span
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sidebar/55"
                        aria-hidden
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="min-w-0">
          <ChoiceRow
            label="Max table size"
            name="contest-size"
            selected={fieldSize}
            options={[...TABLE_SIZES]}
            onSelect={setFieldSize}
            format={(n) => String(n)}
          />
          <p className="field-help mt-2.5">{sizeBlurb(fieldSize)}</p>
        </div>

        {mode === 'rounds' && (
          <div className="min-w-0">
            <ChoiceRow
              label="Hands"
              name="contest-hands"
              selected={handLimit}
              options={[...HAND_LIMITS]}
              onSelect={setHandLimit}
              format={(n) => String(n)}
            />
            <p className="field-help mt-2.5">{handsBlurb(handLimit)}</p>
          </div>
        )}

        <CollapsibleSection title="Invite friends" summary={moreSummary}>
            <FriendInvitePicker
              sessionToken={sessionToken}
              selectedIds={inviteFriendIds}
              onChange={setInviteFriendIds}
              disabled={disabled || busy}
              maxSelect={Math.max(0, maxFriendInvites)}
              help="They get a contest invite in Friends. Start once at least two players have joined."
            />
        </CollapsibleSection>

        <div>
          <Button
            disabled={disabled || busy}
            type="submit"
            className="min-h-11 w-full sm:w-auto sm:min-w-[14rem]"
          >
            {busy ? 'Starting…' : submitLabel}
          </Button>
          <p className="field-help mt-2.5">
            Share the contest code after you create it. Need at least two human players to start.
          </p>
        </div>
      </form>

      {open.length > 0 && (
        <div className="border-t border-sidebar/10 pt-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-strong/45">
              Open now
            </p>
            <span className="text-xs tabular-nums text-ink-strong-muted">{open.length}</span>
          </div>
          <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
            {open.map((c) => (
              <ContestListItem
                key={c.id}
                contest={c}
                disabled={disabled || busy}
                onOpen={() => onOpenContest(c.id)}
              />
            ))}
          </ul>
        </div>
      )}

      {(error || listError) && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm leading-snug text-danger"
        >
          {error ?? listError}
        </p>
      )}

      {sessionToken ? (
        <Link
          href="/profile?tab=contests"
          className="surface-row flex items-center justify-between gap-3 bg-mushroom/45 px-3.5 py-3 transition hover:border-sidebar/25 hover:bg-sidebar/[0.04] sm:px-4"
        >
          <span className="min-w-0">
            <span className="block font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-strong/45">
              Your contests
            </span>
            <span className="mt-1 block text-sm font-medium text-ink-strong">
              View contest history on your profile
            </span>
          </span>
          <span className="shrink-0 text-xs font-display font-semibold uppercase tracking-[0.12em] text-sidebar">
            Profile →
          </span>
        </Link>
      ) : null}
    </LobbySplitCard>
  );
}
