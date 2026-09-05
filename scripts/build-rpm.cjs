const { spawnSync } = require('node:child_process');

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
const result = spawnSync(process.execPath, [require.resolve('electron-builder/cli.js'), '--linux', 'rpm', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, USE_SYSTEM_FPM: 'true' },
});
if (result.error) fail(result.error.message);
process.exit(result.status ?? 1);
