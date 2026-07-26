'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChatPanel } from './ChatPanel';

const STORAGE_KEY = 'felt-chat-open';

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === '0') setDesktopOpen(false);
      if (raw === '1') setDesktopOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  function setChatVisible(visible: boolean) {
    setDesktopOpen(visible);
    try {
      localStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative flex h-[calc(100dvh-4.25rem)] min-h-0 -mx-4 sm:-mx-8 -my-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 sm:px-8 py-4">
        {children}
      </div>

      {desktopOpen ? (
        <aside className="hidden md:flex w-80 shrink-0 flex-col border-l border-cyan/15 bg-ink-panel relative">
          <button
            type="button"
            onClick={() => setChatVisible(false)}
            className="absolute right-2 top-2.5 z-20 rounded border border-cream/15 px-2 py-1 text-[10px] font-display uppercase tracking-wider text-cream/55 hover:border-cyan/40 hover:text-cyan"
            title="Hide chat"
          >
            Hide
          </button>
          <ChatPanel onSend={onSend} onEmoji={onEmoji} />
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setChatVisible(true)}
          className="hidden md:flex fixed right-4 top-1/2 z-40 -translate-y-1/2 flex-col items-center gap-2 rounded border border-cyan/40 bg-ink-panel/95 px-2.5 py-4 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-cyan shadow-hud backdrop-blur writing-mode-vertical"
          style={{ writingMode: 'vertical-rl' }}
          title="Show chat"
        >
          Comms
        </button>
      )}

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 rounded border border-cyan/40 bg-ink-panel/95 px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider text-cyan shadow-hud backdrop-blur"
      >
        Comms
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0 bg-black/65"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(100%,20rem)] flex-col border-l border-cyan/20 bg-ink-panel shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
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
