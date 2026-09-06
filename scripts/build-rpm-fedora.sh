#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
podman build -t localhost/madeireira-rpm-builder -f packaging/Containerfile packaging
# Anonymous node_modules volume isolates concurrent builds and host dependencies.
# Disable container labels for this bind mount without relabeling the checkout.
# A linked worktree points to Git metadata outside the checkout. Mount only
# that metadata read-only and keep the actual worktree at its host path.
git_common=$(git rev-parse --path-format=absolute --git-common-dir)
podman run --rm --security-opt label=disable \
  -v "$PWD:$PWD" -w "$PWD" -v "$PWD/node_modules" \
  -v "$git_common:$git_common:ro" -e GIT_OPTIONAL_LOCKS=0 \
  -v madeireira-electron-cache:/root/.cache/electron \
  localhost/madeireira-rpm-builder \
  bash -c 'npm ci && npm run version:check && npm run lint && npm test && npm run dist:rpm'
