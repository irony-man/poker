/** Matches web table color presets (0–8). */
export const TABLE_COLOR_PRESET_COUNT = 9;

export function clampTableColorId(id: number | undefined | null, fallback = 0): number {
  if (id == null || !Number.isInteger(id)) {
    return ((fallback % TABLE_COLOR_PRESET_COUNT) + TABLE_COLOR_PRESET_COUNT) % TABLE_COLOR_PRESET_COUNT;
  }
  return ((id % TABLE_COLOR_PRESET_COUNT) + TABLE_COLOR_PRESET_COUNT) % TABLE_COLOR_PRESET_COUNT;
}
