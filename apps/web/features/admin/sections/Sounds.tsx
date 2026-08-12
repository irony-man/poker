import type { RefObject } from 'react';
import { Button } from '@/components/ui/Button';
import { FORM_LABEL_CLASS, TextField } from '@/components/ui/TextField';
import {
  DEFAULT_TABLE_SOUND_URLS,
  TABLE_SOUND_KINDS,
  TABLE_SOUND_LABELS,
  type TableSoundKind,
  type TableSoundsConfig,
} from '@/lib/api';
import { Section } from '../ui';

export function SoundsSection({
  sounds,
  soundFileInputRef,
  soundUploadDisabled,
  uploadingSound,
  busy,
  busyKey,
  onSounds,
  onUrl,
  onSave,
  onResetDefaults,
  onUpload,
  onFileSelected,
  onPreview,
}: {
  sounds: TableSoundsConfig;
  soundFileInputRef: RefObject<HTMLInputElement | null>;
  soundUploadDisabled: boolean;
  uploadingSound: TableSoundKind | null;
  busy: boolean;
  busyKey: string | null;
  onSounds: (patch: Partial<TableSoundsConfig>) => void;
  onUrl: (kind: TableSoundKind, value: string) => void;
  onSave: (e: React.FormEvent) => void;
  onResetDefaults: () => void;
  onUpload: (kind: TableSoundKind) => void;
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPreview: (kind: TableSoundKind) => void;
}) {
  return (
    <Section
      title="Table sounds"
      description="Upload MP3 files or paste URLs for fold, check, streets, and win. Uploads save immediately to S3. Leave a field blank to disable that event."
    >
      <form onSubmit={onSave} className="space-y-4">
        <input
          ref={soundFileInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,.mp3"
          className="sr-only"
          onChange={onFileSelected}
        />
        {soundUploadDisabled ? (
          <p className="text-xs text-ink-strong-muted">
            File uploads require AWS env vars on the server (S3_BUCKET, AWS_ACCESS_KEY_ID, etc.).
          </p>
        ) : null}
        <label className="flex items-center gap-3 rounded-xl border border-sidebar/10 bg-cream px-4 py-3">
          <input
            type="checkbox"
            checked={sounds.enabled}
            onChange={(e) => onSounds({ enabled: e.target.checked })}
            className="size-4 rounded border-sidebar/30 text-sidebar focus:ring-sidebar/30"
          />
          <span className="text-sm font-medium text-ink-strong">Enable table sounds site-wide</span>
        </label>
        <div className="grid gap-3">
          {TABLE_SOUND_KINDS.map((kind) => (
            <div
              key={kind}
              className="grid gap-2 rounded-xl border border-sidebar/8 bg-cream/60 p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
            >
              <div>
                <span className={FORM_LABEL_CLASS}>{TABLE_SOUND_LABELS[kind]}</span>
                <span className="mt-1 block font-mono text-[11px] text-ink-strong-muted">{kind}</span>
              </div>
              <TextField
                type="text"
                value={sounds.urls[kind] ?? ''}
                placeholder={DEFAULT_TABLE_SOUND_URLS[kind]}
                onChange={(e) => onUrl(kind, e.target.value)}
                className="font-mono text-xs"
                aria-label={`URL for ${TABLE_SOUND_LABELS[kind]}`}
              />
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  variant="ghost"
                  disabled={busy || soundUploadDisabled || uploadingSound !== null}
                  onClick={() => onUpload(kind)}
                  className="min-h-10 px-4 text-xs"
                >
                  {uploadingSound === kind ? 'Uploading…' : 'Upload'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onPreview(kind)}
                  className="min-h-10 px-4 text-xs"
                >
                  Preview
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
          >
            {busyKey === 'sounds' ? 'Saving…' : 'Save sounds'}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={onResetDefaults}
            className="min-h-11 px-4 text-xs"
          >
            Reset to defaults
          </Button>
        </div>
      </form>
    </Section>
  );
}
