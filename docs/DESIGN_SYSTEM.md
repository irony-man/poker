# Pokr Design System — POKR purple / mushroom

Warm purple brand on a mushroom page ground. Brass is a rare accent for money and
live state — not the primary CTA color.

There are two independent layers:

1. **App look** (`uiTheme`: `v1` Classic or `v2` Arcade) — lobby, profile, buttons, HUD chrome. Chosen on Profile → Theme. Default is Classic.
2. **Table felt** (`tableColorId` 0–8) — the oval only. Unchanged by app look.

Classic tokens live in the `:root` block in
[apps/web/app/globals.css](../apps/web/app/globals.css). Arcade remaps the same vars
under `html[data-ui-theme='v2']`. Tailwind reads those vars through
`rgb(var(--x) / <alpha-value>)` in [apps/web/tailwind.config.ts](../apps/web/tailwind.config.ts).
Android mirrors Classic in `PokrPalette.Classic` and Arcade in `PokrPalette.Arcade`
([PokrTokens.kt](../apps/android/core/designsystem/src/main/java/com/pokr/android/core/designsystem/PokrTokens.kt)).
Change a Classic value in both places or not at all.

## Color

| Token | Hex | Web (CSS var / Tailwind) | Android | Used for |
| --- | --- | --- | --- | --- |
| Ink | `#0E0618` | `--ink` / `bg-ink` | `PokrColors.Ink` | Deep play chrome |
| Ink panel / Sidebar | `#1D0432` | `--ink-panel` / `--sidebar` | `PokrColors.InkPanel` / `.Sidebar` | Panels, rail, primary CTA end |
| Ink raised | `#2E1048` | `--ink-raised` | `PokrColors.InkRaised` | Raised play fills |
| Ink overlay | `#08030E` | `--ink-overlay` | `PokrColors.InkOverlay` | Modal scrims |
| Ink strong | `#1D0432` | `--ink-strong` | `PokrColors.InkStrong` | Text on light pages |
| Ink strong muted | `#4A3650` | `--ink-strong-muted` | `PokrColors.InkStrongMuted` | Secondary text on light (≥7:1 on mushroom) |
| Mushroom | `#E6D9D7` | `--mushroom` | `PokrColors.Mushroom` | Page / lobby ground |
| On chrome | `#E6D9D7` | `--on-chrome` / `text-on-chrome` | `PokrColors.OnChrome` | Text/icons on purple chrome |
| Lobby panel | `#FFFCFA` | lobby `hud-panel` fill | `PokrColors.LobbyPanel` | Light cards |
| Felt / Felt deep | `#1D0432` / `#120220` | `--felt` / `--felt-deep` | `PokrColors.FeltGreen*` | Table surface |
| Felt mid / edge | `#341252` / `#0A0414` | table felt mid/edge | `PokrColors.FeltMid` / `.FeltEdge` | Table radial + primary start |
| Felt rim / rim edge | `#120220` / `#A88CA2` | `--felt-rim*` | `PokrColors.FeltRim*` | Wood/brass rim |
| Brass | `#D6BA80` | `--brass` | `PokrColors.Brass` | Money / rare accent |
| Brass light / dim | `#ECDAB0` / `#765C30` | `--brass-light` / `--brass-dim` | `PokrColors.BrassLight` / `.BrassDim` | Accent hover / shadow |
| Cream | `#F2EAE8` | `--cream` | `PokrColors.Cream` | Light text on dark chrome |
| Cream muted | `#BCAABA` | `--cream-muted` | `PokrColors.CreamMuted` | Muted text on dark (≥8:1 on sidebar) |
| Danger | `#C0392B` | `--danger` | `PokrColors.Danger` | Fold / errors |
| Positive | `#48A87A` | `--positive` | `PokrColors.Positive` | Live / win |
| Patina | `#BAA2C6` | `--patina` | `PokrColors.Patina` | Informational |
| Card face / red / ink | `#FAF7F0` / `#E53935` / `#1A1A1A` | `--card-*` | `PokrColors.Card*` | Playing cards |

### Arcade (v2) remap

Selected on Profile → Theme. Does **not** change felt presets, playing cards, brass-as-money, `--danger`, or `--positive`.

| Token | Classic | Arcade |
| --- | --- | --- |
| Mushroom (page ground) | `#E6D9D7` | `#FDE93D` (24px grid overlay) |
| Sidebar / ink panel | `#1D0432` | `#5B21B6` / `#4C1D95` |
| Ink strong (text on light) | `#1D0432` | `#1A1028` |
| Cream (text on dark) | `#F2EAE8` | `#FFFFFF` |
| Chrome | 1px muted borders, soft shadow | 3px black borders, hard `4px 4px 0 #000` shadow |
| Display font | RF Tone | Clash Display (web); system extra-bold (Android) |

Web applies `data-ui-theme="v2"` on `<html>` (localStorage `pokr-ui-theme`, hydrated from `GET /api/me`). Android provides `PokrTheme(uiTheme)` from DataStore `ui_theme`.

### Chrome contexts

- **Lobby** (`.lobby-shell` / `FeltChrome.Lobby`): mushroom ground, near-white panels, ink-strong text, purple primary buttons.
- **Play** (table / offline HUD / `FeltChrome.Play`): purple ink panels, mushroom borders/text, purple primary CTAs.

### Legacy aliases

`gold*` → `brass*`, `cyan*` → `patina*`, `felt-neon` / `Neon` → `positive`. Prefer the real names in new code.

## Type

| Role | Web | Android | Used for |
| --- | --- | --- | --- |
| Display / heading | RF Tone (`--font-display`) | `FeltFonts.Display` | Headings, buttons, labels |
| Body | Inter (`font-body`) | `FeltFonts.Body` | Body copy, numerics |
| Serif | RF Tone stand-in | `FeltFonts.Serif` | Rare marquee only |

Android currently substitutes system sans/serif until families are bundled under `res/font`.

Numbers are money: use tabular figures (web `.tabular` / `tabular-nums`).

## Radius

`--radius-xs` 4px, `--radius-sm` 6px, `--radius-md` 10px, `--radius-lg` 14px,
`--radius-xl` 20px. Android mirrors them in `FeltRadius`.

## Elevation

| Token | Web | Used for |
| --- | --- | --- |
| Panel | `shadow-panel` | Floating panels and drawers |
| Raised | `shadow-raised` | Chips, small controls |
| Glow | `shadow-glow` | Soft mushroom focus only |
| Card | `shadow-card` | Playing cards |

## Motion

`--dur-fast` 120ms, `--dur-base` 180ms, `--dur-slow` 240ms, all on `--ease-out`
(`cubic-bezier(0.16, 1, 0.3, 1)`). `prefers-reduced-motion: reduce` collapses animation globally on web.

## Rules

- One brand purple in Classic. Primary CTAs use the `#341252` → `#1D0432` gradient with mushroom label text. Arcade CTAs are solid purple, white label, thick black border.
- Brass means money or rare emphasis — not every heading. Arcade does not remap brass.
- Color carries one meaning: danger = fold/errors, positive = live/win, patina = info. These stay global across looks.
- Body and caption text floors at 11px (12px when it is body-adjacent). Glow belongs on live state, never on static chrome.
- Playing card backs use mushroom stock + sidebar hatch (not wood/brass). Cards do not follow Arcade.
