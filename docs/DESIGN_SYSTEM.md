# Felt Design System — "Card Room"

Warm, premium, analog. No neon. The only things that glow are your turn and the pot.

There is one canonical source for every token: the `:root` block in
[apps/web/app/globals.css](../apps/web/app/globals.css). Tailwind reads those vars through
`rgb(var(--x) / <alpha-value>)` in [apps/web/tailwind.config.ts](../apps/web/tailwind.config.ts),
so the web palette cannot drift from itself. Android mirrors the same hex values in
[FeltTokens.kt](../apps/android/core/designsystem/src/main/java/com/felt/android/core/designsystem/FeltTokens.kt).
Change a value in both places or not at all.

## Color

| Token | Hex | Web (CSS var / Tailwind) | Android | Used for |
| --- | --- | --- | --- | --- |
| Ink | `#12100E` | `--ink` / `bg-ink` | `FeltColors.Ink` | App background |
| Ink panel | `#1C1916` | `--ink-panel` / `bg-ink-panel` | `FeltColors.InkPanel` | Panels, headers, drawers |
| Ink raised | `#262119` | `--ink-raised` / `bg-ink-raised` | `FeltColors.InkRaised` | Inputs, chips, raised fills |
| Ink overlay | `#0A0908` | `--ink-overlay` / `bg-ink-overlay` | `FeltColors.InkOverlay` | Modal scrims |
| Felt | `#1E5B43` | `--felt` / `bg-felt` | `FeltColors.FeltGreen` | Table surface |
| Felt deep | `#123A2B` | `--felt-deep` / `bg-felt-deep` | `FeltColors.FeltGreenDark` | Table falloff |
| Felt rim | `#3A2A1C` | `--felt-rim` / `border-felt-rim` | `FeltColors.FeltRim` | Wood rim |
| Felt rim edge | `#8A6B3A` | `--felt-rim-edge` / `border-felt-edge` | `FeltColors.FeltRimEdge` | Brass edge on the rim |
| Brass | `#C9A227` | `--brass` / `text-brass` | `FeltColors.Brass` | Primary accent |
| Brass light | `#E8CE83` | `--brass-light` / `text-brass-light` | `FeltColors.BrassLight` | Accent hover, hero text |
| Brass dim | `#7A6218` | `--brass-dim` / `text-brass-dim` | `FeltColors.BrassDim` | Accent shadow, chip base |
| Cream | `#F2EDE4` | `--cream` / `text-cream` | `FeltColors.Cream` | Primary text |
| Cream muted | `#A8A197` | `--cream-muted` / `text-cream-muted` | `FeltColors.CreamMuted` | Secondary text (7.5:1 on ink) |
| Danger | `#C0392B` | `--danger` / `text-danger` | `FeltColors.Danger` | Fold, destructive, errors |
| Positive | `#3E9E6A` | `--positive` / `text-positive` | `FeltColors.Positive` | Live, all-in, connected |
| Patina | `#6E9C86` | `--patina` / `text-patina` | `FeltColors.Patina` | Informational state |
| Patina dim | `#3F5B50` | `--patina-dim` | `FeltColors.PatinaDim` | Informational borders |
| Card face | `#FAF7F0` | `--card-face` / `bg-card-face` | `FeltColors.CardFace` | Playing card faces |
| Card red | `#C8102E` | `--card-red` / `text-card-red` | `FeltColors.CardRed` | Hearts, diamonds |
| Card ink | `#1A1A1A` | `--card-ink` / `text-card-ink` | `FeltColors.CardInk` | Spades, clubs |
| Stack red | `#8C2F27` | — | `FeltColors.StackRed` | Seat stack bar |

### Legacy aliases

The previous palette's names still resolve so components can migrate incrementally:
`gold*` maps to `brass*`, `cyan*` maps to `patina*`, and `felt-neon` maps to `positive`.
On Android, `FeltColors.Gold`, `.GoldDim`, `.Cyan`, `.Neon`, and `.YouYellow` are aliases.
Prefer the real names in new code; the aliases go away once every call site has moved.

## Type

| Role | Web | Android | Used for |
| --- | --- | --- | --- |
| Serif | Instrument Serif, `font-serif` | `FeltFonts.Serif` | Wordmark and pot only |
| Display | Inter Tight, `font-display` | `FeltFonts.Display` | Headings, buttons, labels |
| Body | Inter, `font-body` | `FeltFonts.Body` | Body copy, all numerics |

Web fonts load through `next/font` in [app/layout.tsx](../apps/web/app/layout.tsx), which
exposes them as `--font-serif`, `--font-display`, and `--font-body`.

Android currently substitutes the system serif and sans for Instrument Serif and Inter.
Bundling the real families under `res/font` and pointing `FeltFonts` at them is a one-line
change per role.

Numbers are money: anything numeric uses tabular figures. On web that is the `.tabular`
utility or `tabular-nums`.

## Radius

`--radius-xs` 4px, `--radius-sm` 6px, `--radius-md` 10px, `--radius-lg` 14px,
`--radius-xl` 20px. Tailwind's `rounded-xs`/`sm`/`md`/`lg`/`xl` are remapped to these.
Android mirrors them in `FeltRadius`.

## Elevation

| Token | Web | Used for |
| --- | --- | --- |
| Panel | `shadow-panel` | Floating panels and drawers |
| Raised | `shadow-raised` | Chips, small controls |
| Glow | `shadow-glow` | Brass focus and active turn only |
| Card | `shadow-card` | Playing cards |
| Felt | `shadow-felt` | The table itself |

## Motion

`--dur-fast` 120ms, `--dur-base` 180ms, `--dur-slow` 240ms, all on `--ease-out`
(`cubic-bezier(0.16, 1, 0.3, 1)`). UI transitions stay at or under `--dur-slow`; only card
and chip choreography runs longer. `prefers-reduced-motion: reduce` collapses every
animation and transition globally, handled once in `globals.css`.

## Rules

- One accent. Brass means "act now" or "this is the money". If everything is brass,
  nothing is.
- Color carries one meaning each: danger is folding and destruction, positive is live and
  all-in, patina is neutral information.
- Body text floors at 10px. Anything a player reads mid-hand clears WCAG AA.
- Glow belongs on live state, never on static chrome.
