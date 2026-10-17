import { afterEach, describe, expect, it } from 'vitest';
import { gaMeasurementId, HOME_FAQ_ITEMS, homeFaqJsonLd } from '@/lib/site';

describe('home SEO helpers', () => {
  it('exports FAQ items with question and answer', () => {
    expect(HOME_FAQ_ITEMS.length).toBeGreaterThanOrEqual(4);
    for (const item of HOME_FAQ_ITEMS) {
      expect(item.question.length).toBeGreaterThan(5);
      expect(item.answer.length).toBeGreaterThan(10);
    }
  });

  it('builds valid FAQPage JSON-LD', () => {
    const json = homeFaqJsonLd() as {
      '@type': string;
      mainEntity: { '@type': string; name: string }[];
    };
    expect(json['@type']).toBe('FAQPage');
    expect(json.mainEntity.length).toBe(HOME_FAQ_ITEMS.length);
    expect(json.mainEntity[0]?.['@type']).toBe('Question');
  });
});

describe('gaMeasurementId', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('returns undefined when id is missing', () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    expect(gaMeasurementId()).toBeUndefined();
  });

  it('returns undefined for invalid id format', () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'UA-12345-1';
    expect(gaMeasurementId()).toBeUndefined();
  });

  it('returns id in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-ABC123XYZ';
    expect(gaMeasurementId()).toBe('G-ABC123XYZ');
  });

  it('returns undefined in development unless explicitly enabled', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-ABC123XYZ';
    delete process.env.NEXT_PUBLIC_GA_ENABLE_IN_DEV;
    expect(gaMeasurementId()).toBeUndefined();
    process.env.NEXT_PUBLIC_GA_ENABLE_IN_DEV = '1';
    expect(gaMeasurementId()).toBe('G-ABC123XYZ');
  });
});
