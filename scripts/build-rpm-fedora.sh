#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
podman build -t localhost/madeireira-rpm-builder -f packaging/Containerfile packaging
# Private node_modules volume avoids replacing dependencies installed on the host.
# Disable container labels for this bind mount without relabeling the checkout.
podman run --rm --security-opt label=disable \
  -v "$PWD:/work" -v madeireira-rpm-node-modules:/work/node_modules \
  localhost/madeireira-rpm-builder \
  bash -c 'npm ci && npm run lint && npm test && npm run dist:rpm'
