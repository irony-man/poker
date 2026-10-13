import type { HomeLandingFeature, HomeFeaturesByTheme } from '@/lib/api';
import { isHrefHiddenByLobbyNav, type LobbyNavConfig } from '@poker/protocol';
import { DEFAULT_HOME_FEATURES } from '@/lib/homeFeaturesDefaults';
import { pickHomeFeaturesForTheme } from '@/lib/themeCopy';
import type { UiTheme } from '@/lib/uiTheme';

export function filterHomeFeaturesByLobbyNav(
  features: HomeLandingFeature[],
  lobbyNav: LobbyNavConfig,
): HomeLandingFeature[] {
  return features.filter((f) => !isHrefHiddenByLobbyNav(lobbyNav, f.href));
}

/** Default-theme home blocks for SSR and crawlers. */
export function resolveHomeFeaturesForSeo(
  site: {
    homeFeatures?: HomeLandingFeature[];
    homeFeaturesByTheme?: Partial<HomeFeaturesByTheme>;
  },
  lobbyNav: LobbyNavConfig,
  theme: UiTheme = 'v1',
): HomeLandingFeature[] {
  const picked =
    pickHomeFeaturesForTheme(
      site.homeFeaturesByTheme,
      site.homeFeatures,
      theme,
    ) ?? DEFAULT_HOME_FEATURES;
  return filterHomeFeaturesByLobbyNav(picked, lobbyNav);
}
