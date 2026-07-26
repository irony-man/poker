'use client';

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

  return (
    <div className="flex flex-col h-48 md:h-full rounded-xl border border-cream/10 bg-ink/60 overflow-hidden">
      <div className="px-3 py-2 text-xs uppercase tracking-wider text-cream/50 border-b border-cream/10">
        Table chat
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-sm">
        {chat.map((m, i) => {
          const isSystem = m.userId === 'system';
          return (
            <div
              key={`${m.at}-${i}`}
              className={isSystem ? 'text-cream/70 italic' : undefined}
            >
              <span className={`font-semibold ${isSystem ? 'text-cream/50 not-italic' : 'text-gold-light'}`}>
                {m.name}
              </span>
              <span className="text-cream/40"> · </span>
              <span>{m.text}</span>
            </div>
          );
        })}
      </div>
      {emojiBurst && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-5xl animate-bounce">
          {emojiBurst.emoji}
        </div>
      )}
      <div className="flex gap-1 px-2 py-2 border-t border-cream/10">
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
        className="flex gap-2 p-2 border-t border-cream/10"
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
