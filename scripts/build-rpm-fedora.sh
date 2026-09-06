#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
podman build -t localhost/madeireira-rpm-builder -f packaging/Containerfile packaging
# Anonymous node_modules volume isolates concurrent builds and host dependencies.
# Disable container labels for this bind mount without relabeling the checkout.
podman run --rm --security-opt label=disable \
  -v "$PWD:/work" -v /work/node_modules \
  -v madeireira-electron-cache:/root/.cache/electron \
  localhost/madeireira-rpm-builder \
  bash -c 'npm ci && npm run version:check && npm run lint && npm test && npm run dist:rpm'
