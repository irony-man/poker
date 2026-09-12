# Pokr Design System — POKR purple / mushroom

Warm purple brand on a mushroom page ground. Brass is a rare accent for money and
live state — not the primary CTA color.

There are two independent layers:

1. **App look** (`uiTheme`: `v1` Classic, `v2` Arcade, `v3` Glass) — lobby, profile, buttons, HUD chrome. Chosen on Profile → Theme. Default is Classic.
2. **Table felt** (`tableColorId` 0–8) — the oval only. Unchanged by app look.

## Semantic roles (prefer these)

Use the same Tailwind classes across Classic / Arcade / Glass. Themes only remassign CSS variables in [apps/web/app/theme.css](../apps/web/app/theme.css); components should not need `dark:` or theme-prefixed class variants.

| Role | CSS var | Tailwind | Used for |
| --- | --- | --- | --- |
| Page ground | `--bg-page` | `bg-page` | Shell / lobby / play page fill |
| Panel | `--bg-panel` | `bg-panel` | Primary panel fill (play ink or lobby paper via context) |
| Raised | `--bg-raised` | `bg-raised` | Nested cards / elevated surfaces |
| Overlay | `--bg-overlay` | `bg-overlay` | Modal scrims |
| Chrome | `--bg-chrome` | `bg-chrome` | Sidebar / purple chrome pigment |
| Text primary | `--text-primary` | `text-primary` | Body / titles (rebinding on panels) |
| Text muted | `--text-muted` | `text-muted` | Captions / secondary |
| On chrome | `--on-chrome` | `text-on-chrome` / `bg-on-chrome` | Glyphs and washes on purple chrome |
| Border | `--border-subtle` / `--border-strong` | `border-subtle` / `border-strong` | Default chrome borders (use opacity) |

Lobby (`.lobby-shell`) and play HUD (`.hud-panel`, chat docks) re-bind the semantic text/surface vars so `text-primary` stays correct on paper vs dusk vs dark ink.

**Do not** use `bg-mushroom` / `text-cream` / `text-ink-strong` for page or panel chrome — those brand names are migration aliases only.

Canonical tokens: [apps/web/app/theme.css](../apps/web/app/theme.css). Structural Arcade/Glass chrome (borders, blur, grid): [apps/web/app/globals.css](../apps/web/app/globals.css). Tailwind bridge: [apps/web/tailwind.config.ts](../apps/web/tailwind.config.ts). Android mirrors in [PokrTokens.kt](../apps/android/core/designsystem/src/main/java/com/pokr/android/core/designsystem/PokrTokens.kt).

## Color (brand / domain)

| Token | Hex | Web (CSS var / Tailwind) | Android | Used for |
| --- | --- | --- | --- | --- |
| Page / bg-page | `#E6D9D7` | `--bg-page` / `bg-page` | `PokrColors.BgPage` | Page ground (Classic) |
| Text primary | `#1D0432` | `--text-primary` / `text-primary` | `PokrColors.TextPrimary` | Body on light / context-bound |
| Text muted | `#44304A` | `--text-muted` / `text-muted` | `PokrColors.TextMuted` | Secondary copy |
| Ink | `#0E0618` | `--ink` / `bg-ink` | `PokrColors.Ink` | Deep play chrome (legacy) |
| Ink panel / Sidebar | `#1D0432` | `--ink-panel` / `--sidebar` / `bg-chrome` | `PokrColors.InkPanel` / `.Sidebar` | Panels, rail, primary CTA end |
| Ink raised | `#2E1048` | `--ink-raised` / `bg-raised` | `PokrColors.InkRaised` | Raised play fills |
| Ink overlay | `#08030E` | `--ink-overlay` / `bg-overlay` | `PokrColors.InkOverlay` | Modal scrims |
| Mushroom (legacy) | `#E6D9D7` | `--mushroom` | `PokrColors.Mushroom` | Alias of page ground — prefer `bg-page` |
| On chrome | `#E6D9D7` | `--on-chrome` / `text-on-chrome` | `PokrColors.OnChrome` | Text/icons on purple chrome |
| Lobby panel | `#FFFCFA` | `--bg-panel` in lobby / `hud-panel` | `PokrColors.LobbyPanel` | Light cards |
| Lobby card | `#EDE4E2` | `--bg-raised` / `--lobby-card` | `PokrColors.LobbyCard` | Nested cards inside panels |
| Felt / Felt deep | `#1D0432` / `#120220` | `--felt` / `--felt-deep` | `PokrColors.FeltGreen*` | Table surface |
| Felt mid / edge | `#341252` / `#0A0414` | table felt mid/edge | `PokrColors.FeltMid` / `.FeltEdge` | Table radial + primary start |
| Felt rim / rim edge | `#120220` / `#A88CA2` | `--felt-rim*` | `PokrColors.FeltRim*` | Wood/brass rim |
| Brass | `#D6BA80` | `--brass` | `PokrColors.Brass` | Money / rare accent |
| Brass light / dim | `#ECDAB0` / `#765C30` | `--brass-light` / `--brass-dim` | `PokrColors.BrassLight` / `.BrassDim` | Accent hover / shadow |
| Cream (legacy) | `#F2EAE8` | `--cream` | `PokrColors.Cream` | Prefer `text-on-chrome` / context `text-primary` |
| Cream muted (legacy) | `#CEBECC` | `--cream-muted` | `PokrColors.CreamMuted` | Prefer `text-muted` |
| Danger | `#C0392B` | `--danger` | `PokrColors.Danger` | Fold / errors |
| Positive | `#48A87A` | `--positive` | `PokrColors.Positive` | Live / win |
| Patina | `#BAA2C6` | `--patina` | `PokrColors.Patina` | Informational |
| Card face / red / ink | `#FAF7F0` / `#E53935` / `#1A1A1A` | `--card-*` | `PokrColors.Card*` | Playing cards |

### Arcade (v2) / Glass (v3) remap

Selected on Profile → Theme. Does **not** change felt presets, playing cards, brass-as-money, `--danger`, or `--positive`. Themes remassign semantic vars in `theme.css`; components keep the same classes.

| Token | Classic | Arcade | Glass |
| --- | --- | --- | --- |
| `--bg-page` | `#E6D9D7` | `#FDE93D` (24px grid overlay) | dusk purple `#2A1848` |
| `--bg-chrome` / sidebar | `#1D0432` | `#5B21B6` | frost purple |
| Lobby `--bg-panel` | `#FFFCFA` | `#FFFFFF` | frost fill |
| Lobby `--bg-raised` | `#EDE4E2` | `#FFF59D` | `#F4F0FA` |
| Page `--text-primary` | `#1D0432` | `#1A1028` | light on dusk; dark on frost panels |
| `--on-chrome` | `#E6D9D7` | `#FFFFFF` | `#FFFFFF` |
| Chrome | 1px muted borders, soft shadow | 3px black borders, hard `4px 4px 0 #000` shadow | ice rim + blur |
| Display font | RF Tone | Clash Display (web); system extra-bold (Android) |

Web applies `data-ui-theme="v2"|"v3"` on `<html>` (localStorage `pokr-ui-theme`, hydrated from `GET /api/me`). Android provides `PokrTheme(uiTheme)` from DataStore `ui_theme`.

### Chrome contexts

- **Lobby** (`.lobby-shell` / `FeltChrome.Lobby`): `bg-page` ground, paper `bg-panel`, `text-primary` dark ink, purple primary buttons.
- **Play** (table / offline HUD / `FeltChrome.Play`): purple `bg-panel`, `text-on-chrome` / light `text-primary` on docks, purple primary CTAs.

### Legacy aliases

`gold*` → `brass*`, `cyan*` → `patina*`, `felt-neon` / `Neon` → `positive`.
`mushroom` / `ink-strong` / `cream` → prefer `bg-page` / `text-primary` / `text-on-chrome`.

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

- One brand purple in Classic. Primary CTAs use the `#341252` → `#1D0432` gradient with `text-on-chrome` label text. Arcade CTAs are solid purple, white label, thick black border.
- Brass means money or rare emphasis — not every heading. Arcade does not remap brass.
- Color carries one meaning: danger = fold/errors, positive = live/win, patina = info. These stay global across looks.
- Body and caption text floors at 11px (12px when it is body-adjacent). Glow belongs on live state, never on static chrome.
- Playing card backs use page-stock + sidebar hatch (not wood/brass). Cards do not follow Arcade.
- Prefer semantic utilities (`bg-page`, `text-primary`, `text-muted`, `border-subtle`, `text-on-chrome`) so the same classes work across Classic / Arcade / Glass.
