const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { releaseInfo, validateRpm, validateSource, verifyAssets, sha256 } = require('../release.cjs');
const pkg = { name: 'madeireira-sol-nascente', version: '1.2.3', devDependencies: { electron: '44.2.0' } };
const lock = { version: pkg.version, packages: { '': { version: pkg.version }, 'node_modules/electron': { version: '44.2.0' } } };
test('stable SemVer synchronizes tag, artifact and runtime; rejects unsupported versions', () => {
  const info = releaseInfo(pkg, lock, 'v1.2.3');
  assert.equal(info.artifact, 'Madeireira-Sol-Nascente-1.2.3-x86_64.rpm');
  for (const version of ['01.2.3', '1.2', 'v1.2.3', '1.2.3-rc.1', '1.2.3+build', '../1.2.3']) {
    assert.throws(() => releaseInfo({ ...pkg, version }, lock));
  }
});
test('rejects mismatched tag, either lockfile version and Electron drift', () => {
  assert.throws(() => releaseInfo(pkg, lock, 'v1.2.4'));
  assert.throws(() => releaseInfo(pkg, { ...lock, version: '1.2.4' }));
  assert.throws(() => releaseInfo(pkg, { ...lock, packages: { ...lock.packages, '': { version: '1.2.4' } } }));
  assert.throws(() => releaseInfo({ ...pkg, devDependencies: { electron: '^44.2.0' } }, lock));
  assert.throws(() => releaseInfo(pkg, { ...lock, packages: { ...lock.packages, 'node_modules/electron': { version: '44.3.0' } } }));
});
test('rejects wrong RPM identity, architecture, version or release', () => {
  const info = releaseInfo(pkg, lock);
  const rpm = { name: info.name, version: info.version, release: '1', arch: info.arch };
  validateRpm(info, rpm);
  for (const key of Object.keys(rpm)) assert.throws(() => validateRpm(info, { ...rpm, [key]: 'wrong' }));
});
test('release integrity gate rejects tampered RPM, checksums and stale metadata', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sol-release-test-'));
  try {
    const info = releaseInfo(pkg, lock);
    const file = join(dir, info.artifact);
    writeFileSync(file, 'rpm fixture');
    const hash = sha256(file);
    const manifest = { ...info, rpm: { name: info.name, version: info.version, release: '1', arch: info.arch }, sha256: hash };
    const save = value => writeFileSync(join(dir, 'release.json'), JSON.stringify(value));
    const sums = `${hash}  ${info.artifact}\n`;
    save(manifest); writeFileSync(join(dir, 'SHA256SUMS'), sums);
    assert.deepEqual(verifyAssets(dir, info), manifest);
    writeFileSync(file, 'tampered'); assert.throws(() => verifyAssets(dir, info), /Checksum/);
    writeFileSync(file, 'rpm fixture');
    writeFileSync(join(dir, 'SHA256SUMS'), sums + 'extra entry'); assert.throws(() => verifyAssets(dir, info), /SHA256SUMS/);
    writeFileSync(join(dir, 'SHA256SUMS'), sums);
    save({ ...manifest, version: '0.0.1' }); assert.throws(() => verifyAssets(dir, info), /Manifesto/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('publication requires a clean checkout and the exact tag commit', () => {
  const commit = 'a'.repeat(40);
  validateSource({ commit, dirty: false }, commit);
  assert.throws(() => validateSource({ commit, dirty: true }, commit), /limpo/);
  assert.throws(() => validateSource({ commit, dirty: false }, 'b'.repeat(40)), /Commit/);
  assert.throws(() => validateSource({ commit, dirty: false }, undefined), /Commit/);
});
