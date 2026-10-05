import Link from 'next/link';
import type { LobbyNavConfig, LobbyNavId } from '@poker/protocol';
import { Button } from '@/components/ui/Button';
import { LOBBY_NAV_ITEMS } from '@/lib/lobbyNav';
import { ADMIN_SAVE_BTN, AdminList, AdminListRow, SaveBar, Section } from '../ui';

const ROW_HINTS: Partial<Record<LobbyNavId, string>> = {
  host: '/play',
  join: '/play?mode=join',
  chat: '/chat — also the floating chat button and the bot chat API',
  solo: '/solo and /offline',
};

export function SidebarSection({
  items,
  busy,
  busyKey,
  onMove,
  onToggle,
  onReset,
  onSave,
}: {
  items: LobbyNavConfig;
  busy: boolean;
  busyKey: string | null;
  onMove: (index: number, delta: -1 | 1) => void;
  onToggle: (id: LobbyNavId, visible: boolean) => void;
  onReset: () => void;
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <Section
      title="Sidebar"
      description="Order and visibility of lobby links in the sidebar and mobile tab bar. Hidden sections return a 404 page, and changes reach the site within about a minute."
    >
      <form onSubmit={onSave} className="space-y-4">
        <AdminList>
          {items.map((item, index) => {
            const entry = LOBBY_NAV_ITEMS[item.id];
            const hint = ROW_HINTS[item.id] ?? entry.href;
            return (
              <AdminListRow key={item.id} className="flex-wrap gap-3 py-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm text-primary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sidebar"
                    checked={item.visible}
                    onChange={(e) => onToggle(item.id, e.target.checked)}
                    aria-label={`Show ${entry.label}`}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{entry.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                  </span>
                </label>
                <span
                  className={`text-xs font-medium ${item.visible ? 'text-positive' : 'text-muted'}`}
                >
                  {item.visible ? 'Visible' : 'Hidden (404)'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy || index === 0}
                    onClick={() => onMove(index, -1)}
                    aria-label={`Move ${entry.label} up`}
                    title="Move up"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy || index === items.length - 1}
                    onClick={() => onMove(index, 1)}
                    aria-label={`Move ${entry.label} down`}
                    title="Move down"
                  >
                    ↓
                  </Button>
                </div>
              </AdminListRow>
            );
          })}
        </AdminList>

        <SaveBar
          hint={
            <>
              Preview at{' '}
              <Link href="/" target="_blank" className="link-sidebar">
                the lobby
              </Link>{' '}
              after saving.
            </>
          }
        >
          <Button type="button" variant="ghost" disabled={busy} onClick={onReset}>
            Reset to default
          </Button>
          <Button type="submit" disabled={busy} className={ADMIN_SAVE_BTN}>
            {busyKey === 'lobby-nav' ? 'Saving…' : 'Save sidebar'}
          </Button>
        </SaveBar>
      </form>
    </Section>
  );
}
