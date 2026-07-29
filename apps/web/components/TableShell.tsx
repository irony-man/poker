'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChatPanel } from './ChatPanel';
import { useSession } from '@/lib/store';
import { useIsNarrow } from '@/lib/tableLayout';

const STORAGE_KEY = 'felt-chat-open';

function EmojiOverlay() {
  const burst = useSession((s) => s.emojiBurst);
  if (!burst) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 animate-bounce">
        <span className="text-7xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)]">{burst.emoji}</span>
        <span className="rounded-full border border-gold/40 bg-ink/80 px-3 py-1 text-xs font-display font-semibold uppercase tracking-wider text-gold backdrop-blur">
          {burst.name}
        </span>
      </div>
    </div>
  );
}

/** Table + full-height chat sidebar (drawer on phone portrait/landscape). */
export function TableShell({
  children,
  onSend,
  onEmoji,
  chatOpen,
  onChatOpenChange,
}: {
  children: ReactNode;
  onSend: (text: string) => void;
  onEmoji: (emoji: string) => void;
  /** Controlled mobile chat drawer (optional). */
  chatOpen?: boolean;
  onChatOpenChange?: (open: boolean) => void;
}) {
  const narrow = useIsNarrow();
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const mobileOpen = chatOpen ?? internalMobileOpen;
  const setMobileOpen = onChatOpenChange ?? setInternalMobileOpen;

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
    <div
      className={`relative flex min-h-0 ${
        narrow
          ? 'h-[100dvh] -mx-1.5 -my-1'
          : 'h-[calc(100dvh-3.5rem)] -mx-8 -my-4'
      }`}
    >
      <EmojiOverlay />

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
          narrow ? 'px-1 py-0.5' : 'px-4 py-2'
        }`}
      >
        {children}
      </div>

      {!narrow && desktopOpen ? (
        <aside className="relative flex w-80 shrink-0 flex-col border-l border-cyan/15 bg-ink-panel">
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
      ) : null}

      {!narrow && !desktopOpen ? (
        <button
          type="button"
          onClick={() => setChatVisible(true)}
          className="fixed right-4 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded border border-cyan/40 bg-ink-panel/95 px-2.5 py-4 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-cyan shadow-hud backdrop-blur"
          style={{ writingMode: 'vertical-rl' }}
          title="Show chat"
        >
          Comms
        </button>
      ) : null}

      {/* Floating Chat CTA only when not controlled by table overflow */}
      {narrow && chatOpen === undefined && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed right-2 top-2 z-40 flex h-11 min-w-11 items-center justify-center rounded-full border border-cyan/40 bg-ink-panel/95 px-3 text-[10px] font-display font-bold uppercase tracking-wider text-cyan shadow-hud backdrop-blur"
        >
          Chat
        </button>
      )}

      {narrow && mobileOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0 bg-black/65"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(100%,20rem)] flex-col border-l border-cyan/20 bg-ink-panel shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-2 z-20 flex h-11 items-center rounded border border-cream/15 px-3 text-[10px] font-display uppercase tracking-wider text-cream/60 hover:bg-cream/10"
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
