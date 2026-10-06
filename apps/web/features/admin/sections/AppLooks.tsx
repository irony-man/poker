import { UI_LOOK_IDS, UI_LOOK_LABELS, type UiLooksConfig, type UiTheme } from '@poker/protocol';
import { Button } from '@/components/ui/Button';
import { ADMIN_SAVE_BTN, AdminList, AdminListRow, SaveBar, Section } from '../ui';

export function AppLooksSection({
  config,
  busy,
  busyKey,
  onToggle,
  onDefault,
  onSave,
}: {
  config: UiLooksConfig;
  busy: boolean;
  busyKey: string | null;
  onToggle: (id: UiTheme, visible: boolean) => void;
  onDefault: (id: UiTheme) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <Section
      title="App looks"
      description="Which looks players can pick under Profile → Theme. New players and anyone on a hidden look get the default. The Profile picker is hidden when only one look is on."
    >
      <form onSubmit={onSave} className="space-y-4">
        <AdminList>
          {UI_LOOK_IDS.map((id) => {
            const visible = config.visible.includes(id);
            const isDefault = config.defaultLook === id;
            const label = UI_LOOK_LABELS[id];
            return (
              <AdminListRow key={id} className="flex-wrap gap-3 py-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm text-primary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sidebar"
                    checked={visible}
                    disabled={busy || (visible && config.visible.length === 1)}
                    onChange={(e) => onToggle(id, e.target.checked)}
                    aria-label={`Offer ${label}`}
                  />
                  <span className="font-medium">{label}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                  <input
                    type="radio"
                    name="ui-look-default"
                    className="h-4 w-4 accent-sidebar"
                    checked={isDefault}
                    disabled={busy || !visible}
                    onChange={() => onDefault(id)}
                  />
                  Default
                </label>
              </AdminListRow>
            );
          })}
        </AdminList>

        <SaveBar hint="At least one look must stay on, and the default must be one of them.">
          <Button type="submit" disabled={busy} className={ADMIN_SAVE_BTN}>
            {busyKey === 'ui-looks' ? 'Saving…' : 'Save looks'}
          </Button>
        </SaveBar>
      </form>
    </Section>
  );
}
