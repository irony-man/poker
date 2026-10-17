import Link from 'next/link';
import { useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import type { FriendSuggestion } from '@/lib/api';
import { publicProfileHref } from '@/lib/publicProfile';
import { AddFriendIcon, XIcon } from './icons';

const COLLAPSED_COUNT = 3;

export function suggestionReasonLabel(s: FriendSuggestion): string {
  let mutual = '';
  if (s.mutualCount > 0) {
    mutual = `${s.mutualCount} mutual friend${s.mutualCount === 1 ? '' : 's'}`;
  }
  const played =
    s.handsTogether > 0
      ? `Played ${s.handsTogether} hand${s.handsTogether === 1 ? '' : 's'} together`
      : '';
  return [mutual, played].filter(Boolean).join(' · ');
}

export function FriendSuggestions({
  suggestions,
  busy,
  disabled,
  onAdd,
  onDismiss,
}: {
  suggestions: FriendSuggestion[];
  busy: string | null;
  disabled: boolean;
  onAdd: (userId: string) => void;
  onDismiss: (suggestion: FriendSuggestion) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (suggestions.length === 0) return null;

  const visible = expanded ? suggestions : suggestions.slice(0, COLLAPSED_COUNT);
  const hiddenCount = suggestions.length - visible.length;

  return (
    <section aria-labelledby="friend-suggestions-heading" className="flex flex-col gap-2">
      <h2 id="friend-suggestions-heading" className="hud-label">
        People you may know
      </h2>
      <ul className="surface-list bg-white/80">
        {visible.map((s) => {
          const handle = s.username ?? s.name;
          const rowBusy = busy === s.userId || busy === `dismiss-${s.userId}`;
          return (
            <li
              key={s.userId}
              className="flex items-center gap-3 bg-raised/60 px-3 py-2.5 transition-colors hover:bg-raised"
            >
              <Link
                href={publicProfileHref(handle)}
                className="relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40"
                title={`View ${handle}`}
              >
                <PlayerAvatar
                  userId={s.userId}
                  avatarId={s.avatarId}
                  avatarUrl={s.avatarUrl}
                  size={36}
                  title={handle}
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                    s.online ? 'bg-positive' : 'bg-sidebar/25'
                  }`}
                  title={s.online ? 'Online' : 'Offline'}
                  aria-hidden
                />
              </Link>
              <Link
                href={publicProfileHref(handle)}
                className="min-w-0 flex-1 outline-none focus-visible:underline"
              >
                <span className="block truncate text-sm font-medium leading-5 text-primary hover:underline">
                  {handle}
                </span>
                <span className="block truncate text-[11px] leading-4 text-muted">
                  {suggestionReasonLabel(s)}
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled || rowBusy}
                  onClick={() => onAdd(s.userId)}
                  aria-label={`Add ${handle} as a friend`}
                  className="inline-flex items-center gap-1.5"
                >
                  <AddFriendIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add friend</span>
                </Button>
                <button
                  type="button"
                  disabled={disabled || rowBusy}
                  onClick={() => onDismiss(s)}
                  aria-label={`Hide ${handle}`}
                  title={`Hide ${handle}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-sidebar/[0.06] hover:text-primary focus-visible:bg-sidebar/[0.06] focus-visible:outline-none disabled:opacity-40"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {suggestions.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          className="self-start text-xs font-semibold text-sidebar underline-offset-2 hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : `Show more (${hiddenCount})`}
        </button>
      ) : null}
    </section>
  );
}
