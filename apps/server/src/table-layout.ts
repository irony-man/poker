/** In-game table layout. Independent of app chrome and felt color. */
export type TableLayout = 'v1' | 'v2';

export function clampTableLayout(value: unknown): TableLayout {
  return value === 'v2' ? 'v2' : 'v1';
}
