'use client';

import { useState, type ReactNode } from 'react';
import { ChatPanel } from './ChatPanel';

/** Table + full-height chat sidebar (drawer on small screens). */
export function TableShell({
  children,
  onSend,
  onEmoji,
}: {
  children: ReactNode;
  onSend: (text: string) => void;
  onEmoji: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex h-[calc(100dvh-4.25rem)] min-h-0 -mx-4 sm:-mx-8 -my-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 sm:px-8 py-4">
        {children}
      </div>

      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex w-80 shrink-0 flex-col border-l border-cyan/15 bg-ink-panel">
        <ChatPanel onSend={onSend} onEmoji={onEmoji} />
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 rounded border border-cyan/40 bg-ink-panel/95 px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider text-cyan shadow-hud backdrop-blur"
      >
        Comms
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0 bg-black/65"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(100%,20rem)] flex-col border-l border-cyan/20 bg-ink-panel shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 z-20 rounded border border-cream/15 px-2 py-1 text-[10px] font-display uppercase tracking-wider text-cream/60 hover:bg-cream/10"
            >
              Close
            </button>
            <ChatPanel onSend={onSend} onEmoji={onEmoji} />
          </aside>
        </div>
      )}
    </div>
  );
}
