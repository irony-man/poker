/** App chrome look. Independent of table felt color. */
export type UiTheme = 'v1' | 'v2' | 'v3';

export function clampUiTheme(value: unknown): UiTheme {
  if (value === 'v2') return 'v2';
  if (value === 'v3') return 'v3';
  return 'v1';
}
