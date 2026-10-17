'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HomeFeaturesByTheme, HomeLandingFeature } from '@/lib/api';
import { fetchPublicSite } from '@/lib/api';
import { HomeFeatureRows } from '@/components/HomeFeatureRows';
import { HomeAuthFooter } from '@/components/HomeAuthFooter';
import { LegalLinks } from '@/components/LegalLinks';
import { DEFAULT_HOME_FEATURES } from '@/lib/homeFeaturesDefaults';
import { filterHomeFeaturesByLobbyNav } from '@/lib/homeFeatures';
import { pickHomeFeaturesForTheme } from '@/lib/themeCopy';
import { useLobbyNav } from '@/lib/useLobbyNav';
import { useUiTheme } from '@/lib/useUiTheme';

export { DEFAULT_HOME_FEATURES } from '@/lib/homeFeaturesDefaults';

export function HomeLanding({
  initialFeatures,
  initialHomeFeatures,
  initialHomeFeaturesByTheme,
}: {
  initialFeatures: HomeLandingFeature[];
  initialHomeFeatures?: HomeLandingFeature[];
  initialHomeFeaturesByTheme?: Partial<HomeFeaturesByTheme>;
}) {
  const uiTheme = useUiTheme();
  const lobbyNav = useLobbyNav();
  const [homeFeatures, setHomeFeatures] = useState<HomeLandingFeature[] | undefined>(
    initialHomeFeatures,
  );
  const [homeFeaturesByTheme, setHomeFeaturesByTheme] = useState<
    Partial<HomeFeaturesByTheme> | undefined
  >(initialHomeFeaturesByTheme);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicSite()
      .then((data) => {
        if (cancelled) return;
        setHomeFeatures(data.homeFeatures);
        setHomeFeaturesByTheme(data.homeFeaturesByTheme);
      })
      .catch(() => {
        /* keep server-provided or defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const features = useMemo(() => {
    const picked =
      pickHomeFeaturesForTheme(homeFeaturesByTheme, homeFeatures, uiTheme) ??
      initialFeatures ??
      DEFAULT_HOME_FEATURES;
    return filterHomeFeaturesByLobbyNav(picked, lobbyNav);
  }, [homeFeatures, homeFeaturesByTheme, uiTheme, lobbyNav, initialFeatures]);

  return (
    <div className="mx-auto w-full max-w-5xl pb-12 pt-10 sm:pb-20 sm:pt-14 lg:pt-16">
      <HomeFeatureRows features={features} />
      <HomeAuthFooter />
      <LegalLinks
        className="mt-10 text-xs text-muted"
        linkClassName="underline-offset-4 hover:text-primary hover:underline"
      />
    </div>
  );
}
