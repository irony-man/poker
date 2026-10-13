'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { FriendInvitePicker } from '@/components/FriendInvitePicker';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { inviteTableFriends } from '@/lib/api';
import { useSession } from '@/lib/store';
import { useModalFocus } from '@/lib/useModalFocus';

export const MAX_TABLE_SEATS = 9;

/** Pending invites the host sent for this table (live via social_sync). */
export function PendingTableInvites({ tableId }: { tableId: string }) {
  const outgoing = useSession((s) => s.social?.outgoingChallenges);
  const pending = useMemo(
    () => (outgoing ?? []).filter((c) => c.tableId === tableId),
    [outgoing, tableId],
  );
  if (pending.length === 0) return null;
  return (
    <div>
      <p className="hud-label">Invited · waiting to join</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {pending.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-1.5 rounded-full border border-sidebar/10 bg-page/50 py-0.5 pl-0.5 pr-2.5 text-xs text-primary"
          >
            <PlayerAvatar
              userId={c.challenged.userId}
              avatarId={c.challenged.avatarId}
              avatarUrl={c.challenged.avatarUrl}
              size={22}
            />
            <span className="max-w-[9rem] truncate">{c.challenged.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Friend picker + Invite button for a hosted table (lobby and in-game). */
export function TableInviteFriends({
  tableId,
  seatedUserIds,
  seatedCount,
  help,
}: {
  tableId: string;
  /** Humans already at the table — hidden from the picker. */
  seatedUserIds: string[];
  seatedCount: number;
  help?: string;
}) {
  const sessionToken = useSession((s) => s.sessionToken);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openSlots = Math.max(0, MAX_TABLE_SEATS - seatedCount);

  const invite = async () => {
    if (!sessionToken || selected.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await inviteTableFriends(tableId, selected, { sessionToken, silent: true });
      const n = res.inviteCount;
      setNotice(`Invited ${n} friend${n === 1 ? '' : 's'}`);
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  if (openSlots === 0) {
    return (
      <p className="field-help">Table is full ({MAX_TABLE_SEATS} players) — no more invites.</p>
    );
  }

  return (
    <div className="space-y-2.5">
      <FriendInvitePicker
        sessionToken={sessionToken}
        selectedIds={selected}
        onChange={(ids) => {
          setSelected(ids);
          setNotice(null);
        }}
        disabled={busy}
        maxSelect={openSlots}
        excludeUserIds={seatedUserIds}
        title="Invite friends"
        help={help ?? `Up to ${openSlots} more · seats are added for invited friends (max ${MAX_TABLE_SEATS}).`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || selected.length === 0}
          onClick={() => void invite()}
        >
          {busy ? 'Inviting…' : selected.length > 0 ? `Invite ${selected.length}` : 'Invite'}
        </Button>
        {notice ? (
          <span role="status" className="text-xs font-semibold text-positive">
            {notice}
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-xs font-semibold text-danger">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** In-game sheet for the host to invite more friends mid-session. */
export function TableInviteSheet({
  open,
  onClose,
  tableId,
  seatedUserIds,
  seatedCount,
}: {
  open: boolean;
  onClose: () => void;
  tableId: string;
  seatedUserIds: string[];
  seatedCount: number;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useModalFocus({ open, containerRef: dialogRef, onClose: close });
  if (!open) return null;
  return (
    <div
      className="lobby-paper fixed inset-0 z-[60] flex items-end justify-center bg-overlay/55 p-3 backdrop-blur-[3px] sm:items-center sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-invite-title"
        tabIndex={-1}
        className="surface-modal flex max-h-[min(80dvh,40rem)] w-full max-w-md flex-col"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-sidebar/10 px-4 py-3">
          <h2 id="table-invite-title" className="font-display text-lg font-bold text-sidebar">
            Invite friends
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <p className="text-xs text-muted">
            Seats are added for invited friends (max {MAX_TABLE_SEATS}). During a hand, new seats
            open when the hand ends.
          </p>
          <PendingTableInvites tableId={tableId} />
          <TableInviteFriends
            tableId={tableId}
            seatedUserIds={seatedUserIds}
            seatedCount={seatedCount}
          />
        </div>
      </div>
    </div>
  );
}
