import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/TextField';
import type { SiteAnnouncement } from '@/lib/api';
import { ADMIN_SAVE_BTN, CheckboxRow, SaveBar, Section } from '../ui';

export function ContentSection({
  announcement,
  busy,
  busyKey,
  onAnnouncement,
  onSave,
}: {
  announcement: SiteAnnouncement;
  busy: boolean;
  busyKey: string | null;
  onAnnouncement: (patch: Partial<SiteAnnouncement>) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <Section
      title="Site banner"
      description="Optional notice shown at the top of lobby pages (not on live tables)."
    >
      <form onSubmit={onSave} className="space-y-4">
        <CheckboxRow
          checked={announcement.enabled}
          onChange={(enabled) => onAnnouncement({ enabled })}
          title="Show banner on lobby pages"
          hint="Disabled until checked and text is non-empty"
        />
        <TextAreaField
          label="Banner text"
          value={announcement.text}
          onChange={(e) => onAnnouncement({ text: e.target.value })}
          rows={4}
          maxLength={2000}
          placeholder="Announcement shown above lobby content…"
        />
        <SaveBar>
          <Button type="submit" disabled={busy} className={ADMIN_SAVE_BTN}>
            {busyKey === 'announce' ? 'Saving…' : 'Save banner'}
          </Button>
        </SaveBar>
      </form>
    </Section>
  );
}
