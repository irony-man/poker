import { describe, expect, it } from 'vitest';
import { DEFAULT_LEGAL_DOCS } from '@poker/protocol';
import {
  fillLegalTokens,
  parseLegalInline,
  parseLegalMarkdown,
  safeLegalHref,
  type LegalTokenValues,
} from './legalMarkdown';

const values: LegalTokenValues = {
  siteName: 'pokr.site',
  operatorName: 'Pokr Ltd',
  contactEmail: 'help@pokr.site',
  jurisdiction: 'India',
  minAge: '18',
};

describe('fillLegalTokens', () => {
  it('replaces known tokens and leaves unknown ones', () => {
    expect(fillLegalTokens('{{siteName}} by {{operatorName}} {{nope}}', values)).toBe(
      'pokr.site by Pokr Ltd {{nope}}',
    );
  });
});

describe('safeLegalHref', () => {
  it('allows site paths, https and mailto only', () => {
    expect(safeLegalHref('/terms')).toBe('/terms');
    expect(safeLegalHref('https://example.com')).toBe('https://example.com');
    expect(safeLegalHref('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeLegalHref('javascript:alert(1)')).toBeNull();
    expect(safeLegalHref('//evil.com')).toBeNull();
    expect(safeLegalHref('http://example.com')).toBeNull();
  });
});

describe('parseLegalInline', () => {
  it('parses bold and links, filling tokens in hrefs', () => {
    expect(
      parseLegalInline('Hi **there**, email [{{contactEmail}}](mailto:{{contactEmail}}).', values),
    ).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'bold', text: 'there' },
      { type: 'text', text: ', email ' },
      { type: 'link', text: 'help@pokr.site', href: 'mailto:help@pokr.site' },
      { type: 'text', text: '.' },
    ]);
  });

  it('renders unsafe links as plain text', () => {
    expect(parseLegalInline('a [x](javascript:alert(1)) b', values)).toEqual([
      { type: 'text', text: 'a x) b' },
    ]);
  });

  it('keeps token values with brackets intact', () => {
    const bracketed = { ...values, contactEmail: '[CONTACT EMAIL]' };
    expect(parseLegalInline('[{{contactEmail}}](mailto:{{contactEmail}})', bracketed)).toEqual([
      { type: 'link', text: '[CONTACT EMAIL]', href: 'mailto:[CONTACT EMAIL]' },
    ]);
  });
});

describe('parseLegalMarkdown', () => {
  it('builds headings, paragraphs and lists', () => {
    const blocks = parseLegalMarkdown(
      [
        'Intro line one',
        'line two.',
        '',
        '## About {{siteName}}',
        '### Details',
        '- first',
        '- **second**',
        'After list.',
        '## About pokr.site',
      ].join('\n'),
      values,
    );
    expect(blocks).toEqual([
      { type: 'p', inlines: [{ type: 'text', text: 'Intro line one line two.' }] },
      { type: 'h2', text: 'About pokr.site', id: 'about-pokr-site' },
      { type: 'h3', text: 'Details' },
      {
        type: 'ul',
        items: [[{ type: 'text', text: 'first' }], [{ type: 'bold', text: 'second' }]],
      },
      { type: 'p', inlines: [{ type: 'text', text: 'After list.' }] },
      { type: 'h2', text: 'About pokr.site', id: 'about-pokr-site-2' },
    ]);
  });

  it('parses the default documents without leftover tokens', () => {
    for (const doc of Object.values(DEFAULT_LEGAL_DOCS)) {
      const blocks = parseLegalMarkdown(doc.body, values);
      expect(blocks.length).toBeGreaterThan(10);
      expect(JSON.stringify(blocks)).not.toContain('{{');
    }
  });
});
