'use client';

import { AppleEmojiText } from '@/components/AppleEmoji';
import { useSession } from '@/lib/store';

const MAX_LINES = 3;

/** Last few player chat lines on phone tables. Tap opens the chat drawer. */
export function RecentChatTicker({ onOpen }: { onOpen: () => void }) {
  const chat = useSession((s) => s.chat);
  const lines = chat.filter((m) => m.userId !== 'system').slice(-MAX_LINES);
  if (lines.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open chat"
      className="glass-sheet flex max-h-[4.5rem] w-full min-w-0 flex-col justify-end gap-0.5 overflow-hidden rounded-xl border border-sidebar/10 px-2.5 py-1.5 text-left shadow-[0_4px_14px_rgb(29_4_50/0.08)] backdrop-blur-sm"
    >
      {lines.map((m, i) => (
        <p
          key={`${m.at}-${m.userId}-${i}`}
          className="flex min-w-0 items-baseline gap-1.5 truncate text-[12px] leading-snug text-ink-strong"
        >
          <span className="shrink-0 font-display text-[10px] font-bold uppercase tracking-wider text-ink-strong">
            {m.name}
          </span>
          <span className="min-w-0 truncate">
            <AppleEmojiText text={m.text} emojiSize={14} />
          </span>
        </p>
      ))}
    </button>
  );
}
