'use client';

import { useEffect, useState } from 'react';
import { isFeatureNew, subscribeNewFeatures, type NewFeatureId } from '@/lib/newFeatures';

/** False on the server and first paint so badges never cause a hydration mismatch. */
export function useNewFeature(id: NewFeatureId): boolean {
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    setIsNew(isFeatureNew(id));
    return subscribeNewFeatures(() => setIsNew(isFeatureNew(id)));
  }, [id]);
  return isNew;
}
