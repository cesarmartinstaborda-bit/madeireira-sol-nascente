#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rpm_path=$(realpath "${1:-release/Madeireira-Sol-Nascente-1.0.0-x86_64.rpm}")
test -f "$rpm_path"
mkdir -p release/validation
container="madeireira-rpm-check-$$"
trap 'podman rm -f "$container" >/dev/null 2>&1 || true' EXIT
# Allow nested Chromium namespaces inside the container. The application itself
# runs unprivileged, with its sandbox enabled, on a disposable X11 display.
podman run --name "$container" --security-opt label=disable --security-opt seccomp=unconfined \
  -v "$rpm_path:/tmp/app.rpm:ro" \
  -v "$PWD/scripts:/checks:ro" \
  -v "$PWD/release/validation:/evidence" \
  registry.fedoraproject.org/fedora:44 bash -euxo pipefail -c '
    dnf install -y --setopt=install_weak_deps=False /tmp/app.rpm
    rpm -q madeireira-sol-nascente
    rpm -qR madeireira-sol-nascente > /evidence/requires.txt
    ldd "/opt/Madeireira Sol Nascente/madeireira-sol-nascente" > /evidence/ldd.txt
    if grep -q "not found" /evidence/ldd.txt; then cat /evidence/ldd.txt; exit 1; fi
    dnf install -y --setopt=install_weak_deps=False xorg-x11-server-Xvfb nodejs22 dbus-daemon util-linux shadow-utils desktop-file-utils google-noto-sans-fonts
    desktop-file-validate /usr/share/applications/madeireira-sol-nascente.desktop
    useradd -m smoke
    Xvfb :99 -screen 0 1280x800x24 -nolisten tcp > /tmp/xvfb.log 2>&1 &
    for attempt in {1..50}; do test -S /tmp/.X11-unix/X99 && break; sleep 0.1; done
    test -S /tmp/.X11-unix/X99
    runuser -u smoke -- env DISPLAY=:99 dbus-run-session -- node /checks/smoke-installed-rpm.cjs
    cp /tmp/madeireira-rpm-smoke.png /tmp/madeireira-rpm-smoke.json /evidence/
    rpm -V madeireira-sol-nascente
  ' 2>&1 | tee release/validation/fedora-install-startup.log
