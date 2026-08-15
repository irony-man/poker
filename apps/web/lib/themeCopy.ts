import type { HomeFeaturesByTheme, HomeLandingFeature, PagesByTheme, PagesCopy } from '@/lib/api';
import type { UiTheme } from '@/lib/uiTheme';

export function pickPagesForTheme(
  pagesByTheme: Partial<PagesByTheme> | undefined,
  pages: PagesCopy | undefined,
  theme: UiTheme,
): PagesCopy | undefined {
  if (theme === 'v2' && pagesByTheme?.v2) return pagesByTheme.v2;
  return pagesByTheme?.v1 ?? pages;
}

export function pickHomeFeaturesForTheme(
  homeFeaturesByTheme: Partial<HomeFeaturesByTheme> | undefined,
  homeFeatures: HomeLandingFeature[] | undefined,
  theme: UiTheme,
): HomeLandingFeature[] | undefined {
  if (theme === 'v2' && homeFeaturesByTheme?.v2 && homeFeaturesByTheme.v2.length > 0) {
    return homeFeaturesByTheme.v2;
  }
  if (homeFeaturesByTheme?.v1 && homeFeaturesByTheme.v1.length > 0) {
    return homeFeaturesByTheme.v1;
  }
  if (homeFeatures && homeFeatures.length > 0) return homeFeatures;
  return undefined;
}
