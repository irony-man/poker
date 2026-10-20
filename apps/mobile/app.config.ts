import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Install id is intentionally separate from the existing Android app
 * (`com.pokr.android`) so both can sit on one device until cutover.
 */
const BUNDLE_ID = 'com.pokr.mobile';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Pokr',
  slug: 'pokr',
  owner: 'pokr',
  scheme: 'pokr',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
  },
  android: {
    package: BUNDLE_ID,
  },
  plugins: ['expo-router', 'expo-dev-client'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '70970288-a4aa-4e78-8e7d-5a719f9b5796',
    },
  },
});
