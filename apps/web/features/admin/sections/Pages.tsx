import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import type { CopyTheme } from '@/lib/api';
import {
  DEFAULT_PAGES_COPY,
  PAGE_COPY_GROUPS,
  PAGE_COPY_KEYS,
  PAGE_COPY_LABELS,
  PAGE_COPY_PATHS,
  type PageCopyKey,
  type PagesCopy,
} from '@/lib/pageCopy';
import { CopyThemeSwitcher } from '../CopyThemeSwitcher';
import {
  ADMIN_SAVE_BTN,
  DetailHeader,
  SaveBar,
  Section,
  SplitGroupLabel,
  SplitItem,
  SplitPane,
} from '../ui';

export function PagesSection({
  pagesCopy,
  copyTheme,
  openPage,
  busy,
  busyKey,
  onCopyTheme,
  onCopyFromOther,
  onOpenPage,
  onPagesCopy,
  onSave,
}: {
  pagesCopy: PagesCopy;
  copyTheme: CopyTheme;
  openPage: string | null;
  busy: boolean;
  busyKey: string | null;
  onCopyTheme: (theme: CopyTheme) => void;
  onCopyFromOther: () => void;
  onOpenPage: (key: string | null) => void;
  onPagesCopy: (key: keyof PagesCopy, patch: { title?: string; subtitle?: string }) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  const selectedKey: PageCopyKey =
    openPage && (PAGE_COPY_KEYS as string[]).includes(openPage)
      ? (openPage as PageCopyKey)
      : PAGE_COPY_KEYS[0]!;
  const row = pagesCopy[selectedKey] ?? DEFAULT_PAGES_COPY[selectedKey];
  const isFooter = selectedKey === 'homeAuthFooter';
  const lookLabel = copyTheme === 'v2' ? 'Arcade' : 'Classic';

  return (
    <Section
      title="Page text"
      description="Titles and subtitles for lobby and auth pages. Classic and Arcade can differ. Copy from the other look, then save. Players see the bag that matches their selected look."
    >
      <CopyThemeSwitcher
        value={copyTheme}
        disabled={busy}
        onChange={onCopyTheme}
        onCopyFromOther={onCopyFromOther}
      />
      <form onSubmit={onSave} className="space-y-4">
        <SplitPane
          sidebarLabel="Pages"
          sidebar={PAGE_COPY_GROUPS.map((group) => (
            <div key={group.label}>
              <SplitGroupLabel>{group.label}</SplitGroupLabel>
              {group.keys.map((key) => {
                const preview = pagesCopy[key] ?? DEFAULT_PAGES_COPY[key];
                return (
                  <SplitItem
                    key={key}
                    selected={selectedKey === key}
                    title={PAGE_COPY_LABELS[key]}
                    meta={preview.title}
                    onSelect={() => onOpenPage(key)}
                  />
                );
              })}
            </div>
          ))}
        >
          <div className="space-y-5">
            <DetailHeader
              title={
                <h3 className="font-display text-lg font-bold tracking-tight text-ink-strong">
                  {PAGE_COPY_LABELS[selectedKey]}
                </h3>
              }
              meta={
                <p className="mt-1 font-mono text-xs text-ink-strong-muted">
                  {PAGE_COPY_PATHS[selectedKey]}
                </p>
              }
            />
            <TextField
              label={isFooter ? 'Lead-in text' : 'Title'}
              value={row.title}
              onChange={(e) => onPagesCopy(selectedKey, { title: e.target.value })}
              maxLength={200}
              required
            />
            <TextAreaField
              label={isFooter ? 'Link labels (display only)' : 'Subtitle'}
              value={row.subtitle}
              onChange={(e) => onPagesCopy(selectedKey, { subtitle: e.target.value })}
              rows={5}
              maxLength={2000}
              required
            />
          </div>
        </SplitPane>
        <SaveBar hint={`Players on ${lookLabel} see this copy on the matching lobby or auth screen.`}>
          <Button type="submit" disabled={busy} className={ADMIN_SAVE_BTN}>
            {busyKey === 'pages' ? 'Saving…' : `Save ${lookLabel} page text`}
          </Button>
        </SaveBar>
      </form>
    </Section>
  );
}
