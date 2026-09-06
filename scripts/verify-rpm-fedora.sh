#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rpm_path=$(realpath "${1:-$(node scripts/release.cjs path)}")
test "$(basename "$rpm_path")" = "$(basename "$(node scripts/release.cjs path)")"
node scripts/release.cjs verify "$(dirname "$rpm_path")"
expected_version=$(node -p "require('./package.json').version")
test -f "$rpm_path"
mkdir -p release/validation
container="madeireira-rpm-check-$$"
trap 'podman rm -f "$container" >/dev/null 2>&1 || true' EXIT
# Allow nested Chromium namespaces inside the container. The application itself
# runs unprivileged, with its sandbox enabled, on a disposable X11 display.
podman run --name "$container" --security-opt label=disable --security-opt seccomp=unconfined \
  -e EXPECTED_VERSION="$expected_version" \
  -v "$rpm_path:/tmp/app.rpm:ro" \
  -v "$PWD/scripts:/checks:ro" \
  -v "$PWD/release/validation:/evidence" \
  registry.fedoraproject.org/fedora:44 bash -euxo pipefail -c '
    dnf install -y --setopt=install_weak_deps=False /tmp/app.rpm
    test "$(rpm -q --queryformat "%{VERSION}-%{RELEASE}.%{ARCH}" madeireira-sol-nascente)" = "$EXPECTED_VERSION-1.x86_64"
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
    rpm -ql madeireira-sol-nascente > /evidence/installed-files.txt
    test -x /usr/bin/madeireira-sol-nascente
    test -f "/opt/Madeireira Sol Nascente/resources/app.asar"
    find /usr/share/icons -name "*madeireira*" -type f > /evidence/icons.txt
    test -s /evidence/icons.txt
    dnf check
    dnf remove -y madeireira-sol-nascente
    ! rpm -q madeireira-sol-nascente
    test ! -e /usr/bin/madeireira-sol-nascente
    test ! -e /usr/share/applications/madeireira-sol-nascente.desktop
    # FPM leaves unowned empty directories; require every payload file gone.
    if test -d "/opt/Madeireira Sol Nascente"; then
      find "/opt/Madeireira Sol Nascente" -mindepth 1 ! -type d > /evidence/removal-residue.txt
      test ! -s /evidence/removal-residue.txt
    fi
    while IFS= read -r icon; do test ! -e "$icon"; done < /evidence/icons.txt
    dnf check
    echo "PASS: RPM removal and dependency integrity"
  ' 2>&1 | tee release/validation/fedora-install-startup.log
