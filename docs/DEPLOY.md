# Deploy (Oracle VM)

CI runs on every PR/push to `main` (install → build → test).

CD deploys to the Oracle Ubuntu VM on every push to `main` (and manual **Actions → Deploy → Run workflow**): SSH in, `git reset --hard origin/main`, then [`scripts/deploy-vm.sh`](../scripts/deploy-vm.sh) (`docker compose up -d --build` + health checks).

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
