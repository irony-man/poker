# Felt — UX Audit and Feature Roadmap

Audit of both clients (`apps/web`, `apps/android`) against the server and engine
(`apps/server`, `packages/engine`). Written to be argued with: every finding names a file,
and the roadmap states its reasoning so the ordering can be challenged.

This lands after the Card Room redesign (see [UI_REDESIGN_PROMPT.md](UI_REDESIGN_PROMPT.md)
and [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)). Nothing here is a restyle; it is flow,
information, and capability.

**Severity**

- **P0** — broken, unreachable, or causes a player to lose chips they did not mean to lose.
- **P1** — real friction, or information a poker player needs and cannot get.
- **P2** — consistency, accessibility, and polish.

---

# Part 1 — UX Audit

## 1. First run and identity

**P0 — Clerk is a runtime trap.** `/sign-in` and `/sign-up` render `<SignIn />` and
`<SignUp />` from `@clerk/nextjs`, but there is no `ClerkProvider` anywhere in the app.
Both routes throw when mounted. [middleware.ts](../apps/web/middleware.ts) is an explicit
no-op with `matcher: []`. Nothing links to either route.
*Fix: either wrap the app in `ClerkProvider` and link sign-in from the header, or delete
both routes and the dependency.*

**P1 — Two identity systems that do not know about each other.** Real play uses an
anonymous callsign: `ensureSession` in [app/page.tsx](../apps/web/app/page.tsx) calls
`register()` and writes a `felt-session` blob to `localStorage`. `createTable` and
`register` in [lib/api.ts](../apps/web/lib/api.ts) accept a `clerkToken`, but the lobby
never passes one. A signed-in user and an anonymous user are indistinguishable to the
table.
*Fix: pick one. If Clerk stays, pass the token on the entry path so the account is the identity.*

**P1 — Identity is asked for twice.** The lobby collects callsign and avatar. Arriving by
invite link goes to [app/table/[id]/page.tsx](../apps/web/app/table/[id]/page.tsx), which
asks for callsign again and never offers the avatar picker, so link-first users have no
avatar.
*Fix: one identity step, shared between both entry points.*

**P2 — Avatar can desync from the session.** `setSession` in
[lib/store.ts](../apps/web/lib/store.ts) stores `userId`, `name`, and `ticket` but not
`avatarId`, which lives separately in `felt-session` and `felt-avatar-id`
([lib/avatars.ts](../apps/web/lib/avatars.ts)).
*Fix: put `avatarId` in the store and treat `felt-session` as the only persisted copy.*

**P2 — Corrupt session fails silently.** Both entry points parse `felt-session` inside
`try { } catch { /* ignore */ }`. A bad blob yields an empty callsign with no explanation.
*Fix: clear the key and tell the user their session was reset.*

**P2 — Callsign rules differ by tab.** Host and Join require a non-empty callsign; Offline
silently falls back to `Player`. Same field, same screen, different rules.

## 2. Finding a game

**P0 — A dead server looks like an empty lobby.** `refresh` in
[PublicTablesPanel.tsx](../apps/web/components/PublicTablesPanel.tsx) catches fetch errors
and discards them. On failure every stake shows `0/6` with "Sit down" disabled, which is
pixel-identical to a healthy server with no players.
*Fix: hold an error state and show "Can't reach the server" with a retry.*

**P1 — Discovery is behind a tab that is not the default.** The lobby opens on Host
(`useState<LobbyTab>('host')`). On mobile, `PublicTablesPanel` renders only under the Join
tab, so a first-time user never sees that live games exist.
*Fix: default to the tab that gets someone playing fastest, or surface quick-join above the tabs.*

**P1 — No loading state on first paint.** Before the first fetch resolves the panel renders
zeroed stake rows, so loading and empty look the same.

**P1 — Full tables are still clickable.** The panel prints `seated/max` but only disables
the button when the table object is missing, not when `seated >= max`. The user taps,
navigates, and the server rejects them.

**P2 — The refresh is invisible and unpausable.** A 10s interval with no "updated Xs ago",
no manual refresh, and no pause when the tab is hidden.

**P2 — Hosting is always private.** `isPrivate: true` is hardcoded at the create call.
There is no way to host a public table; public rings only exist because
[publicTables.ts](../apps/server/src/publicTables.ts) creates them at boot.

## 3. Joining

**P1 — Join validates more weakly than Host.** The host room code enforces 4–8 digits and
strips non-digits. The join field only sets `maxLength={8}` — no minimum, no digit
filtering — so a typo produces a generic `Invite not found` that reads the same as an
expired table.

**P1 — Invite links are not validated.** The lobby path calls `resolveInvite` first. The
deep-link path passes `invite` to `TableView` for the share UI only; the socket joins on
`tableId` alone ([lib/ws.ts](../apps/web/lib/ws.ts)). A stale link produces `not_found` and
a bounce to the home page with no explanation of what went wrong.

**P1 — Errors appear far from the thing that failed.** The lobby renders one error string
at the bottom of the page, below the entire grid, with no `aria-live`. Switching tabs does
not clear it, so a stale message follows you into a different flow.

**P2 — Public join can strand the button.** `handleJoin` in `PublicTablesPanel` sets
`busy` and calls `onJoin(...)` without awaiting it. If the parent throws, "Joining…"
never clears.

## 4. The hand loop

**P0 — Bet presets fire immediately.** Min, ½, Pot, and Max call `submitBet(val)` on click
in [ActionControls.tsx](../apps/web/components/ActionControls.tsx). They are not sizing
controls; they are one-tap commitments sitting next to Fold. On a phone this is a
misclick that costs a stack.
*Fix: presets set the amount, a second deliberate tap commits it.*

**P0 — Nothing confirms a large commitment.** Fold and All-in are single taps with no
guard and no undo window.

**P0 — Actions vanish when the socket is down.** `send()` in `lib/ws.ts` returns `false`
when the socket is not open and every caller ignores the return value. A stale `table`
still renders your turn, so you can fold into the void and never know.
*Fix: disable the action dock while not `open`, and say why.*

**P1 — The engine folds when checking is free.** `applyTimeout` in
[hand.ts](../packages/engine/src/hand.ts) always folds, with a comment acknowledging it
happens "even when a check is available". A player who blinks off a free check loses their
hand.
*Fix: check when checking is legal, fold only when facing a bet.*

**P1 — Portrait hides who is still in the hand.** `renderCards` in
[SeatView.tsx](../apps/web/components/SeatView.tsx) is
`landscape || !compact || isSelf`, so on a portrait phone opponents show no card backs.
You cannot see who folded.

**P1 — Wrong copy between hands.** `ActionControls` shows "Waiting for your turn…" for any
state that is not `waiting` and not your turn, including `payout`. The hand is over and
the UI says it is coming to you.

**P1 — Positions are invisible.** `sbSeat` and `bbSeat` are in the store and rendered
nowhere. Blinds are announced only as chat lines, which are behind an overflow menu on
mobile. The dealer is a "D" chip in the middle of the felt rather than on the button seat.

**P1 — No price to call, no pot odds, no stack in big blinds.** `callAmount` and `pot` are
both available in `ActionControls`; neither is expressed as a ratio or a percentage, and
stacks are only ever shown in chips even though bet snapping already works in big blinds.

**P1 — Side pots are a count, not information.** `PotBanner` prints "{n} pots" when there
is more than one. The `sidePots` array carries per-pot `amount` and `eligible` seats and
neither is shown, so an all-in player cannot tell what they are playing for.

**P1 — No pre-actions.** No check-fold, no call-any, no auto-muck anywhere in the repo.
Every decision requires you to be present and in-turn.

**P1 — No hand history on the felt.** The action log exists only as system chat. There is
no compact "this hand" strip, so on mobile you must open a drawer to learn what happened.

**P2 — `TurnTimerBar` is dead code.** Defined in
[TurnTimer.tsx](../apps/web/components/TurnTimer.tsx), mounted nowhere. When it is not
your turn, the only clock is a ring on a seat that may be off-screen.

**P2 — No keyboard shortcuts.** No fold/call/check/raise bindings; only Enter inside the
desktop raise field.

**P2 — Mobile has no numeric bet entry.** Desktop gets a number input; portrait and
landscape get a slider and a "Custom {amount}" button, which makes exact sizing awkward.

**P2 — Preset chips are below the touch target minimum.** `min-h-8` (32px) in the landscape
action strip, against a ~44px guideline.

## 5. The showdown moment

**P1 — Dismissing the winner modal does not resolve the hand.** `WinHandModal` closing only
sets `dismissedWinHandId`; the table stays in `payout` until someone starts the next hand,
and nothing explains who can do that or that you are waiting on them.

**P1 — The headline is wrong for split pots.** The title derives from `winners[0]` only, so
a three-way chop is announced as a single winner.

**P1 — Losing hands are not shown clearly.** Winners get board highlighting; mucked and
beaten hands get no comparable treatment, so it is hard to see why you lost.

**P2 — Modals are not dialogs.** `WinHandModal` has `role="dialog"` but no Escape handler,
no backdrop dismiss, and no focus trap. `TopUpModal` has none of the three plus no dialog
role. `TableOverflowMenu` does this correctly and is the reference to copy.

## 6. Social

**P0 — Friends and challenges are unreachable.** `FriendsPanel.tsx` is never imported by
anything. Search, requests, accept/decline, challenge, and join-challenge are all
implemented, all backed by live server routes, and all invisible.
*Fix: mount it, or delete the component and its API surface.*

**P1 — Online emoji never reaches the chat log.** `lib/ws.ts` handles `emoji` by firing the
burst only. The offline table pushes the same event to chat as well, so the two modes
disagree about whether reactions are history.

**P2 — Chat is two taps and full-screen on mobile.** Overflow menu, then Chat, then a
drawer that covers the table. There is no glanceable half-height option mid-hand.

## 7. Recovery from failure

**P0 — Server restart destroys every live table.** Rooms, users, and tickets are all
in-memory. `Room.persist` writes a public snapshot to KV, but `kv.get` is never called for
rooms, so nothing is restored. Players in a hand lose their stacks.

**P1 — Reconnection is a coloured dot.** `lib/ws.ts` retries every 2s. There is no banner,
no "reconnecting" overlay, and actions stay enabled throughout (see P0 above).

**P1 — A socket that closes before the first sync yields a blank table.** `TableView` only
blocks rendering while `connecting` or `open` with no table. Reaching `closed` first
renders an empty felt with a "…" street and no recovery path.

**P2 — Raw enum values are shown to users.** `connecting`, `open`, and `closed` are printed
directly.

**P2 — Errors are never announced.** No `role="alert"` or `aria-live` on the lobby error,
the table error strip, the panel errors, or the "Copied!" confirmation.

## 8. Cross-cutting

**P1 — Two table implementations drift.** [TableView.tsx](../apps/web/components/TableView.tsx)
and [OfflineTableView.tsx](../apps/web/components/OfflineTableView.tsx) each reimplement the
felt, and behaviour has already diverged: the offline desktop tool strip shows mid-hand,
the offline start CTA appears whenever between hands, offline never passes `spectating` to
`ActionControls`, the landscape rim treatment exists only online, and the two compute
winner aggregation with near-identical duplicated code.

**P1 — Android silently drops `seat_action`.** The type is absent from `ServerMessage.kt`,
so kotlinx deserialization fails and `PokerWebSocketClient` discards the message. The
last-move popup simply does not exist on Android, with no error.

**P1 — Anyone can control the table.** There is no host or role check. Any connected user
can add bots, remove all bots, and start hands.

**P2 — Android landscape hides table management.** Footer controls and the invite share are
gated off in landscape with no overflow equivalent, so bots, sit-out, top-up, and sharing
are unreachable while rotated.

**P2 — Android lags on discovery and hosting.** No public tables API or panel, no friends,
no voice, and hosting uses fixed 5/10/1000 defaults with no stake presets.

## 9. Where Android is ahead

Worth copying back to web rather than treating parity as one-directional:

- **One table UI for online and offline.** `FeltTableLayout`, `TableActionControls`, and
  `WinHandDialog` are shared, which is exactly the duplication web has not solved.
- **Ticket refresh on connect.** `TableRepository` re-issues via `POST /api/ticket` with a
  re-register fallback; web opens the socket with whatever is in `localStorage`.
- **Structured session storage.** DataStore instead of hand-rolled `localStorage` parsing.

---

# Part 2 — Roadmap

Sizes are rough: **S** is under a day, **M** is a few days, **L** is a week or more.

## Tier 0 — Decide and clear

Cheap, and it stops the codebase advertising features the product does not have. Do this
first because everything below is easier to reason about once the dead paths are gone.

- **Resolve friends** — S. Mount `FriendsPanel` in the lobby, or delete it along with the
  friends helpers in `lib/api.ts`. Server routes in
  [friends.ts](../apps/server/src/friends.ts) can stay either way.
  *Outcome: the social feature either exists or stops pretending to.*
- **Resolve Clerk** — S. Add `ClerkProvider` and a header entry point, or remove
  `app/sign-in`, `app/sign-up`, `middleware.ts`, and the dependency.
  *Outcome: no route that throws on mount.*
- **Delete dead protocol and server code** — S. `table_created` in
  [messages.ts](../packages/protocol/src/messages.ts) is never sent; `RoomManager.listPublic()`
  in [room.ts](../apps/server/src/room.ts) has no caller.
- **Decide on KV** — S. Either read snapshots back at boot or remove the write path and the
  unused pub/sub, so the persistence story is honest.

## Tier 1 — Trust

Players forgive missing features. They do not forgive losing a stack to a mis-tap or a
silent disconnect. This tier is the highest ratio of goodwill to effort in the document.

- **Two-step bet presets** — S. Presets set the amount; a second tap commits.
  Files: `ActionControls.tsx`.
  *Outcome: no single tap can commit an unintended size.*
- **Confirm large commitments** — S. Threshold confirm for all-in and for bets over a set
  fraction of stack. Files: `ActionControls.tsx`.
- **Block actions while disconnected** — S. Respect the `send()` return value, disable the
  dock when the socket is not `open`, and show a reconnect banner.
  Files: `lib/ws.ts`, `TableView.tsx`, `ActionControls.tsx`.
- **Check instead of fold on timeout** — S. Fold only when facing a bet.
  Files: [hand.ts](../packages/engine/src/hand.ts) `applyTimeout`, plus an engine test.
  *Outcome: the clock stops punishing players for free checks.*
- **Correct between-hands copy** — S. Distinguish payout, waiting for players, and waiting
  for your turn. Files: `ActionControls.tsx`.
- **Surface public-table failures** — S. Error state, retry, and a loading skeleton;
  disable full tables. Files: `PublicTablesPanel.tsx`.
- **Show opponent card backs in portrait** — S. Files: `SeatView.tsx`.
- **Validate invite codes on the link path** — M. Resolve before connecting and give a real
  "that code is invalid or the table has closed" screen.
  Files: `app/table/[id]/page.tsx`, `TableView.tsx`.
- **Modal hygiene** — S. Escape, backdrop dismiss, and focus trap on `WinHandModal` and
  `TopUpModal`, following `TableOverflowMenu`.

## Tier 2 — Poker literacy

Making the table legible. Most of this is rendering data the client already receives, so
the cost is layout, not plumbing.

- **Dealer, SB, and BB badges on seats** — S. `sbSeat` and `bbSeat` are already in the
  store. Files: `SeatView.tsx`, `TableView.tsx`.
- **Stacks and bets in big blinds** — S. A toggle, defaulting to chips.
  Files: `SeatView.tsx`, `PotBanner.tsx`, `ActionControls.tsx`.
- **Price to call and pot odds** — S. Both inputs are already in `ActionControls`.
- **Side pot detail** — M. Per-pot amounts and eligible seats.
  Files: `PotBanner.tsx`, `SeatView.tsx`.
- **Current-hand action strip** — M. A compact on-felt log so the hand is readable without
  opening chat. Files: new component, `TableView.tsx`, `OfflineTableView.tsx`.
- **Mount a turn clock for other players** — S. `TurnTimerBar` already exists.
- **Keyboard shortcuts** — S. F/C/K/R with a discoverable hint.
- **Hand rank reference** — S. A dismissible "what beats what" panel.

## Tier 3 — Features that change the product

These are new capability rather than repair. Two of the three biggest items are mostly
wiring, because the server already does the hard part.

- **Pre-actions** — M. Check-fold, call-any, check-call, auto-muck, cleared on every new
  street. Files: `ActionControls.tsx`, `lib/store.ts`; can be client-only initially.
  *Outcome: the table stops requiring undivided attention.*
- **Hand history viewer** — M. `GET /api/tables/:id/history` is live and has no consumer.
  Add the client helper and a reviewer UI.
  Files: `lib/api.ts`, new component, `TableOverflowMenu.tsx`.
  *Outcome: disputes become checkable.*
- **Session P&L** — M. `chip_ledger` exists in
  [schema.ts](../packages/db/src/schema.ts) with no INSERT anywhere. Write on buy-in,
  top-up, and cash-out, then show a session result on leave.
  Files: `history.ts`, `room.ts`, new endpoint, `WinHandModal.tsx`.
  *Outcome: players learn whether they are up.*
- **Host controls** — M. Restrict start-hand and bot management to the host; expose seat
  kick. Files: `room.ts`, `index.ts`, `TableView.tsx`.
- **Muck or show at showdown** — M. Currently every living player is force-revealed.
  Files: `hand.ts`, `messages.ts`, `ActionControls.tsx`.
- **Buy-in ranges and partial top-up** — M. Today the buy-in is a fixed number and top-up
  only works at exactly zero chips. Files: `hand.ts` `topUp`, `messages.ts`, `TopUpModal.tsx`.
- **Unify the two table views** — M. Extract the shared felt so online and offline stop
  drifting. Android already demonstrates the shape.

## Tier 4 — Durability and parity

Needed before this is something you would leave running for other people.

- **Restore rooms on boot** — L. Requires snapshotting private state, which the current
  KV write deliberately omits. Files: `room.ts`, `kv.ts`.
- **Persist users and tickets** — M. `AuthStore` is in-memory and its own comment says to
  swap it. Also fixes the Postgres `tables.host_user_id` foreign key, which references a
  `users` table nothing ever writes to. Files: `auth.ts`, `history.ts`, `schema.ts`.
- **Android `seat_action`** — S. Add the type to `ServerMessage.kt` and a seat popup.
- **Android public tables** — M. Add the API method and a lobby panel.
- **Android host stake presets** — S. Reuse `STAKE_PRESETS`.
- **Android landscape parity** — M. An overflow menu so bots, sit-out, top-up, and share
  survive rotation.
- **Web ticket refresh** — S. Copy the Android pattern before opening the socket.
- **HTTP rate limiting** — M. WebSocket actions are limited per room; the HTTP surface is not.

## Explicitly not now

Not because they are bad, but because each needs something that does not exist yet.

- **Rake** — needs a real money or accounting story; this is a home-game product.
- **Tournaments and SNGs** — needs blind schedules, registration, and elimination, which is
  a second product on top of the ring engine.
- **Time bank** — worth having, but only after the timeout-folds-a-free-check bug in Tier 1.
- **Straddle, run-it-twice, rabbit hunting** — engine changes that only pay off once the
  table is legible; do Tier 2 first.
- **Waitlist** — irrelevant until tables fill often enough to queue for.
- **All-in equity display** — needs an equity calculator the engine does not have.
- **Auto-rebuy** — needs buy-in ranges from Tier 3 first.

## Suggested sequence

Tier 0 and Tier 1 together are roughly one to two weeks and produce a product that does not
lose people's chips or lie about its features. Tier 2 is the next block and is what makes it
feel like a poker client rather than a card-dealing app. Tier 3 is the first work that adds
genuinely new capability, and two of its items are mostly wiring against endpoints and
tables that already exist. Tier 4 is the gate before running this for anyone outside a
trusted group.
