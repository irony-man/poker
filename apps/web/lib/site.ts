/** Canonical public site URL for metadata, sitemap, and structured data. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pokr.site').replace(/\/$/, '');

export const SITE_NAME = 'pokr.site';

export const SITE_BRAND = 'POKR';

export const SITE_DESCRIPTION =
  "Play free No-Limit Texas Hold'em online with friends and family. Host private tables, join contests, or practice offline on pokr.site.";

export const SITE_TITLE_DEFAULT = "Play free Texas Hold'em online | pokr.site";

/** Apex hostname (no protocol), e.g. pokr.site */
export const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return 'pokr.site';
  }
})();

export function siteVerification(): {
  google?: string | string[];
  other?: Record<string, string | string[]>;
} | undefined {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();
  const yandex = process.env.NEXT_PUBLIC_YANDEX_VERIFICATION?.trim();

  if (!google && !bing && !yandex) return undefined;

  const other: Record<string, string> = {};
  if (bing) other['msvalidate.01'] = bing;
  if (yandex) other['yandex-verification'] = yandex;

  return {
    ...(google ? { google } : {}),
    ...(Object.keys(other).length ? { other } : {}),
  };
}

/** JSON-LD graph for homepage rich-result / Knowledge eligibility signals. */
export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_BRAND,
        alternateName: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icon-512.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_BRAND,
        alternateName: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en',
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_BRAND,
        alternateName: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requires JavaScript',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        isPartOf: { '@id': `${SITE_URL}/#website` },
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
}
