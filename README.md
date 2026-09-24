# Pokr — Texas Hold'em

Private No-Limit Texas Hold'em for casual home games.

## Stack

- **Engine** (`packages/engine`) — pure TypeScript NLHE state machine, CSPRNG shuffle, 7-card evaluator, side pots
- **Protocol** (`packages/protocol`) — Zod WebSocket/REST schemas
- **Server** (`apps/server`) — Express + native `ws`, Redis-optional KV, file/Postgres hand history
- **Web** (`apps/web`) — Next.js 15, React 19, Tailwind, Framer Motion
- **Android** (`apps/android`) — Jetpack Compose client (lobby, online WS table, offline engine)
- **FunGPT sidecar** (`apps/fungpt`) — optional local BanterBot LLM for `/chat` and table banter

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

Open http://localhost:3000 — sign up or sign in with a username and password, create a table, share the invite code.

### Bot chat / table banter LLM (optional)

Lobby **Bots** (`/chat`) and seated-bot table banter use OpenAI-compatible chat completions. You can point **lobby chat** and **table banter** at different hosts (e.g. Cohere for `/chat`, FunGPT for table lines). When unset, table bots use phrase templates and `/chat` returns unavailable.

**Recommended for the Oracle VM (no GPU):** a hosted API. Nest already sends the BanterBot system prompt; only the model id changes.

```bash
# On the VM `.env` (then restart server — no web rebuild needed):
BANTER_LLM_BASE_URL=https://api.openai.com
BANTER_LLM_API_KEY=sk-...
BANTER_LLM_MODEL=gpt-4o-mini
BOT_CHAT_MODEL=gpt-4o-mini
BANTER_LLM_PATH=/v1/chat/completions
BANTER_LLM_TIMEOUT_MS=8000
BOT_CHAT_TIMEOUT_MS=60000
```

Same pattern works with OpenRouter, Together, Fireworks, etc. (set `BANTER_LLM_BASE_URL` + model id for that host).

**Local BanterBot sidecar (dev or GPU host):**

```bash
# Hugging Face weights use Git LFS (sudo apt install git-lfs && git lfs install)
./scripts/download-banterbot-weights.sh
pip install -r apps/fungpt/requirements.txt
# plus torch/transformers (see apps/fungpt/Dockerfile)

npm run dev:fungpt

# In .env:
BANTER_LLM_BASE_URL=http://127.0.0.1:8000
BANTER_LLM_MODEL=banterbot
# or omit BOT_CHAT_MODEL / BANTER_LLM_MODEL to default to banterbot
```

**Cohere for lobby `/chat` + FunGPT for table banter** (recommended on CPU VM):

```bash
# .env — restart server only (no web rebuild)
BOT_CHAT_LLM_BASE_URL=https://api.cohere.ai/compatibility/v1
BOT_CHAT_LLM_API_KEY=your-cohere-api-key
BOT_CHAT_MODEL=command-r-plus-08-2024

BANTER_LLM_BASE_URL=http://fungpt:8000
BANTER_LLM_MODEL=banterbot
BANTER_LLM_TIMEOUT_MS=20000
```

**Compose sidecar** (optional profile; mounts `apps/fungpt/weights`):

```bash
./scripts/download-banterbot-weights.sh

# .env (table banter)
BANTER_LLM_BASE_URL=http://fungpt:8000
BANTER_LLM_MODEL=banterbot

docker compose --profile fungpt up -d --build
```

Prefer a GPU for the sidecar. CPU float32 is slow and may miss table-banter timeouts.

### Contests (tournaments)

Lobby **Contests** tab (web) or Contests panel (Android):

1. **Chips** — 2–9 players, equal starting stacks, no top-ups; busted players are eliminated; last stack standing wins. Blinds rise on a fixed hand schedule.
2. **Rounds** — 2–9 players, equal start stacks, top-ups allowed when broke; after a fixed number of hands (or if fewer than two stacks remain), standings are by chip count and the chip leader wins.

Create with optional friend invites and bot fill. Share the contest code, or open from the lobby. Friends see invites under **Friends → Invites**. Contest page shows registration, progress/standings, and routes you to your assigned table when play starts.

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
| `WEB_ORIGIN` | `http://localhost:3000` | Extra CORS origins (comma-separated; `pokr.site` always allowed) |
| `DATABASE_URL` | unset → file stores | **Postgres** for users, sessions, social, hand history |
| `REDIS_URL` | unset | Optional Redis for table snapshots/pubsub |
| `DATA_DIR` | `./data` | File fallback when Postgres is unset; also schema.sql dump |
| `NEXT_PUBLIC_SITE_URL` | `https://pokr.site` | Canonical site URL (metadata, sitemap, OG) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Absolute API host (SSR + rewrite target fallback) |
| `API_REWRITE_TARGET` | same as `NEXT_PUBLIC_API_URL` | Next.js `/api` proxy upstream (Docker: `http://server:4000`) |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:4000/ws` | Browser → WebSocket |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | unset | Google Search Console HTML tag content |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION` | unset | Bing Webmaster `msvalidate.01` content |
| `NEXT_PUBLIC_YANDEX_VERIFICATION` | unset | Yandex site verification content |
| `BANTER_LLM_BASE_URL` | unset | Table banter LLM (e.g. `http://fungpt:8000`). Unset → template banter only |
| `BANTER_LLM_API_KEY` | unset | Bearer for table banter / FunGPT sidecar auth |
| `BANTER_LLM_MODEL` | unset | Table banter model id (FunGPT default: `banterbot`) |
| `BOT_CHAT_LLM_BASE_URL` | unset | Lobby `/chat` only (e.g. Cohere compatibility API). Falls back to `BANTER_LLM_BASE_URL` |
| `BOT_CHAT_LLM_API_KEY` | unset | Lobby `/chat` API key (falls back to `BANTER_LLM_API_KEY`) |
| `BOT_CHAT_MODEL` | unset | Lobby model id (Cohere default when `BOT_CHAT_LLM_BASE_URL` set: `command-r-plus-08-2024`) |
| `BOT_CHAT_LLM_PATH` | auto | `/chat/completions` for Cohere; else `/v1/chat/completions` |
| `BANTER_LLM_PATH` | `/v1/chat/completions` | Chat completions path |
| `BANTER_LLM_TIMEOUT_MS` | `8000` | Table-banter LLM timeout |
| `BOT_CHAT_TIMEOUT_MS` | `60000` | Lobby `/chat` LLM timeout |
| `BANTERBOT_WEIGHTS_ROOT` | `./apps/fungpt/weights` | Host dir mounted into sidecar (`BanterBot_1_8b-chat/` inside) |
| `BANTERBOT_WEIGHTS_DIR` | sidecar default path | Override checkpoint dir inside the sidecar process (Compose sets this) |

### Search consoles (external)

1. Verify ownership: set the env vars above (or DNS TXT) for [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters).
2. Submit sitemap: `https://pokr.site/sitemap.xml`
3. Spot-check structured data: [Rich Results Test](https://search.google.com/test/rich-results) on `/`
4. Spot-check social cards: paste `/` into an Open Graph debugger after deploy
5. `WEB_ORIGIN` may list extra CORS origins; `https://pokr.site` is always allowed. Browser HTTP uses same-origin `/api` (Next rewrite) so JOIN/POST is not blocked by CORS.

### Local Postgres

```bash
# Start Postgres 16 (optional Compose profile — not used by default `docker compose up`)
npm run db:up

# Copy env; for local docker DB use:
# DATABASE_URL=postgres://poker:poker@127.0.0.1:5432/poker
# Production / Oracle: Supabase Session pooler URI in `.env`
cp .env.example .env

# Server + web
npm run dev:server
npm run dev:web
```

Default local URL: `postgres://poker:poker@127.0.0.1:5432/poker`

With `DATABASE_URL` set the server uses Postgres for accounts, sessions/tickets, friends/groups, and hand history. Without it, those fall back to JSON files under `DATA_DIR`.

## Android

Open `apps/android` in Android Studio (JDK 17, SDK 35). Defaults point at production Render:

```bash
cd apps/android
./gradlew :app:assembleDebug
```

See [apps/android/README.md](apps/android/README.md).

## Deploy

GitHub Actions CI/CD deploys to the Oracle VM after green `main` builds (or via **Actions → Deploy → Run workflow**). See [docs/DEPLOY.md](docs/DEPLOY.md).

## Architecture notes

- Authoritative server: clients send action intents; hole cards are private per seat.
- Identity: unique username + password (argon2 hash), opaque session Bearer tokens for HTTP, short-lived WS tickets.
- Persistence: Postgres when `DATABASE_URL` is set (users, auth sessions/tickets, social, hand history); otherwise files under `DATA_DIR`.
- Action messages require `handId` + monotonic `actionSeq`.
- Turn timeouts auto-check or auto-fold.
- Contests are orchestrated in-memory by `TournamentManager` on top of cash `Room`s (no rebuy on knockout; Ready consensus between hands).
- See `apps/server/data/schema.sql` (written on boot) for Postgres DDL.
