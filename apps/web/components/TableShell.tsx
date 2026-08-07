'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChatPanel } from './ChatPanel';
import {
  ChatActionDock,
  FloatingActionDock,
  loadActionPlacement,
  saveActionPlacement,
  type ActionPlacement,
} from './FloatingActionDock';
import { MobileQuickReactions } from './MobileQuickReactions';
import { TableActionToast } from './TableActionToast';
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
        <span className="rounded-full border border-mushroom/40 bg-sidebar/90 px-3 py-1 text-xs font-display font-semibold uppercase tracking-wider text-mushroom backdrop-blur">
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
  actions,
  actionsExpanded = false,
}: {
  children: ReactNode;
  onSend: (text: string) => void;
  onEmoji: (emoji: string) => void;
  /** Controlled mobile chat drawer (optional). */
  chatOpen?: boolean;
  onChatOpenChange?: (open: boolean) => void;
  /** Action controls (ActionControls). Placed bottom on mobile; float or chat on laptop. */
  actions?: ReactNode;
  actionsExpanded?: boolean;
}) {
  const narrow = useIsNarrow();
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [actionPlacement, setActionPlacement] = useState<ActionPlacement>('float');
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
    setActionPlacement(loadActionPlacement());
  }, []);

  function setChatVisible(visible: boolean) {
    setDesktopOpen(visible);
    try {
      localStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
    } catch {
      /* ignore */
    }
    // Hiding chat while actions are docked → float so controls stay reachable.
    if (!visible && actionPlacement === 'chat') {
      setActionPlacement('float');
      saveActionPlacement('float');
    }
  }

  function placeActions(next: ActionPlacement) {
    setActionPlacement(next);
    saveActionPlacement(next);
    if (next === 'chat') {
      setDesktopOpen(true);
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  }

  const showFloat = !!actions && (narrow || actionPlacement === 'float');
  const showChatDock = !!actions && !narrow && actionPlacement === 'chat' && desktopOpen;

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      <EmojiOverlay />
      <TableActionToast />

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
          narrow ? 'px-0 py-0' : 'px-4 py-2'
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        {narrow ? <MobileQuickReactions onEmoji={onEmoji} /> : null}
        {showFloat ? (
          <FloatingActionDock
            expanded={actionsExpanded}
            label="Actions"
            onDockToChat={!narrow ? () => placeActions('chat') : undefined}
          >
            {actions}
          </FloatingActionDock>
        ) : null}
      </div>

      {!narrow && desktopOpen ? (
        <aside className="relative flex w-[21rem] shrink-0 flex-col overflow-hidden border-l border-sidebar/12 bg-mushroom shadow-[-8px_0_28px_rgb(29_4_50/0.06)]">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ChatPanel
              onSend={onSend}
              onEmoji={onEmoji}
              onClose={() => setChatVisible(false)}
              closeLabel="Hide"
            />
          </div>
          {showChatDock ? (
            <ChatActionDock expanded={actionsExpanded} onFloat={() => placeActions('float')}>
              {actions}
            </ChatActionDock>
          ) : null}
        </aside>
      ) : null}

      {!narrow && !desktopOpen ? (
        <button
          type="button"
          onClick={() => setChatVisible(true)}
          className="fixed right-4 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-sidebar/20 bg-white px-3 py-5 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-sidebar shadow-[0_10px_28px_rgb(29_4_50/0.12)] transition hover:border-sidebar/35 hover:bg-mushroom"
          style={{ writingMode: 'vertical-rl' }}
          title="Show chat"
        >
          Chat
        </button>
      ) : null}

      {/* Floating Chat CTA only when not controlled by table overflow */}
      {narrow && chatOpen === undefined && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed right-2 top-2 z-40 flex h-11 min-w-11 items-center justify-center rounded-full border border-sidebar/20 bg-white px-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-sidebar shadow-[0_8px_24px_rgb(29_4_50/0.12)]"
        >
          Chat
        </button>
      )}

      {narrow && mobileOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0 bg-sidebar/35 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(100%,22rem)] flex-col overflow-hidden border-l border-sidebar/12 bg-mushroom shadow-[-12px_0_40px_rgb(29_4_50/0.18)] pb-[env(safe-area-inset-bottom)]">
            <ChatPanel
              onSend={onSend}
              onEmoji={onEmoji}
              onClose={() => setMobileOpen(false)}
              closeLabel="Close"
            />
          </aside>
        </div>
      )}
    </div>
  );
}
