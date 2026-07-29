'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/store';

export function ChatPanel({
  onSend,
  onEmoji,
}: {
  onSend: (text: string) => void;
  onEmoji: (emoji: string) => void;
}) {
  const chat = useSession((s) => s.chat);
  const emojiBurst = useSession((s) => s.emojiBurst);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-ink-panel">
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-cyan/15 px-4 py-3 pr-16">
        <span className="text-[11px] font-display font-semibold uppercase tracking-[0.2em] text-cyan">
          Comms
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-felt-neon animate-live-blink" />
      </div>
      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 text-sm">
        {chat.length === 0 && (
          <p className="text-cream/35 text-xs font-medium tracking-wide">Channel quiet…</p>
        )}
        {chat.map((m, i) => {
          const isSystem = m.userId === 'system';
          return (
            <div
              key={`${m.at}-${i}`}
              className={isSystem ? 'text-cream/60 italic border-l-2 border-cyan/20 pl-2' : ''}
            >
              <span
                className={`font-display font-semibold tracking-wide ${
                  isSystem ? 'text-cyan/70 not-italic' : 'text-gold'
                }`}
              >
                {m.name}
              </span>
              <span className="text-cream/30"> · </span>
              <span className="break-words font-medium">{m.text}</span>
            </div>
          );
        })}
      </div>
      {emojiBurst && (
        <div className="pointer-events-none absolute inset-x-0 top-1/4 z-10 text-center text-4xl animate-bounce">
          {emojiBurst.emoji}
        </div>
      )}
      <div className="shrink-0 flex gap-1 px-3 py-2 border-t border-cyan/10">
        {['🔥', '😂', '👏', '😮', '💀', '😎', '👀', '🤖', '🤙', '🤞', '🤠', '🤡', '🤥', '🤦'].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onEmoji(e)}
            className="rounded border border-transparent px-2 py-1 hover:border-cyan/30 hover:bg-cyan/10 text-lg active:scale-90 transition"
            aria-label={`React ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      <form
        className="shrink-0 flex gap-2 p-3 border-t border-cyan/15"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const text = String(fd.get('text') ?? '').trim();
          if (text) onSend(text);
          e.currentTarget.reset();
        }}
      >
        <input
          name="text"
          maxLength={280}
          placeholder="Transmit…"
          className="flex-1 rounded border border-cream/10 bg-ink px-2 py-1.5 text-sm outline-none focus:border-gold/50"
        />
        <button type="submit" className="rounded border border-gold/40 bg-gold/90 px-3 text-xs font-display font-bold uppercase tracking-wider text-ink">
          Send
        </button>
      </form>
    </div>
  );
}
