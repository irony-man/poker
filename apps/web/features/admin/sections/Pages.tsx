import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import {
  DEFAULT_PAGES_COPY,
  PAGE_COPY_KEYS,
  PAGE_COPY_LABELS,
  type PagesCopy,
} from '@/lib/pageCopy';
import { Section } from '../ui';

export function PagesSection({
  pagesCopy,
  openPage,
  busy,
  busyKey,
  onOpenPage,
  onPagesCopy,
  onSave,
}: {
  pagesCopy: PagesCopy;
  openPage: string | null;
  busy: boolean;
  busyKey: string | null;
  onOpenPage: (key: string | null) => void;
  onPagesCopy: (key: keyof PagesCopy, patch: { title?: string; subtitle?: string }) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <Section
      title="Page text"
      description="Titles and subtitles for lobby and auth pages. Changes appear after save (clients refresh within ~30s or on next visit)."
    >
      <form onSubmit={onSave} className="space-y-3">
        {PAGE_COPY_KEYS.map((key) => {
          const open = openPage === key;
          const row = pagesCopy[key] ?? DEFAULT_PAGES_COPY[key];
          return (
            <div
              key={key}
              className="overflow-hidden rounded-xl border border-sidebar/12 bg-mushroom/[0.03]"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left sm:px-4"
                onClick={() => onOpenPage(open ? null : key)}
                aria-expanded={open}
              >
                <span>
                  <span className="font-display text-sm font-semibold uppercase tracking-wider text-ink-strong">
                    {PAGE_COPY_LABELS[key]}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-strong-muted">
                    {row.title}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-strong-muted">
                  {open ? 'Collapse' : 'Edit'}
                </span>
              </button>
              {open ? (
                <div className="space-y-3 border-t border-sidebar/8 p-3 sm:p-4">
                  <TextField
                    label={key === 'homeAuthFooter' ? 'Lead-in text' : 'Title'}
                    value={row.title}
                    onChange={(e) => onPagesCopy(key, { title: e.target.value })}
                    maxLength={200}
                    required
                  />
                  <TextAreaField
                    label={key === 'homeAuthFooter' ? 'Link labels (display only)' : 'Subtitle'}
                    value={row.subtitle}
                    onChange={(e) => onPagesCopy(key, { subtitle: e.target.value })}
                    rows={3}
                    maxLength={2000}
                    required
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        <Button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
        >
          {busyKey === 'pages' ? 'Saving…' : 'Save page text'}
        </Button>
      </form>
    </Section>
  );
}
