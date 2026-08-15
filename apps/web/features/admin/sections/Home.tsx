import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import type { CopyTheme, HomeLandingFeature } from '@/lib/api';
import { CopyThemeSwitcher } from '../CopyThemeSwitcher';
import { MAX_HOME_BLOCKS } from '../tabs';
import { ADMIN_SAVE_BTN, SaveBar, Section } from '../ui';

export const BLANK_HOME_BLOCK: HomeLandingFeature = {
  title: 'New feature',
  body: 'Describe this feature for players landing on the home page.',
  cta: 'Learn more',
  href: '/',
  image: '/home-host.png',
  imageAlt: 'POKR feature illustration',
  imageFirst: true,
};

export function HomeSection({
  homeFeatures,
  copyTheme,
  openBlocks,
  busy,
  busyKey,
  onCopyTheme,
  onCopyFromOther,
  onToggleBlock,
  onUpdate,
  onMove,
  onRemove,
  onAdd,
  onSave,
}: {
  homeFeatures: HomeLandingFeature[];
  copyTheme: CopyTheme;
  openBlocks: Record<number, boolean>;
  busy: boolean;
  busyKey: string | null;
  onCopyTheme: (theme: CopyTheme) => void;
  onCopyFromOther: () => void;
  onToggleBlock: (index: number) => void;
  onUpdate: (index: number, patch: Partial<HomeLandingFeature>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onSave: (e: React.FormEvent) => void;
}) {
  const lookLabel = copyTheme === 'v2' ? 'Arcade' : 'Classic';
  return (
    <Section
      title="Home landing"
      description="Feature blocks on the home page — title, body, CTA, link, and image. Classic and Arcade can differ. Copy from the other look, then save."
      action={
        <Button
          variant="ghost"
          disabled={busy || homeFeatures.length >= MAX_HOME_BLOCKS}
          onClick={onAdd}
          className="min-h-9 px-4 text-xs"
        >
          Add block
        </Button>
      }
    >
      <CopyThemeSwitcher
        value={copyTheme}
        disabled={busy}
        onChange={onCopyTheme}
        onCopyFromOther={onCopyFromOther}
      />
      <form onSubmit={onSave} className="space-y-3">
        {homeFeatures.map((feature, index) => {
          const open = openBlocks[index] ?? false;
          return (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-sidebar/12 bg-mushroom/[0.03]"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-sidebar/8 px-3 py-2.5 sm:px-4">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onToggleBlock(index)}
                  aria-expanded={open}
                >
                  <span className="font-display text-sm font-semibold uppercase tracking-wider text-ink-strong">
                    Block {index + 1}
                  </span>
                  <span className="ml-2 truncate text-sm text-ink-strong-muted">
                    {feature.title || 'Untitled'}
                  </span>
                </button>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    disabled={index === 0 || busy}
                    onClick={() => onMove(index, -1)}
                    className="rounded-md px-2.5 py-1 text-xs"
                  >
                    Up
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={index === homeFeatures.length - 1 || busy}
                    onClick={() => onMove(index, 1)}
                    className="rounded-md px-2.5 py-1 text-xs"
                  >
                    Down
                  </Button>
                  <Button
                    variant="dangerQuiet"
                    disabled={homeFeatures.length <= 1 || busy}
                    onClick={() => onRemove(index)}
                    className="px-2.5 py-1 text-xs"
                  >
                    Remove
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => onToggleBlock(index)}
                    className="rounded-md px-2.5 py-1 text-xs"
                  >
                    {open ? 'Collapse' : 'Edit'}
                  </Button>
                </div>
              </div>
              {open ? (
                <div className="space-y-3 p-3 sm:p-4">
                  <TextField
                    label="Title"
                    value={feature.title}
                    onChange={(e) => onUpdate(index, { title: e.target.value })}
                    maxLength={120}
                    required
                  />
                  <TextAreaField
                    label="Body"
                    value={feature.body}
                    onChange={(e) => onUpdate(index, { body: e.target.value })}
                    rows={3}
                    maxLength={2000}
                    required
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="CTA label"
                      value={feature.cta}
                      onChange={(e) => onUpdate(index, { cta: e.target.value })}
                      maxLength={80}
                      required
                    />
                    <TextField
                      label="Link (href)"
                      value={feature.href}
                      onChange={(e) => onUpdate(index, { href: e.target.value })}
                      placeholder="/contests"
                      maxLength={500}
                      required
                    />
                    <TextField
                      label="Image path"
                      value={feature.image}
                      onChange={(e) => onUpdate(index, { image: e.target.value })}
                      placeholder="/home-knockout.png"
                      maxLength={500}
                      required
                    />
                    <TextField
                      label="Image alt"
                      value={feature.imageAlt}
                      onChange={(e) => onUpdate(index, { imageAlt: e.target.value })}
                      maxLength={200}
                      required
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-strong">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sidebar"
                      checked={feature.imageFirst}
                      onChange={(e) => onUpdate(index, { imageFirst: e.target.checked })}
                    />
                    Image on the left (desktop)
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
        <SaveBar hint={`${homeFeatures.length}/${MAX_HOME_BLOCKS} blocks · ${lookLabel}`}>
          <Button
            variant="ghost"
            disabled={busy || homeFeatures.length >= MAX_HOME_BLOCKS}
            onClick={onAdd}
            className="min-h-11 px-5"
          >
            Add block
          </Button>
          <Button type="submit" disabled={busy} className={ADMIN_SAVE_BTN}>
            {busyKey === 'home' ? 'Saving…' : `Save ${lookLabel} landing`}
          </Button>
        </SaveBar>
      </form>
    </Section>
  );
}
