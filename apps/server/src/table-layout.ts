/** In-game table layout. Independent of app chrome and felt color. */
export type TableLayout = 'v1' | 'v2';

/** Stacked HUD; Classic oval (`v1`) is opt-in from Profile. */
export const DEFAULT_TABLE_LAYOUT: TableLayout = 'v2';

export function clampTableLayout(value: unknown): TableLayout {
  return value === 'v1' ? 'v1' : DEFAULT_TABLE_LAYOUT;
}
