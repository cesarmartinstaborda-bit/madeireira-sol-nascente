// Isolated renderer regression capture: all HTTP(S) is blocked before loading.
// Usage: node_modules/.bin/electron scripts/verify-ui-regression.cjs OUTPUT [DIST]
const { app, BrowserWindow, session } = require('electron');
const { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { tmpdir } = require('node:os');
const assert = require('node:assert/strict');
const ts = require('typescript');
const output = resolve(process.argv[2]);
const dist = resolve(process.argv[3] || 'dist');
const profile = mkdtempSync(join(tmpdir(), 'madeireira-ui-regression-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('ozone-platform', 'x11');
app.commandLine.appendSwitch('gtk-version', '3');
const deadline = setTimeout(() => { console.error('UI capture timed out'); app.exit(1); }, 60000);
const fixtureModule = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync(resolve('src/__tests__/fixtures/regressionDatabase.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(fixtureModule.exports);
const database = fixtureModule.exports.regressionDatabase();
const delay = ms => new Promise(r => setTimeout(r, ms));
let win;
app.whenReady().then(async () => {
  mkdirSync(output, { recursive: true });
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
  win = new BrowserWindow({ width: 1440, height: 1100, show: false, webPreferences: { offscreen: true, contextIsolation: true, sandbox: true } });
  await win.loadURL('about:blank');
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Page.enable');
  await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `
    const OriginalDate = Date;
    window.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : ['2026-09-06T12:00:00Z'])); } static now() { return 1788696000000; } };
    localStorage.clear();
    localStorage.setItem('klabin_base_app_database_v1', ${JSON.stringify(JSON.stringify(database))});
  ` });
  const exceptions = [];
  win.webContents.debugger.on('message', (_event, method, params) => { if (method === 'Runtime.exceptionThrown') exceptions.push(params); });
  await win.webContents.debugger.sendCommand('Runtime.enable');
  await win.loadFile(join(dist, 'index.html'));
  console.log('Renderer loaded');
  await win.webContents.insertCSS('*,*::before,*::after { animation: none !important; transition: none !important; caret-color: transparent !important; }');
  const evaluate = code => win.webContents.executeJavaScript(code);
  for (let i = 0; i < 100; i++) { if (await evaluate("document.body.innerText.includes('Últimas Movimentações Operacionais')")) break; await delay(100); }
  const captures = [];
  async function capture(name) {
    console.log('Capture', name);
    await delay(100);
    await evaluate('document.activeElement?.blur(); document.querySelector("main").parentElement.scrollTop = 0');
    const { data } = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(output, `${name}.png`), Buffer.from(data, 'base64'));
    captures.push(name);
  }
  async function click(text, selector = 'main', exact = false) {
    const result = await evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector + ' button')})].find(b => ${exact ? 'b.textContent.trim() === ' : 'b.textContent.includes('}${JSON.stringify(text)}${exact ? '' : ')'}); if (!b) return false; b.click(); return true; })()`);
    assert.ok(result, `Missing button: ${text}`);
  }
  await capture('01-dashboard');
  await click('Klabin', 'aside'); await capture('02-cargas');
  await click('Depósitos Klabin'); await capture('03-depositos');
  await click('Clientes & Produtos', 'aside'); await capture('04-vendas');
  await click('Nova Venda'); await capture('05-modal-venda');
  await click('Cancelar', 'body', true);
  await click('Cadastro de Clientes'); await capture('06-clientes');
  await click('Catálogo de Produtos'); await capture('07-produtos');
  await click('Gestão de Motoristas', 'aside'); await capture('08-motoristas');
  await click('Configurações e Ajustes', 'aside'); await capture('09-empresa');
  for (const [i, tab] of ['Klabin', 'Fretes', 'Ciclos', 'Dados & Backup', 'Google Drive', 'Aplicativo'].entries()) {
    await click(tab, 'main', true); await capture(`${10 + i}-config-${i}`);
  }
  assert.deepEqual(exceptions, [], 'Renderer exceptions');
  writeFileSync(join(output, 'report.json'), JSON.stringify({ captures, exceptions, network: 'blocked', profile: 'temporary' }, null, 2));
  console.log(`PASS: ${captures.length} isolated UI captures, no renderer exceptions.`);
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { clearTimeout(deadline); win?.destroy(); rmSync(profile, { recursive: true, force: true }); app.exit(process.exitCode || 0); });
app.on('quit', () => rmSync(profile, { recursive: true, force: true }));
