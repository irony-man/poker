#!/usr/bin/env bash
# Download BanterBot checkpoint into apps/fungpt/weights/ (Hugging Face + Git LFS).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEIGHTS="${ROOT}/apps/fungpt/weights"
mkdir -p "$WEIGHTS"
cd "$WEIGHTS"

DIR="BanterBot_1_8b-chat"
REPO="Alannikos768/BanterBot_1_8b-chat"

require_git_lfs() {
  if ! command -v git-lfs >/dev/null 2>&1; then
    echo "error: git-lfs is required (model weights are stored with Git LFS)." >&2
    echo "" >&2
    echo "  Ubuntu / Debian:" >&2
    echo "    sudo apt update && sudo apt install -y git-lfs" >&2
    echo "    git lfs install" >&2
    echo "" >&2
    echo "  Then re-run: ./scripts/download-banterbot-weights.sh" >&2
    exit 1
  fi
  git lfs install
}

# True when config exists and at least one weight file is real (not an LFS pointer).
weights_ready() {
  local dir="$1"
  [[ -f "$dir/config.json" ]] || return 1
  shopt -s nullglob
  local files=("$dir"/*.bin "$dir"/*.safetensors)
  shopt -u nullglob
  if (( ${#files[@]} == 0 )); then
    return 1
  fi
  local f size
  for f in "${files[@]}"; do
    size=$(wc -c <"$f" | tr -d ' ')
    if (( size > 1000000 )); then
      return 0
    fi
  done
  return 1
}

pull_lfs_weights() {
  if [[ ! -d "$DIR/.git" ]]; then
    echo "error: $WEIGHTS/$DIR is not a git clone — remove it and re-run this script." >&2
    exit 1
  fi
  echo "==> git lfs pull in $DIR"
  (cd "$DIR" && git lfs pull)
}

require_git_lfs

if weights_ready "$DIR"; then
  echo "Already present: $DIR"
  exit 0
fi

if [[ -d "$DIR" ]]; then
  echo "==> Fetching LFS objects for existing clone: $DIR"
  pull_lfs_weights
  if weights_ready "$DIR"; then
    echo "Done. Weights are in ${WEIGHTS}/${DIR}"
    exit 0
  fi
  echo "error: weights still missing after git lfs pull." >&2
  echo "  Ensure git-lfs is installed, then:" >&2
  echo "    cd ${WEIGHTS}/${DIR} && git lfs pull" >&2
  echo "  Or remove ${WEIGHTS}/${DIR} and re-run this script." >&2
  exit 1
fi

echo "==> git clone https://huggingface.co/${REPO}"
git clone "https://huggingface.co/${REPO}" "$DIR"
pull_lfs_weights

if ! weights_ready "$DIR"; then
  echo "error: clone finished but weight files look incomplete (LFS not pulled?)." >&2
  exit 1
fi

echo "Done. Weights are in ${WEIGHTS}/${DIR}"
