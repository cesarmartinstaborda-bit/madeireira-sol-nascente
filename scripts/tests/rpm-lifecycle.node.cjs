const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
test('RPM outgoing postun is a no-op while a package version remains installed', () => {
  const script = readFileSync(path.join(__dirname, '../../packaging/rpm-after-remove.sh'), 'utf8');
  // Any cleanup call would fail this test; it must return before all side effects.
  const guards = 'function rm() { exit 91; }; function update-alternatives() { exit 92; }; function apparmor_parser() { exit 93; };\n';
  for (const count of ['1', '2']) execFileSync('bash', ['-c', guards + script, 'postun', count]);
  const pkg = require('../../package.json');
  assert.equal(pkg.build.rpm.afterRemove, 'packaging/rpm-after-remove.sh');
  assert.deepEqual(pkg.build.rpm.fpm.slice(-2), ['--rpm-posttrans', 'packaging/rpm-posttrans.sh']);
});
