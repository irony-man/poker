import type { Metadata } from 'next';

/** Canonical public site URL for metadata, sitemap, and structured data. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pokr.site').replace(/\/$/, '');

export const SITE_NAME = 'pokr.site';

export const SITE_BRAND = 'POKR';

export const SITE_DESCRIPTION =
  "Play free No-Limit Texas Hold'em online with friends and family. Host private tables, join contests, or practice offline on pokr.site.";

export const SITE_TITLE_DEFAULT = "Play free Texas Hold'em online | pokr.site";

/** Stable sitemap lastModified (avoids a new date on every request). */
export const SITEMAP_LAST_MODIFIED = new Date('2026-03-01T00:00:00.000Z');

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

/** Absolute URL for a site path (`/` or `/host`, etc.). */
export function absoluteUrl(path: string): string {
  if (!path || path === '/') return SITE_URL;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Metadata for indexable public routes (title, canonical, OG + Twitter parity). */
export function publicPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = path.startsWith('/') ? path : `/${path}`;
  const ogTitle = `${title} | ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
    },
  };
}

/** JSON-LD graph for homepage rich-result / Knowledge eligibility signals. */
export function homeJsonLd() {
  const logoUrl = `${SITE_URL}/icon-512.png`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_BRAND,
        alternateName: SITE_NAME,
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: logoUrl,
          width: 512,
          height: 512,
        },
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

/** WebPage + BreadcrumbList JSON-LD for indexable non-home public routes. */
export function pageJsonLd({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description: string;
}) {
  const url = absoluteUrl(path);
  const pageId = `${url}#webpage`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': pageId,
        url,
        name,
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#app` },
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_BRAND,
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name,
            item: url,
          },
        ],
      },
    ],
  };
}
