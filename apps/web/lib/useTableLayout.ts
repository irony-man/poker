'use client';

import { useEffect, useState } from 'react';
import {
  readActiveTableLayout,
  subscribeTableLayout,
  type TableLayout,
} from '@/lib/tableLayoutPref';

/** Live Classic oval / Table v2 stacked layout. Updates when Profile saves. */
export function useTableLayout(): TableLayout {
  const [layout, setLayout] = useState<TableLayout>(readActiveTableLayout);
  useEffect(() => {
    setLayout(readActiveTableLayout());
    return subscribeTableLayout(setLayout);
  }, []);
  return layout;
}
