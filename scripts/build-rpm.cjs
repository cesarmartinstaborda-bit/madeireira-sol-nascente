const { spawnSync } = require('node:child_process');
const { rmSync } = require('node:fs');
const { join } = require('node:path');
process.chdir(join(__dirname, '..'));
if (process.argv.length > 2) throw new Error('O build oficial aceita somente RPM x86_64, sem argumentos extras.');
const expected = require('./release.cjs').info(process.env.RELEASE_TAG);

// FPM 1.9 bundled with electron-builder 25 ignores the build root on RPM 6.
// Use FPM 1.18+ explicitly, including on older build hosts, for consistent RPMs.
function fail(message) {
  console.error(message);
  process.exit(1);
}
const rpm = spawnSync('rpmbuild', ['--version'], { encoding: 'utf8' });
const fpm = spawnSync('fpm', ['--version'], { encoding: 'utf8' });
const version = fpm.stdout?.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
if (rpm.status !== 0 || fpm.status !== 0 || !version ||
    Number(version[1]) < 1 || (Number(version[1]) === 1 && Number(version[2]) < 18)) {
  fail('O build RPM requer rpm-build e FPM >= 1.18.0. Consulte README.md ou execute npm run dist:rpm:fedora (Podman).');
}
// Remove only current-version outputs so stale assets cannot pass a failed build.
const artifact = expected.artifact;
for (const file of [artifact, 'SHA256SUMS', 'release.json']) rmSync(join('release', file), { force: true });
const result = spawnSync(process.execPath, [require.resolve('electron-builder/cli.js'), '--linux', 'rpm', '--x64', '--publish', 'never'], {
  stdio: 'inherit',
  env: { ...process.env, USE_SYSTEM_FPM: 'true' },
});
if (result.error) fail(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
const metadata = spawnSync(process.execPath, ['scripts/release.cjs', 'metadata'], { stdio: 'inherit' });
process.exit(metadata.status ?? 1);
