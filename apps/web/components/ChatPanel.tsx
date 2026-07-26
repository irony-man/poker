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
    <div className="relative flex h-full min-h-0 flex-col bg-[#100e0c]">
      <div className="shrink-0 px-4 py-3 text-xs uppercase tracking-[0.18em] text-cream/45 border-b border-cream/10">
        Table chat
      </div>
      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2 text-sm">
        {chat.length === 0 && (
          <p className="text-cream/35 text-xs">No messages yet.</p>
        )}
        {chat.map((m, i) => {
          const isSystem = m.userId === 'system';
          return (
            <div
              key={`${m.at}-${i}`}
              className={isSystem ? 'text-cream/65 italic' : undefined}
            >
              <span
                className={`font-semibold ${isSystem ? 'text-cream/45 not-italic' : 'text-gold-light'}`}
              >
                {m.name}
              </span>
              <span className="text-cream/35"> · </span>
              <span className="break-words">{m.text}</span>
            </div>
          );
        })}
      </div>
      {emojiBurst && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-5xl animate-bounce">
          {emojiBurst.emoji}
        </div>
      )}
      <div className="shrink-0 flex gap-1 px-3 py-2 border-t border-cream/10">
        {['🔥', '😂', '👏', '😮'].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onEmoji(e)}
            className="rounded-md px-2 py-1 hover:bg-cream/10 text-lg"
          >
            {e}
          </button>
        ))}
      </div>
      <form
        className="shrink-0 flex gap-2 p-3 border-t border-cream/10"
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
          placeholder="Say something…"
          className="flex-1 rounded-md bg-cream/5 border border-cream/10 px-2 py-1.5 text-sm outline-none focus:border-gold/50"
        />
        <button type="submit" className="rounded-md bg-gold/90 text-ink px-3 text-sm font-semibold">
          Send
        </button>
      </form>
    </div>
  );
}
