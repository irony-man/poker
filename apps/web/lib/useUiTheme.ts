'use client';

import { useEffect, useState } from 'react';
import type { UiLooksConfig } from '@poker/protocol';
import {
  getUiLooks,
  readActiveUiTheme,
  subscribeUiLooks,
  subscribeUiTheme,
  type UiTheme,
} from '@/lib/uiTheme';

/** Admin look visibility + default; updates when /api/site loads. */
export function useUiLooks(): UiLooksConfig {
  const [config, setConfig] = useState<UiLooksConfig>(getUiLooks);
  useEffect(() => {
    setConfig(getUiLooks());
    return subscribeUiLooks(setConfig);
  }, []);
  return config;
}

/** Live Classic / Arcade look. Updates when Profile saves or another tab changes storage. */
export function useUiTheme(): UiTheme {
  const [theme, setTheme] = useState<UiTheme>(readActiveUiTheme);
  useEffect(() => {
    setTheme(readActiveUiTheme());
    return subscribeUiTheme(setTheme);
  }, []);
  return theme;
}
