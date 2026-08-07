# Felt — Texas Hold'em

Private No-Limit Texas Hold'em for casual home games.

## Stack

- **Engine** (`packages/engine`) — pure TypeScript NLHE state machine, CSPRNG shuffle, 7-card evaluator, side pots
- **Protocol** (`packages/protocol`) — Zod WebSocket/REST schemas
- **Server** (`apps/server`) — Express + native `ws`, Redis-optional KV, file/Postgres hand history
- **Web** (`apps/web`) — Next.js 15, React 19, Tailwind, Framer Motion
- **Android** (`apps/android`) — Jetpack Compose client (lobby, online WS table, offline engine)

## Prerequisites

- Node.js 20+ (repo includes `.nvmrc` → 22)

```bash
nvm use
npm install
```

## Develop

```bash
# Terminal 1 — game server (REST + WS on :4000)
npm run dev:server

# Terminal 2 — web UI (:3000)
npm run dev:web
```

Open http://localhost:3000 — register a name, create a table, share the invite code.

### Contests (tournaments)

Lobby **Contests** tab (web) or Contests panel (Android):

1. **Table match** — 2–9 players, fixed stacks, no rebuy; eliminated when chips hit zero; last player wins. Blinds rise on a fixed hand schedule.
2. **Knockout** — 4 / 8 / 16 players, heads-up single elimination. Winners advance through the bracket until a champion.

Create with optional bot fill, share the contest code, or open from the lobby. Contest page shows registration, bracket/standings, and routes you to your assigned table when play starts.

## Tests

```bash
npm test
```

## Deploy (Docker)

No cloud credentials are required for local/LAN deploy:

```bash
docker compose up -d --build
```

- Web UI: http://localhost:3000  
- API / WS: http://localhost:4000 (`/health`, `/ws`)

Stop with `docker compose down`. Hand history persists in the `poker-data` volume.

For a public URL (Vercel/Railway/Fly), you’ll need accounts + `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` pointed at the reachable game server (WSS). Rebuild web after changing those build args.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | Game server port |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS origin |
| `REDIS_URL` | unset | Optional Redis for table snapshots/pubsub |
| `DATABASE_URL` | unset | Optional Postgres for hand history |
| `DATA_DIR` | `./data` | File-backed history when no Postgres |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Browser → API |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:4000/ws` | Browser → WebSocket |

Without Redis/Postgres the server uses in-memory KV and JSONL history under `data/`.

## Android

Open `apps/android` in Android Studio (JDK 17, SDK 35). Defaults point at production Render:

```bash
cd apps/android
./gradlew :app:assembleDebug
```

See [apps/android/README.md](apps/android/README.md).

## Architecture notes

- Authoritative server: clients send action intents; hole cards are private per seat.
- Action messages require `handId` + monotonic `actionSeq`.
- Turn timeouts auto-check or auto-fold.
- Contests are orchestrated in-memory by `TournamentManager` on top of cash `Room`s (no rebuy; auto-deal between hands).
- See `apps/server/data/schema.sql` (written on boot) for Postgres DDL.
