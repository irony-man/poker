/** App chrome look. Independent of table felt color. */
export type UiTheme = 'v1' | 'v2';

export function clampUiTheme(value: unknown): UiTheme {
  return value === 'v2' ? 'v2' : 'v1';
}
