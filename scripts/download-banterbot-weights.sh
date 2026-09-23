#!/usr/bin/env bash
# Download BanterBot checkpoint into apps/fungpt/weights/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEIGHTS="${ROOT}/apps/fungpt/weights"
mkdir -p "$WEIGHTS"
cd "$WEIGHTS"

if command -v git-lfs >/dev/null 2>&1; then
  git lfs install
fi

DIR="BanterBot_1_8b-chat"
REPO="Alannikos768/BanterBot_1_8b-chat"

if [[ -f "$DIR/config.json" ]]; then
  echo "Already present: $DIR"
  exit 0
fi
if [[ -d "$DIR" ]]; then
  echo "Directory exists but incomplete: $DIR — remove it and re-run." >&2
  exit 1
fi

git clone "https://huggingface.co/${REPO}" "$DIR"
echo "Done. Weights are in ${WEIGHTS}/${DIR}"
