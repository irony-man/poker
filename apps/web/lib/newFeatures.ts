/** "New" badges in the lobby; each clears once the player opens that feature. */

export type NewFeatureId =
  | 'profile-theme'
  | 'solo-bot-groups'
  | 'host-bot-groups'
  | 'friends-link-invite';

/** Bump to badge every feature again for a new release. */
const NEW_FEATURES_VERSION = 1;

export const NEW_FEATURES_EVENT = 'pokr-new-features';

type FeatureStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function newFeatureStorageKey(id: NewFeatureId): string {
  return `pokr-new-seen:${id}:v${NEW_FEATURES_VERSION}`;
}

function defaultStorage(): FeatureStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isFeatureNew(
  id: NewFeatureId,
  storage: FeatureStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(newFeatureStorageKey(id)) !== '1';
  } catch {
    return false;
  }
}

export function markFeatureSeen(
  id: NewFeatureId,
  storage: FeatureStorage | null = defaultStorage(),
): void {
  if (!storage || !isFeatureNew(id, storage)) return;
  try {
    storage.setItem(newFeatureStorageKey(id), '1');
  } catch {
    /* quota / private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NEW_FEATURES_EVENT, { detail: id }));
  }
}

export function subscribeNewFeatures(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith('pokr-new-seen:')) listener();
  };
  window.addEventListener(NEW_FEATURES_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(NEW_FEATURES_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}
