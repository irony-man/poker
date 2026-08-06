# UI Redesign Prompt for Felt

A ready-to-paste prompt for driving a full cross-platform visual redesign (Next.js web +
Compose Android) with an agent.

## How to use it

- Paste the fenced block below into a fresh agent session at the repo root.
- Phase 0 is the highest-leverage step: pick a direction before letting the agent write
  any code, otherwise you get a redesign you did not choose.
- To split the work across two sessions, stop after Phase 4 and hand the second agent
  `docs/DESIGN_SYSTEM.md` plus the finished web screens as the reference for Phase 5.

## Why it is phased

A single mega-instruction spanning two platforms produces mush. Each phase ends at a
reviewable checkpoint so the direction can be corrected before it compounds.

## The prompt

```markdown
You are redesigning the UI of Felt, a real-time Texas Hold'em poker app. This is a
visual redesign, not a polish pass: new palette, type, table treatment, and motion
language. Both client surfaces must land on one coherent design language.

## Repo map

Monorepo at the workspace root, npm workspaces.

Web — `apps/web`, Next.js 15 App Router, React 19, Tailwind 3.4, zustand, framer-motion.
- Screens: `app/page.tsx` (lobby), `app/table/[id]/page.tsx`, `app/offline/page.tsx`
- Shell/layout: `components/TableShell.tsx`, `components/AppChrome.tsx`, `app/layout.tsx`
- Table: `components/TableView.tsx`, `components/OfflineTableView.tsx`,
  `components/SeatView.tsx`, `components/CommunityBoard.tsx`, `components/PlayingCard.tsx`,
  `components/ChipStack.tsx`, `components/PotBanner.tsx`, `components/DealerPotZone.tsx`
- Actions: `components/ActionControls.tsx`, `components/FloatingActionDock.tsx`,
  `components/TurnTimer.tsx`
- Overlays/panels: `components/WinHandModal.tsx`, `components/ChatPanel.tsx`,
  `components/TopUpModal.tsx`, `components/FriendsPanel.tsx`,
  `components/PublicTablesPanel.tsx`, `components/TableOverflowMenu.tsx`,
  `components/ShareTableLink.tsx`, `components/VoiceCallBar.tsx`
- Tokens: `app/globals.css` (`:root` vars + `@layer components` classes) and
  `tailwind.config.ts` (`theme.extend`)
- Layout logic: `lib/tableLayout.ts` — `useIsNarrow`, `useIsLandscapePhone`,
  `seatAnglesForHero`
- State: `lib/store.ts` (zustand), socket in `lib/ws.ts`

Android — `apps/android`, Jetpack Compose + Material3, Hilt, Gradle modules.
- Design system: `core/designsystem/.../Components.kt` (`FeltColors`, `HudPanel`,
  `FeltPrimaryButton`, `FeltGhostButton`, `FeltChoiceChip`, `CasinoChip`, `FeltLabel`,
  `StatusChip`, `FeltTableSurface`, `PotDisplay`, `DealerPotZone`),
  `FeltTheme.kt`, `TableUi.kt` (`SeatChip`), `PlayingCard.kt`, `TurnTimer.kt`,
  `FloatingActionPanel.kt`, `WinHandDialog.kt`, `Orientation.kt`
- Features: `feature/lobby`, `feature/table`, `feature/offline`

## Known problems to fix (verified, not speculative)

1. Three competing token sources that have drifted. Web `:root` in `globals.css`, web
   `tailwind.config.ts`, and the Android `FeltColors` object. Panel is `#0d1218` on web
   but `#12161E` on Android; cream is `#e8eef5` vs `#F5F0E6`.
2. No shared typography. Web loads Oxanium/Rajdhani through a Google Fonts `@import`
   in `globals.css`; Android uses `FontFamily.SansSerif`, with a stray `FontFamily.Serif`
   at 32sp in `PotDisplay`.
3. `TableView.tsx` and `OfflineTableView.tsx` duplicate the same table layout.
4. Seat rendering branches on `narrow`/`landscape`/`compact` through long inline class
   ternaries with magic values (`text-[7px]`, `text-[8px]`, `w-[3.4rem]`).
5. Legibility: sub-10px type and low-contrast values like `text-cream/40` on meaningful
   information.
6. Motion is ad hoc. `framer-motion` is installed but used only in `PlayingCard.tsx`;
   everything else is CSS keyframes or nothing.
7. Dead deps: `three`, `@react-three/fiber`, `@react-three/drei` have no imports;
   `@letele/playing-cards` only survives in `next.config.ts` `transpilePackages` and a
   `.d.ts` shim.

## Hard constraints

- Do not change game logic or the wire format: `packages/engine`, `packages/protocol`
  message schemas, and `apps/server` behavior stay as they are.
- Do not rename zustand store keys in `apps/web/lib/store.ts` or change the message
  handling in `apps/web/lib/ws.ts`.
- Preserve every existing capability and state: spectating, sit/stand/sit-out, top-up,
  bots, all-in, side pots, showdown, winner reveal, turn timer, seat action popup,
  chat and emoji bursts, voice bar, invite/room codes.
- Three layouts must keep working: desktop, phone portrait, and phone landscape (the
  `useIsLandscapePhone` path, and the Android landscape chrome).
- Keep the hero player pinned to bottom-center; `seatAnglesForHero` geometry stays
  correct for 2–9 seats.
- TypeScript stays strict and clean.

## Phases — stop for review at the end of each

### Phase 0 — Direction
Read the files above. Then propose 2–3 distinct visual directions. For each: a one-line
concept, full palette with hex values, type pairing, felt/table treatment, card face
treatment, and motion character. Include a short note on what each direction does for
readability at a glance during a hand. Do not write implementation code yet. Wait for me
to pick one.

### Phase 1 — One token source
Implement the chosen direction as a single canonical token set, then mirror it:
- Web: canonical values in `app/globals.css` `:root`, referenced by
  `tailwind.config.ts` so the two cannot drift.
- Android: rewrite `FeltColors` and `FeltTheme.kt` with byte-identical hex values.
- Move web fonts from the CSS `@import` to `next/font`; add the matching families to
  Android via `res/font` so both platforms share the type ramp. Remove the stray
  `FontFamily.Serif` in `PotDisplay`.
- Define and use explicit scales for spacing, radius, elevation, and type. No new
  arbitrary Tailwind values in table chrome.
- Write `docs/DESIGN_SYSTEM.md` mapping each token to its web name and Android name.

### Phase 2 — Web primitives
Rebuild the `@layer components` classes (`hud-panel`, `hud-input`, `hud-label`,
`btn-primary`, `btn-ghost`, `btn-secondary`, `btn-danger`, `choice-chip`, `status-chip`,
`field-select`, `bet-slider`, `felt-surface`, `table-rim`) on the new tokens, then the
table primitives: `SeatView`, `PlayingCard`, `ChipStack`, `CommunityBoard`, `TurnTimer`,
`PotBanner`, `DealerPotZone`. Replace the `compact`/`landscape` ternary soup in
`SeatView` with a named density variant driven by a size scale. Floor body text at 10px
and hit at least WCAG AA contrast for anything a player reads mid-hand. Extract the
layout shared by `TableView` and `OfflineTableView` so the felt is described once.

### Phase 3 — Web screens
Redesign the lobby (`app/page.tsx`), the online and offline tables, `WinHandModal`,
`ChatPanel`, and the action dock. Verify each at desktop, phone portrait, and phone
landscape. Preserve every control that exists today, including the overflow menu items.

### Phase 4 — Motion
Build a small motion system on framer-motion: card deal, chip-to-pot, pot-to-winner,
seat action popup, turn timer urgency, winner reveal. UI transitions stay under ~250ms;
only card and chip choreography may run longer. Honor `prefers-reduced-motion`. Delete
the dead 3D dependencies and the `@letele/playing-cards` shim if still unused.

### Phase 5 — Android parity
Port the same tokens, type ramp, component shapes, and motion character to
`Components.kt`, `TableUi.kt`, `PlayingCard.kt`, `TurnTimer.kt`, `FloatingActionPanel.kt`,
`WinHandDialog.kt`, and the lobby/table/offline feature screens. Portrait and landscape
phone chrome both stay correct. When done, web and Android should read as the same
product.

## Verification

Run after each phase and fix what breaks:
- `npm run typecheck`
- `npm run build`
- Manual: `npm run dev:server` (port 4000) and `npm run dev:web` (port 3000). Play a hand
  vs bots at 6 seats and at 2 seats. Check desktop, phone portrait, phone landscape.
- Android: `cd apps/android && ./gradlew assembleDebug`

## Deliverable

For each phase: the code, a one-paragraph summary of the visual decisions, and before/
after screenshots of every screen you touched at all three breakpoints.
```
