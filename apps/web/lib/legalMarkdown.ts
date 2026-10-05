import type { LegalToken } from '@poker/protocol';

export type LegalTokenValues = Record<LegalToken, string>;

export type LegalInline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'link'; text: string; href: string };

export type LegalBlock =
  | { type: 'h2'; text: string; id: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; inlines: LegalInline[] }
  | { type: 'ul'; items: LegalInline[][] };

const INLINE_RE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function fillLegalTokens(text: string, values: LegalTokenValues): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key as LegalToken] : match,
  );
}

/** Only same-site paths, https, and mailto links are rendered as links. */
export function safeLegalHref(href: string): string | null {
  const t = href.trim();
  if (t.startsWith('/') && !t.startsWith('//')) return t;
  if (/^https:\/\//i.test(t)) return t;
  if (/^mailto:/i.test(t)) return t;
  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseLegalInline(raw: string, values: LegalTokenValues): LegalInline[] {
  const out: LegalInline[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const filled = fillLegalTokens(text, values);
    const last = out[out.length - 1];
    if (last?.type === 'text') last.text += filled;
    else out.push({ type: 'text', text: filled });
  };

  let cursor = 0;
  for (const m of raw.matchAll(INLINE_RE)) {
    const start = m.index ?? 0;
    pushText(raw.slice(cursor, start));
    cursor = start + m[0].length;
    if (m[1] !== undefined) {
      out.push({ type: 'bold', text: fillLegalTokens(m[1], values) });
      continue;
    }
    const text = fillLegalTokens(m[2] ?? '', values);
    const href = safeLegalHref(fillLegalTokens(m[3] ?? '', values));
    if (href) out.push({ type: 'link', text, href });
    else pushText(text);
  }
  pushText(raw.slice(cursor));
  return out;
}

/** Parses the legal Markdown subset (see `LegalDoc.body`) into renderable blocks. */
export function parseLegalMarkdown(body: string, values: LegalTokenValues): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];
  let list: LegalInline[][] | null = null;
  const usedIds = new Set<string>();

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'p', inlines: parseLegalInline(paragraph.join(' '), values) });
      paragraph = [];
    }
    if (list) {
      blocks.push({ type: 'ul', items: list });
      list = null;
    }
  };

  for (const rawLine of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const text = fillLegalTokens(heading[2]!.trim(), values);
      if (heading[1]!.length === 3) {
        blocks.push({ type: 'h3', text });
      } else {
        const base = slugify(text) || 'section';
        let id = base;
        for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
        usedIds.add(id);
        blocks.push({ type: 'h2', text, id });
      }
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (paragraph.length > 0) {
        blocks.push({ type: 'p', inlines: parseLegalInline(paragraph.join(' '), values) });
        paragraph = [];
      }
      list ??= [];
      list.push(parseLegalInline(bullet[1]!, values));
      continue;
    }
    if (list) {
      blocks.push({ type: 'ul', items: list });
      list = null;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}
