# Pokr redesign v2 — frame catalog

Source: Figma file `zhouCnngCBkkyAkjDRxUGD`, page `0:1`.

Desktop frames are inside node `26:2` (Screens · updated Oct 19), 1440 wide including the caption bar. Mobile frames are inside node `25:2`. The design-system board is node `2:2`.

PNG export of these nodes did not complete. A second `get_screenshot` attempt on 21 Oct 2026 still hit the Figma Starter plan tool-call limit, so `frames/` has no PNGs. Node ids below are the frames to export into `frames/{desktop,mobile}/{signed-in,signed-out}/<id>.png` when the limit resets. The visual Playwright spec skips until `frames/desktop/signed-in/02.png` exists. Guest boards cited as `16:2` were not readable; guest states are implemented from the prompt defaults.

Home, contests, friends, profile, and auth frames are listed only so the ids are not reused. They are out of scope.

## In scope — desktop signed in

| Id | Title | Route | Node | Viewport |
| --- | --- | --- | --- | --- |
| 02 | Host a table | `/play` | `26:666` | 1440 |
| 03 | Join with code | `/play?mode=join` | `26:1033` | 1440 |
| 04 | Public tables | `/public` | `26:1311` | 1440 |
| 07 | Offline arena | `/solo` | `26:2872` | 1440 |
| 08a | Game table — Lobby (waiting) | `/offline` and `/table/[id]` | `26:3269` | 1440 |
| 08b | Game table — Flop, your turn | `/offline` and `/table/[id]` | `26:3486` | 1440 |
| 08c | How to play dialog | over `08b` | `26:3797` | 1440 |
| 16a | Analysis — All tables | `/analysis` | `26:8081` | 1440 |
| 16b | Analysis — Vs players | `/analysis?type=players` | `26:8773` | 1440 |
| 16c | Analysis — Loading | `/analysis` | `26:9243` | 1440 |
| 16d | Analyse confirm | over `16a` | `26:9637` | 1440 |
| 16e | Analysis — Empty | `/analysis?type=players` | `26:10246` | 1440 |
| 17a | Table analysis overview | `/analysis/[tableId]` | `26:10487` | 1440 |
| 17b | Hand detail — Win | `/analysis/[tableId]?hand=1` | `26:11157` | 1440 |
| 17c | Hand detail — Loss | `/analysis/[tableId]?hand=13` | `26:11703` | 1440 |
| 17d | Hand detail — Multi-way | `/analysis/[tableId]?hand=1` | `26:12258` | 1440 |

## In scope — mobile signed in

| Id | Title | Route | Node | Viewport |
| --- | --- | --- | --- | --- |
| 02M | Host a table | `/play` | `25:852` | 390 |
| 03M | Join with code | `/play?mode=join` | `25:1105` | 390 |
| 04M | Public tables | `/public` | `25:1298` | 390 |
| 07M | Offline arena | `/solo` | `25:2606` | 390 |
| 08aM | Lobby + chat drawer | `/offline` | `25:2806` | 390 |
| 08bM | Flop, your turn | `/offline` | `25:3007` | 390 |
| 08cM | How to play sheet | `/offline` | `25:3249` | 390 |
| 08dM | Raise sheet | `/offline` | `25:3863` | 390 |
| 08bL | Landscape | `/offline` | `25:6652` | 844×390 (frame 860×466 with caption) |
| 16aM | Analysis — All tables | `/analysis` | `25:6839` | 390 |
| 16bM | Vs players | `/analysis?type=players` | `25:7256` | 390 |
| 16cM | Loading | `/analysis` | `25:7628` | 390 |
| 16dM | Analyse sheet | `/analysis` | `25:7855` | 390 |
| 16eM | Empty | `/analysis` | `25:8245` | 390 |
| 16fM | Filters sheet | `/analysis` | `25:8416` | 390 |
| 17aM | Table overview | `/analysis/[tableId]` | `25:8845` | 390 |
| 17bM | Hand win | `/analysis/[tableId]` | `25:9400` | 390 |
| 17cM | Hand loss | `/analysis/[tableId]` | `25:9758` | 390 |
| 17dM | Multi-way | `/analysis/[tableId]` | `25:10134` | 390 |

## Guest and gate

No guest-board node was readable this session. Implemented states: `02G` `03G` `04G` `07G` `08bG` `16aG` and mobile twins, plus gate `18G` / `18GM` (sign in, create account, Google, not now → `/solo`).

## Out of scope captions on the same boards

`01` Home, `05a`–`05b` Contests, `06` Friends, `09a`–`09g` Profile, `10`–`15` auth and legal. Design system `2:2`. Mode palette `37:2` and per-game palette `36:2` were not re-fetched after the rate limit.

## Assumptions carried into the build

- Stacked table layout (`data-table-layout=v2`) matches `08a`/`08b`. Classic (`v1`) uses the same pieces on an oval.
- Nine felt presets stay; the felt reads `data-table-color`.
- Tablet widths use the desktop composition scaled down.
- Outfit stands in for RF Tone. Inter is the body face. Files in `brand/fonts/` are SIL OFL (Fontsource).
- Analysis uses the existing `/api/me/analysis/*` client. The hands adapter covers `/api/me/hands` when the tables call is empty.
- Flag: `NEXT_PUBLIC_POKER_V2`, then `localStorage` `pokr-pkv2`, then `?pkv2=1|0`. `all` does not enable `analysis`. Preview enables lobby, public, table, and offline.
- Global shell is unchanged. Frames include a sidebar that this pass does not build.
