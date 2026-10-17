import Link from 'next/link';
import { useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import type { FriendSuggestion } from '@/lib/api';
import { publicProfileHref } from '@/lib/publicProfile';
import { IconAction, XIcon } from './icons';

const COLLAPSED_COUNT = 5;

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
      <h2
        id="friend-suggestions-heading"
        className="text-[11px] font-bold uppercase tracking-wider text-muted"
      >
        People you may know
      </h2>
      <ul className="surface-list bg-white/80">
        {visible.map((s) => {
          const handle = s.username ?? s.name;
          const rowBusy = busy === s.userId || busy === `dismiss-${s.userId}`;
          return (
            <li key={s.userId} className="flex items-center gap-3 bg-raised/60 px-3 py-2.5">
              <Link
                href={publicProfileHref(handle)}
                className="relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40"
                title={`View ${handle}`}
              >
                <PlayerAvatar
                  userId={s.userId}
                  avatarId={s.avatarId}
                  avatarUrl={s.avatarUrl}
                  size={32}
                  title={handle}
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
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
                <span className="font-row-label block truncate hover:underline">{handle}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">
                  {suggestionReasonLabel(s)}
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="ghost"
                  disabled={disabled || rowBusy}
                  onClick={() => onAdd(s.userId)}
                  className="py-1.5 px-3 text-xs"
                >
                  Add friend
                </Button>
                <IconAction
                  label={`Hide ${handle}`}
                  tone="ghost"
                  disabled={disabled || rowBusy}
                  onClick={() => onDismiss(s)}
                >
                  <XIcon className="h-4 w-4" />
                </IconAction>
              </div>
            </li>
          );
        })}
      </ul>
      {suggestions.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          className="self-start text-xs font-semibold text-muted hover:text-primary"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : `Show more (${hiddenCount})`}
        </button>
      ) : null}
    </section>
  );
}
