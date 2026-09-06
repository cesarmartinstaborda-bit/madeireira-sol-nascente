// Release policy and metadata only. Backup/data schema versions are independent.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function assert(condition, message) { if (!condition) throw new Error(message); }
function releaseInfo(pkg, lock, tag) {
  // Stable SemVer lane: no ambiguous prerelease/build-metadata to RPM EVR mapping.
  assert(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pkg.version), 'Use SemVer estável MAJOR.MINOR.PATCH, sem zeros iniciais, pré-release ou +metadata.');
  assert(lock.version === pkg.version && lock.packages[''].version === pkg.version, 'package-lock.json diverge da versão do package.json.');
  assert(pkg.devDependencies.electron === '44.2.0' && lock.packages['node_modules/electron'].version === '44.2.0', 'Electron deve permanecer em 44.2.0.');
  assert(!tag || tag === `v${pkg.version}`, 'Tag deve corresponder exatamente a v + package.json.version.');
  return { version: pkg.version, tag: `v${pkg.version}`, name: pkg.name, electron: pkg.devDependencies.electron,
    arch: 'x86_64', artifact: `Madeireira-Sol-Nascente-${pkg.version}-x86_64.rpm` };
}
function info(tag) { return releaseInfo(read(path.join(root, 'package.json')), read(path.join(root, 'package-lock.json')), tag); }
function rpmInfo(file) {
  const [name, version, release, arch] = execFileSync('rpm', ['-qp', '--queryformat', '%{NAME}\n%{VERSION}\n%{RELEASE}\n%{ARCH}', file], { encoding: 'utf8' }).trim().split('\n');
  return { name, version, release, arch };
}
function validateRpm(expected, actual) {
  for (const field of ['name', 'version', 'arch']) assert(actual[field] === expected[field], `RPM ${field} divergente: ${actual[field]}`);
  assert(actual.release === '1', 'RPM Release deve ser 1; publique alterações com uma nova versão SemVer.');
}
function verifyAssets(dir, expected) {
  const manifest = read(path.join(dir, 'release.json'));
  for (const field of ['version', 'tag', 'name', 'electron', 'arch', 'artifact']) assert(manifest[field] === expected[field], `Manifesto ${field} divergente.`);
  validateRpm(expected, manifest.rpm);
  const hash = sha256(path.join(dir, expected.artifact));
  assert(manifest.sha256 === hash, 'Checksum do RPM divergente.');
  assert(fs.readFileSync(path.join(dir, 'SHA256SUMS'), 'utf8') === `${hash}  ${expected.artifact}\n`, 'SHA256SUMS divergente.');
  return manifest;
}
function validateSource(manifest, commit) {
  assert(manifest.dirty === false, 'Release exige checkout limpo.');
  assert(/^[a-f0-9]{40}$/.test(commit || '') && manifest.commit === commit, 'Commit do artefato diverge do commit da tag.');
}
function main() {
  const command = process.argv[2] || 'check';
  const expected = info(process.env.RELEASE_TAG);
  const dir = command === 'verify' && process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'release');
  if (command === 'check') console.log(JSON.stringify(expected));
  else if (command === 'path') console.log(path.join(dir, expected.artifact));
  else if (command === 'metadata') {
    const file = path.join(dir, expected.artifact);
    const rpm = rpmInfo(file);
    validateRpm(expected, rpm);
    const { extractFile } = require('@electron/asar');
    const packaged = JSON.parse(extractFile(path.join(dir, 'linux-unpacked/resources/app.asar'), 'package.json').toString());
    assert(packaged.version === expected.version && packaged.name === expected.name, 'Versão/nome do aplicativo empacotado diverge.');
    const manifest = { ...expected, rpm, sha256: sha256(file),
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim() };
    fs.writeFileSync(path.join(dir, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'SHA256SUMS'), `${manifest.sha256}  ${expected.artifact}\n`);
    verifyAssets(dir, expected);
    console.log(JSON.stringify(manifest, null, 2));
  } else if (command === 'verify') {
    const manifest = verifyAssets(dir, expected);
    if (process.env.RELEASE_TAG) {
      validateSource(manifest, process.env.GITHUB_SHA);
    }
    console.log(`PASS: ${expected.tag}, metadados e SHA-256.`);
  } else throw new Error(`Comando desconhecido: ${command}`);
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { info, releaseInfo, validateRpm, validateSource, verifyAssets, sha256 };
