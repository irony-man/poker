/** Viewer table SFX mute. Independent of site-wide sound config. */
export function clampSfxMuted(value: unknown): boolean {
  return value === true || value === '1' || value === 1;
}
