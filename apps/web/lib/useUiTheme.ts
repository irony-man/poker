'use client';

import { useEffect, useState } from 'react';
import { readActiveUiTheme, subscribeUiTheme, type UiTheme } from '@/lib/uiTheme';

/** Live Classic / Arcade look. Updates when Profile saves or another tab changes storage. */
export function useUiTheme(): UiTheme {
  const [theme, setTheme] = useState<UiTheme>(readActiveUiTheme);
  useEffect(() => {
    setTheme(readActiveUiTheme());
    return subscribeUiTheme(setTheme);
  }, []);
  return theme;
}
