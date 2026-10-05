import Link from 'next/link';
import {
  LEGAL_DOC_KEYS,
  LEGAL_DOC_PATHS,
  LEGAL_TOKENS,
  MAX_LEGAL_BODY_CHARS,
  MAX_LEGAL_TITLE_CHARS,
  type LegalDoc,
  type LegalDocKey,
  type LegalDocs,
} from '@poker/protocol';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { ADMIN_SAVE_BTN, AdminInset, SaveBar, Section, Subhead } from '../ui';

const DOC_LABELS: Record<LegalDocKey, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
};

export function LegalSection({
  docs,
  busy,
  busyKey,
  onChange,
  onResetDoc,
  onSave,
}: {
  docs: LegalDocs;
  busy: boolean;
  busyKey: string | null;
  onChange: (key: LegalDocKey, patch: Partial<LegalDoc>) => void;
  onResetDoc: (key: LegalDocKey) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <Section
      title="Legal pages"
      description="Text for /privacy and /terms. Saved changes appear on the public pages within about 5 minutes."
    >
      <AdminInset>
        <p className="text-sm text-muted">
          Formatting: <code>## Heading</code>, <code>### Subheading</code>, blank line between
          paragraphs, <code>- </code> for bullets, <code>**bold**</code>, and{' '}
          <code>[text](/path)</code> links (site paths, https, or mailto only). Tokens filled in on
          the page: {LEGAL_TOKENS.map((t) => `{{${t}}}`).join(', ')}.
        </p>
      </AdminInset>

      <form onSubmit={onSave} className="space-y-8">
        {LEGAL_DOC_KEYS.map((key) => {
          const doc = docs[key];
          return (
            <div key={key} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Subhead>{DOC_LABELS[key]}</Subhead>
                <div className="flex items-center gap-2">
                  <Link
                    href={LEGAL_DOC_PATHS[key]}
                    target="_blank"
                    className="link-sidebar text-sm"
                  >
                    View page
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onResetDoc(key)}
                  >
                    Reset to default
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                <TextField
                  label="Title"
                  value={doc.title}
                  onChange={(e) => onChange(key, { title: e.target.value })}
                  required
                  maxLength={MAX_LEGAL_TITLE_CHARS}
                />
                <TextField
                  label="Last updated"
                  type="date"
                  value={doc.lastUpdated}
                  onChange={(e) => onChange(key, { lastUpdated: e.target.value })}
                  required
                />
              </div>
              <TextAreaField
                label="Body"
                value={doc.body}
                onChange={(e) => onChange(key, { body: e.target.value })}
                rows={20}
                required
                maxLength={MAX_LEGAL_BODY_CHARS}
                className="font-mono text-xs leading-relaxed"
                help={`${doc.body.length.toLocaleString()} / ${MAX_LEGAL_BODY_CHARS.toLocaleString()} characters`}
              />
            </div>
          );
        })}

        <SaveBar>
          <Button type="submit" disabled={busy} className={ADMIN_SAVE_BTN}>
            {busyKey === 'legal' ? 'Saving…' : 'Save legal pages'}
          </Button>
        </SaveBar>
      </form>
    </Section>
  );
}
