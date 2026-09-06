#!/bin/bash
set -e
# Older RPMs remove their alternative during postun, after the new postinstall.
# Restore the entry only after all outgoing scriptlets have finished.
if [ -x '/opt/Madeireira Sol Nascente/madeireira-sol-nascente' ]; then
  if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --install '/usr/bin/madeireira-sol-nascente' \
      'madeireira-sol-nascente' '/opt/Madeireira Sol Nascente/madeireira-sol-nascente' 100
  else
    ln -sf '/opt/Madeireira Sol Nascente/madeireira-sol-nascente' '/usr/bin/madeireira-sol-nascente'
  fi
fi
