import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_LEGAL_DOCS, MAX_LEGAL_BODY_CHARS } from '@poker/protocol';
import { SiteConfigStore } from './site-config.store.js';
import { normalizeLegalDocs, normalizeSiteConfig } from './site-config.types.js';

describe('normalizeLegalDocs', () => {
  it('falls back to defaults for missing or invalid input', () => {
    expect(normalizeLegalDocs(undefined)).toEqual(DEFAULT_LEGAL_DOCS);
    expect(
      normalizeLegalDocs({ privacy: { title: '  ', lastUpdated: 'yesterday', body: 7 } }),
    ).toEqual(DEFAULT_LEGAL_DOCS);
  });

  it('trims, normalises line endings, and caps the body', () => {
    const docs = normalizeLegalDocs({
      terms: {
        title: '  Rules  ',
        lastUpdated: '2026-01-02',
        body: `  a\r\nb${'x'.repeat(MAX_LEGAL_BODY_CHARS)}`,
      },
    });
    expect(docs.terms.title).toBe('Rules');
    expect(docs.terms.lastUpdated).toBe('2026-01-02');
    expect(docs.terms.body.startsWith('a\nb')).toBe(true);
    expect(docs.terms.body).toHaveLength(MAX_LEGAL_BODY_CHARS);
    expect(docs.privacy).toEqual(DEFAULT_LEGAL_DOCS.privacy);
  });

  it('seeds legal docs for snapshots saved before the field existed', () => {
    expect(normalizeSiteConfig({ announcement: { enabled: false, text: '' } }).legal).toEqual(
      DEFAULT_LEGAL_DOCS,
    );
  });
});

describe('SiteConfigStore legal', () => {
  let dir: string | null = null;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it('persists edits and reloads them', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'site-legal-'));
    const store = new SiteConfigStore(dir);
    await store.init();
    const saved = await store.setLegal({
      ...DEFAULT_LEGAL_DOCS,
      privacy: { title: 'Privacy', lastUpdated: '2026-11-01', body: '## Hi\n\nBody' },
    });
    expect(saved.privacy.title).toBe('Privacy');

    const raw = JSON.parse(await readFile(path.join(dir, 'site-config.json'), 'utf8'));
    expect(raw.legal.privacy.lastUpdated).toBe('2026-11-01');

    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.getLegal().privacy.body).toBe('## Hi\n\nBody');
    expect(reloaded.getSnapshot().legal.terms).toEqual(DEFAULT_LEGAL_DOCS.terms);
  });
});
