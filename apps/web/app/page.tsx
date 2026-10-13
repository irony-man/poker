import type { Metadata } from 'next';
import { HomeHero } from '@/components/HomeHero';
import { HomeLanding } from '@/components/HomeLanding';
import { HomeFaq } from '@/components/HomeFaq';
import { resolveHomeFeaturesForSeo } from '@/lib/homeFeatures';
import { fetchLobbyNav } from '@/lib/lobbyNavServer';
import { fetchPublicSiteServer, SITE_REVALIDATE_SECONDS } from '@/lib/siteServer';
import { homeFaqJsonLd, homeJsonLd } from '@/lib/site';

/** Next requires a literal here; keep in sync with `SITE_REVALIDATE_SECONDS`. */
export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [site, lobbyNav] = await Promise.all([
    fetchPublicSiteServer(SITE_REVALIDATE_SECONDS),
    fetchLobbyNav(SITE_REVALIDATE_SECONDS),
  ]);
  const initialFeatures = resolveHomeFeaturesForSeo(site, lobbyNav, 'v1');

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd()) }}
      />
      <HomeHero />
      <HomeLanding
        initialFeatures={initialFeatures}
        initialHomeFeatures={site.homeFeatures}
        initialHomeFeaturesByTheme={site.homeFeaturesByTheme}
      />
      <HomeFaq />
    </>
  );
}
