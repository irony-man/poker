import { Button } from '@/components/ui/Button';
import { FORM_LABEL_CLASS, TextAreaField, TextField } from '@/components/ui/TextField';
import type { AvatarPresetsConfig, CopyTheme } from '@/lib/api';
import { resolvePublicImage } from '@/lib/assets';
import { AVATAR_LABELS, AVATAR_PRESET_COUNT, DEFAULT_AVATAR_PRESET_URLS } from '@/lib/avatars';
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
import { AdminImageField } from '../AdminImageField';
import {
  ADMIN_SAVE_BTN,
  AdminInset,
  DetailHeader,
  DetailTitle,
  SaveBar,
  Section,
  SplitGroupLabel,
  SplitItem,
  SplitPane,
  Subhead,
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
  onUploadImage,
  imageUploadDisabled,
  uploadingImage,
  avatarPresets,
  onAvatarPresetUrl,
  onAvatarPresetUpload,
  uploadingAvatarPresetIndex,
  onSaveAvatarPresets,
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
  onPagesCopy: (
    key: keyof PagesCopy,
    patch: { title?: string; subtitle?: string; image?: string; imageAlt?: string },
  ) => void;
  onUploadImage: () => void;
  imageUploadDisabled: boolean;
  uploadingImage: boolean;
  avatarPresets: AvatarPresetsConfig;
  onAvatarPresetUrl: (index: number, value: string) => void;
  onAvatarPresetUpload: (index: number) => void;
  uploadingAvatarPresetIndex: number | null;
  onSaveAvatarPresets: () => void;
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
      description="Titles, subtitles, and lobby illustrations. Classic and Arcade can differ. Upload to S3 or paste a path/URL, then save. Players see the bag that matches their selected look."
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
              title={<DetailTitle>{PAGE_COPY_LABELS[selectedKey]}</DetailTitle>}
              meta={
                <p className="mt-1 font-mono text-xs text-muted">
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
            {!isFooter ? (
              <AdminImageField
                image={row.image ?? ''}
                imageAlt={row.imageAlt ?? ''}
                disabled={busy}
                uploading={uploadingImage}
                uploadDisabled={imageUploadDisabled}
                onImage={(value) => onPagesCopy(selectedKey, { image: value })}
                onImageAlt={(value) => onPagesCopy(selectedKey, { imageAlt: value })}
                onUpload={onUploadImage}
              />
            ) : null}
            {selectedKey === 'signUp' ? (
              <div className="space-y-3 border-t border-sidebar/10 pt-5">
                <div>
                  <Subhead>Profile picture presets</Subhead>
                  <p className="text-xs text-muted">
                    Eight choices on sign-up and profile. Site-wide by index — not Classic vs
                    Arcade.
                  </p>
                </div>
                <div className="grid gap-3">
                  {Array.from({ length: AVATAR_PRESET_COUNT }, (_, index) => {
                    const url =
                      avatarPresets.urls[index] ?? DEFAULT_AVATAR_PRESET_URLS[index] ?? '';
                    const preview = url.trim() ? resolvePublicImage(url.trim()) : '';
                    const uploading = uploadingAvatarPresetIndex === index;
                    return (
                      <AdminInset
                        key={index}
                        className="grid gap-2 sm:grid-cols-[auto_6rem_1fr_auto] sm:items-end"
                      >
                        <div
                          className="relative size-11 shrink-0 overflow-hidden rounded-full bg-raised"
                          title={AVATAR_LABELS[index]}
                        >
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={preview}
                              alt=""
                              className="h-full w-full object-cover object-center"
                            />
                          ) : null}
                        </div>
                        <div>
                          <span className={FORM_LABEL_CLASS}>{AVATAR_LABELS[index]}</span>
                          <span className="mt-1 block font-mono text-[11px] text-muted">
                            #{index}
                          </span>
                        </div>
                        <TextField
                          type="text"
                          value={url}
                          placeholder={DEFAULT_AVATAR_PRESET_URLS[index]}
                          onChange={(e) => onAvatarPresetUrl(index, e.target.value)}
                          className="font-mono text-xs"
                          maxLength={512}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy || uploading || imageUploadDisabled}
                          onClick={() => onAvatarPresetUpload(index)}
                          className="min-h-11 px-4 text-xs"
                        >
                          {uploading ? 'Uploading…' : 'Upload'}
                        </Button>
                      </AdminInset>
                    );
                  })}
                </div>
                <SaveBar hint="Upload or paste paths/URLs, then save. Players see updates after refresh or window focus.">
                  <Button
                    type="button"
                    disabled={busy}
                    className={ADMIN_SAVE_BTN}
                    onClick={onSaveAvatarPresets}
                  >
                    {busyKey === 'avatar-presets' ? 'Saving…' : 'Save profile presets'}
                  </Button>
                </SaveBar>
              </div>
            ) : null}
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
