#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
tools_dir="$root/release/closure/firebase-tools"
emulator_dir="$root/release/closure/firebase-emulator"
mkdir -p "$tools_dir" "$emulator_dir"
# Test-only tools never enter package.json, the runtime dependencies or the RPM.
if ! test -x "$tools_dir/node_modules/.bin/firebase"; then
  npm install --prefix "$tools_dir" --no-save --package-lock=false \
    firebase-tools@15.29.0 @firebase/rules-unit-testing@5.0.2 firebase@12.18.0
fi
cp firestore.rules "$emulator_dir/firestore.rules"
node - "$emulator_dir" <<'JS'
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
fs.writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify({
  // CLI emulator 15.29 does not load rules for multiple/named databases.
  // Test the same ruleset on the demo default database; never use production.
  firestore: { rules: 'firestore.rules' },
  emulators: { firestore: { host: '127.0.0.1', port: 18080 }, ui: { enabled: false }, singleProjectMode: true },
}));
JS
export NODE_PATH="$tools_dir/node_modules"
export FIREBASE_CLI_DISABLE_UPDATE_CHECK=true
# Never infer the real project from .firebaserc or use real credentials.
unset FIREBASE_TOKEN GOOGLE_APPLICATION_CREDENTIALS
cd "$emulator_dir"
"$tools_dir/node_modules/.bin/firebase" --config firebase.json --project demo-madeireira-closure \
  emulators:exec --only firestore "node --test '$root/scripts/firebase/firestore.rules.node.cjs'"
