/** Server mirror of apps/web/lib/cardFaceSvg.ts */

export const MAX_CARD_FACE_SVG_CHARS = 12_000;

export const DEFAULT_LAYER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>`;

const BLOCKED =
  /<\s*(script|foreignObject|iframe|object|embed|link|meta|style)[\s>]/gi;
const EVENT_HANDLER = /\s(on\w+|formaction|xlink:href\s*=\s*['"]?\s*javascript:)/gi;
const JS_URL = /(?:href|xlink:href)\s*=\s*['"]?\s*javascript:/gi;

export function sanitizeCardFaceSvg(raw: string): string {
  let t = raw.trim().slice(0, MAX_CARD_FACE_SVG_CHARS);
  if (!t) return '';
  if (!/<svg[\s>]/i.test(t)) return '';
  t = t.replace(EVENT_HANDLER, ' data-blocked="');
  t = t.replace(JS_URL, 'href="#"');
  if (BLOCKED.test(t)) return '';
  BLOCKED.lastIndex = 0;
  return t;
}
