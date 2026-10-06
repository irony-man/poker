# Deploy (Oracle VM)

CI runs on every PR/push to `main` (install → build → test).

CD deploys to the Oracle Ubuntu VM after a **green CI run on `main`**, and any time you manually run **Actions → Deploy → Run workflow**: SSH in, `git reset --hard origin/main`, then [`scripts/deploy-vm.sh`](../scripts/deploy-vm.sh) (`docker compose up -d --build` + health checks).

| Trigger | How |
| --- | --- |
| Automatic | Push to `main` → CI `Build & test` succeeds → `Deploy` job |
| Manual | GitHub → **Actions** → **Deploy** → **Run workflow** |

## One-time GitHub secrets

Repo → **Settings → Secrets and variables → Actions** (and optionally bind them to environment **production**):

| Secret | Example | Purpose |
| --- | --- | --- |
| `DEPLOY_HOST` | `92.4.81.192` | VM public IP |
| `DEPLOY_USER` | `ubuntu` | SSH user |
| `DEPLOY_SSH_KEY` | full private key PEM | Deploy key (see below) |
| `DEPLOY_PORT` | `22` | Optional; defaults to 22 |
| `DEPLOY_PATH` | `/home/ubuntu/poker` | Optional; defaults to `~/poker` |

Create environment **production** under **Settings → Environments** if you want approval gates.

## One-time VM setup

```bash
# SSH as ubuntu
ssh ubuntu@YOUR_IP

# App clone (once)
git clone git@github.com:irony-man/poker.git ~/poker
# or HTTPS if you prefer; Actions uses git fetch with the host's credentials

cd ~/poker
cp .env.example .env
nano .env   # DATABASE_URL=Supabase Session pooler, NEXT_PUBLIC_*=https://pokr.site, wss://…

# Docker (if not installed)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# log out/in

# Deploy key: allow the VM to git fetch (read-only deploy key on the repo)
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ''
cat ~/.ssh/github_deploy.pub
# GitHub → repo → Settings → Deploy keys → Add (read-only)

cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF

# CI deploy key: allow GitHub Actions to SSH into the VM
# On your laptop:
#   ssh-keygen -t ed25519 -f deploy_ci -N '' -C 'github-actions-deploy'
# Put deploy_ci.pub into VM ~/.ssh/authorized_keys
# Put deploy_ci private key contents into GitHub secret DEPLOY_SSH_KEY

chmod +x ~/poker/scripts/deploy-vm.sh
~/poker/scripts/deploy-vm.sh
```

Caddy / DNS / OCI ports **80 + 443** stay as documented in chat (not managed by this workflow).

## Manual deploy

```bash
cd ~/poker
git pull origin main
./scripts/deploy-vm.sh
```

## Notes

- `.env` stays on the VM only (gitignored). Never commit secrets.
- `NEXT_PUBLIC_*` are baked at **image build**; change them in VM `.env`, then redeploy with `--build`.
- `API_REWRITE_TARGET=http://server:4000` must stay set so Next `/api` does not loop on `https://pokr.site`.

## Bot chat / LLM on the VM

Default deploy (Nest + Next) does **not** start FunGPT. To enable lobby `/chat` and LLM table banter:

1. **Hosted API (recommended on Oracle CPU):** set in `~/poker/.env`:

```bash
BANTER_LLM_BASE_URL=https://api.openai.com
BANTER_LLM_API_KEY=sk-...
BANTER_LLM_MODEL=gpt-4o-mini
BOT_CHAT_MODEL=gpt-4o-mini
```

Then `docker compose up -d` (or `./scripts/deploy-vm.sh`). No web rebuild.

2. **Cohere lobby chat + FunGPT table banter** (typical CPU VM):

```bash
BOT_CHAT_LLM_BASE_URL=https://api.cohere.ai/compatibility/v1
BOT_CHAT_LLM_API_KEY=your-cohere-key
BOT_CHAT_MODEL=command-r-plus-08-2024

BANTER_LLM_BASE_URL=http://fungpt:8000
BANTER_LLM_MODEL=banterbot
BANTER_LLM_TIMEOUT_MS=20000
docker compose up -d
docker compose --profile fungpt up -d --build
```

3. **BanterBot sidecar only** (download weights once; GPU strongly preferred):

```bash
sudo apt update && sudo apt install -y git-lfs
git lfs install
./scripts/download-banterbot-weights.sh
BANTER_LLM_BASE_URL=http://fungpt:8000
BANTER_LLM_MODEL=banterbot
docker compose --profile fungpt up -d --build
```

If the LLM is down, table bots fall back to templates; `/chat` returns 503.
## Google sign-in

1. Google Cloud Console → **APIs & Services → OAuth consent screen**: configure the app (External, scopes `openid email profile`), then publish it.
2. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://pokr.site`, `https://www.pokr.site`, `http://localhost:3000`
   - No redirect URIs are needed (the web app uses the Google Identity Services popup).
3. Set both `GOOGLE_CLIENT_ID=<web client id>.apps.googleusercontent.com` (the server verifies ID tokens against it) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same id>` (baked into the web build to show the button) in `~/poker/.env`, then redeploy with `--build`.
4. **Android:** create a second OAuth client of type **Android** with package `com.pokr.android` and the SHA-1 of each signing key (`./gradlew signingReport` for debug; Play Console → App integrity for release). The app still asks for tokens with the *web* client id, set as `pokr.google.client.id` in `apps/android/local.properties`; without it the Google button is hidden.

Multiple accepted audiences can be given as a comma-separated `GOOGLE_CLIENT_ID`; clients use the web client id.

## Instagram sign-in

Instagram only offers OAuth for **professional** (Business or Creator) accounts via [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/). Personal accounts cannot sign in.

1. Meta Developer Dashboard → create a **Business** type app → add the **Instagram** product → **API setup with Instagram login**.
2. Valid OAuth redirect URIs (exact match, HTTPS required — Instagram rejects `http://localhost`):
   - Production: `https://pokr.site/auth/instagram/callback`
   - Local: `https://localhost:3001/auth/instagram/callback` (run the web app with `next dev --experimental-https`)
   Add them under **App Dashboard → Instagram → API setup with Instagram login → Set up Instagram business login → OAuth redirect URIs**. A URI listed only under Facebook Login will not work.
3. Set in `~/poker/.env`:

```bash
INSTAGRAM_APP_ID=<instagram app id>
INSTAGRAM_APP_SECRET=<instagram app secret>
# Optional; defaults to $PUBLIC_WEB_URL/auth/instagram/callback
# INSTAGRAM_REDIRECT_URI=https://pokr.site/auth/instagram/callback
```

Local Instagram login needs HTTPS. Use `https://localhost:<web-port>/auth/instagram/callback` as `INSTAGRAM_REDIRECT_URI` and start Next with `--experimental-https`.

The web app only shows the Instagram button when `NEXT_PUBLIC_INSTAGRAM_ENABLED=true` is set at build time (redeploy with `--build` after changing it).

## Recovery email (SMTP)

Players can add an email on their profile; once confirmed it is used for "Forgot password?" resets and for linking Google accounts. Set in `~/poker/.env`:

```bash
SMTP_HOST=smtppro.zoho.com      # Zoho Mail (smtp.zoho.com for free plans; .in / .eu by region)
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@pokr.site
SMTP_PASS=<Zoho app-specific password>
SMTP_FROM="Pokr <no-reply@pokr.site>"
PUBLIC_WEB_URL=https://pokr.site
```

With `SMTP_HOST` unset, verification and reset links are written to the server log instead of being emailed (useful in dev).
