import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/TextField';
import type { SiteAnnouncement } from '@/lib/api';
import { Section } from '../ui';

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
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-sidebar/10 bg-mushroom/[0.04] px-3 py-3 text-sm text-ink-strong">
          <input
            type="checkbox"
            className="h-4 w-4 accent-sidebar"
            checked={announcement.enabled}
            onChange={(e) => onAnnouncement({ enabled: e.target.checked })}
          />
          <span>
            <span className="font-medium">Show banner on lobby pages</span>
            <span className="mt-0.5 block text-xs text-ink-strong-muted">
              Disabled until checked and text is non-empty
            </span>
          </span>
        </label>
        <TextAreaField
          label="Banner text"
          value={announcement.text}
          onChange={(e) => onAnnouncement({ text: e.target.value })}
          rows={4}
          maxLength={2000}
          placeholder="Announcement shown above lobby content…"
        />
        <Button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
        >
          {busyKey === 'announce' ? 'Saving…' : 'Save banner'}
        </Button>
      </form>
    </Section>
  );
}
