'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { ChatPanel } from './ChatPanel';
import {
  ChatActionDock,
  FloatingActionDock,
  loadActionPlacement,
  saveActionPlacement,
  type ActionPlacement,
} from './FloatingActionDock';
import { MobileQuickReactions } from './MobileQuickReactions';
import { OnlineFriendsOverlay } from './OnlineFriends';
import { TableActionToast, useSeatActionAutoClear } from './TableActionToast';
import { useSession } from '@/lib/store';
import { useIsNarrow } from '@/lib/tableLayout';

const STORAGE_KEY = 'felt-chat-open';
const CHAT_WIDTH_KEY = 'felt-chat-width';
const DEFAULT_CHAT_WIDTH = 336; // 21rem
const MIN_CHAT_WIDTH = 260;
const MAX_CHAT_WIDTH_CAP = 560;

function loadChatWidth(): number {
  try {
    const raw = localStorage.getItem(CHAT_WIDTH_KEY);
    if (!raw) return DEFAULT_CHAT_WIDTH;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n)) return DEFAULT_CHAT_WIDTH;
    return Math.min(MAX_CHAT_WIDTH_CAP, Math.max(MIN_CHAT_WIDTH, n));
  } catch {
    return DEFAULT_CHAT_WIDTH;
  }
}

function saveChatWidth(width: number) {
  try {
    localStorage.setItem(CHAT_WIDTH_KEY, String(Math.round(width)));
  } catch {
    /* ignore */
  }
}

function maxChatWidth(): number {
  if (typeof window === 'undefined') return MAX_CHAT_WIDTH_CAP;
  // Leave at least ~420px for the felt table.
  return Math.min(MAX_CHAT_WIDTH_CAP, Math.max(MIN_CHAT_WIDTH, window.innerWidth - 420));
}

function clampChatWidth(width: number): number {
  return Math.min(maxChatWidth(), Math.max(MIN_CHAT_WIDTH, Math.round(width)));
}

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
  tableColorId = 0,
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
  /** Viewer table theme preset (0–4). Scopes `.table-theme` CSS tokens. */
  tableColorId?: number;
}) {
  const narrow = useIsNarrow();
  const sessionToken = useSession((s) => s.sessionToken);
  const signedIn = !!sessionToken;
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [actionPlacement, setActionPlacement] = useState<ActionPlacement>('float');
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const mobileOpen = chatOpen ?? internalMobileOpen;
  const setMobileOpen = onChatOpenChange ?? setInternalMobileOpen;
  useSeatActionAutoClear();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === '0') setDesktopOpen(false);
      if (raw === '1') setDesktopOpen(true);
    } catch {
      /* ignore */
    }
    setActionPlacement(loadActionPlacement());
    setChatWidth(loadChatWidth());
  }, []);

  // Clamp when the viewport shrinks so chat never eats the whole table.
  useEffect(() => {
    if (narrow) return;
    const onResize = () => setChatWidth((w) => clampChatWidth(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [narrow]);

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

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startWidth: chatWidth };
      setResizing(true);
    },
    [chatWidth],
  );

  const onResizePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Dragging the left edge: move left → wider chat.
    const next = clampChatWidth(drag.startWidth + (drag.startX - e.clientX));
    setChatWidth(next);
  }, []);

  const endResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setResizing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setChatWidth((w) => {
      const clamped = clampChatWidth(w);
      saveChatWidth(clamped);
      return clamped;
    });
  }, []);

  const showFloat = !!actions && (narrow || actionPlacement === 'float');
  const showChatDock = !!actions && !narrow && actionPlacement === 'chat' && desktopOpen;

  return (
    <div
      className={`table-theme relative flex h-full min-h-0 flex-1 overflow-hidden ${
        resizing ? 'select-none' : ''
      }`}
      data-table-color={tableColorId}
    >
      <EmojiOverlay />
      <TableActionToast />

      <div
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
          narrow ? 'px-0 py-0' : 'px-0 pb-2 pt-0'
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
        {/* Bottom-right of table column only (not over chat) */}
        <OnlineFriendsOverlay signedIn={signedIn} />
      </div>

      {!narrow && desktopOpen ? (
        <aside
          className="relative flex shrink-0 flex-col overflow-hidden border-l border-sidebar/12 bg-mushroom shadow-[-8px_0_28px_rgb(29_4_50/0.06)]"
          style={{ width: chatWidth }}
        >
          {/* Drag handle on the left edge — laptop resize */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat panel"
            aria-valuenow={chatWidth}
            aria-valuemin={MIN_CHAT_WIDTH}
            aria-valuemax={maxChatWidth()}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setChatWidth((w) => {
                  const next = clampChatWidth(w + 16);
                  saveChatWidth(next);
                  return next;
                });
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setChatWidth((w) => {
                  const next = clampChatWidth(w - 16);
                  saveChatWidth(next);
                  return next;
                });
              } else if (e.key === 'Home') {
                e.preventDefault();
                setChatWidth(MIN_CHAT_WIDTH);
                saveChatWidth(MIN_CHAT_WIDTH);
              } else if (e.key === 'End') {
                e.preventDefault();
                const max = maxChatWidth();
                setChatWidth(max);
                saveChatWidth(max);
              }
            }}
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            className={`absolute inset-y-0 left-0 z-20 w-3 -translate-x-1.5 cursor-col-resize touch-none ${
              resizing ? 'bg-sidebar/15' : 'bg-transparent hover:bg-sidebar/10'
            }`}
            title="Drag to resize chat"
          >
            <span
              className={`pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition ${
                resizing ? 'bg-sidebar/50' : 'bg-sidebar/20'
              }`}
              aria-hidden
            />
          </div>
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
