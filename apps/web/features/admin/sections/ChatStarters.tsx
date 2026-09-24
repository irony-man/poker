import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/TextField';
import {
  ADMIN_SAVE_BTN,
  AdminList,
  AdminListRow,
  EmptyState,
  SaveBar,
  Section,
} from '../ui';
import { MAX_BOT_CHAT_STARTER_CHARS, MAX_BOT_CHAT_STARTERS } from '@/lib/api/admin';

export function ChatStartersSection({
  starters,
  busy,
  busyKey,
  onChange,
  onAdd,
  onRemove,
  onSave,
}: {
  starters: string[];
  busy: boolean;
  busyKey: string | null;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  const atMax = starters.length >= MAX_BOT_CHAT_STARTERS;

  return (
    <Section
      title="Bot chat starters"
      description="Suggested prompts on /chat (“Try saying”). Empty lines are ignored when you save."
    >
      <form onSubmit={onSave} className="space-y-4">
        {starters.length === 0 ? (
          <EmptyState>Add at least one starter prompt.</EmptyState>
        ) : (
          <AdminList>
            {starters.map((text, index) => (
              <AdminListRow key={`starter-${index}`} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <TextAreaField
                    label={`Starter ${index + 1}`}
                    value={text}
                    onChange={(e) => onChange(index, e.target.value)}
                    rows={2}
                    maxLength={MAX_BOT_CHAT_STARTER_CHARS}
                    placeholder="e.g. I slow-played pocket aces and still lost."
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || starters.length <= 1}
                  className="shrink-0 self-end sm:mt-7"
                  onClick={() => onRemove(index)}
                >
                  Delete
                </Button>
              </AdminListRow>
            ))}
          </AdminList>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="soft" disabled={busy || atMax} onClick={onAdd}>
            Add starter
          </Button>
          <span className="self-center text-xs text-muted">
            {starters.length}/{MAX_BOT_CHAT_STARTERS}
          </span>
        </div>

        <SaveBar>
          <Button type="submit" disabled={busy || starters.length === 0} className={ADMIN_SAVE_BTN}>
            {busyKey === 'chat-starters' ? 'Saving…' : 'Save starters'}
          </Button>
        </SaveBar>
      </form>
    </Section>
  );
}
