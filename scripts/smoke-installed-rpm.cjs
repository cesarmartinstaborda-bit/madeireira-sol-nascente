// Run as an unprivileged user in Fedora, with DISPLAY pointing at Xvfb.
// Uses a fresh profile and never signs in or changes the user's real database.
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), 'madeireira-rpm-smoke-'));
const app = spawn('/usr/bin/madeireira-sol-nascente', [
  `--user-data-dir=${profile}`, '--remote-debugging-port=9222',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
], { stdio: ['ignore', 'inherit', 'inherit'] });
let socket;
const deadline = setTimeout(() => { app.kill(); process.exit(1); }, 60000);
(async () => {
  let page;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (app.exitCode !== null) throw new Error(`Electron exited: ${app.exitCode}`);
    try {
      const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
      page = pages.find(item => item.type === 'page' && item.url.startsWith('file:'));
      if (page) break;
    } catch { /* Wait for the debugger to start. */ }
    await delay(200);
  }
  assert.ok(page, 'Installed Electron window did not open');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params);
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
  await send('Page.reload', { ignoreCache: true });
  let state;
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await send('Runtime.evaluate', {
      expression: `JSON.stringify({url:location.href,title:document.title,rootChildren:document.querySelector('#root')?.children.length,text:document.body.innerText,electron:window.electron?.isElectron,bridge:Object.keys(window.electron||{}),images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)})`,
      returnByValue: true,
    });
    state = result.result.value && JSON.parse(result.result.value);
    if (state?.electron && state.rootChildren && state.text.includes('Painel Consolidado') && state.images) break;
    await delay(200);
  }
  assert.ok(state.url.includes('/opt/Madeireira%20Sol%20Nascente/resources/app.asar/dist/index.html'), state.url);
  assert.ok(state.rootChildren > 0, 'React did not render');
  assert.match(state.text, /Painel Consolidado/);
  assert.equal(state.electron, true, 'Preload bridge did not load');
  assert.ok(state.bridge.includes('googleSignIn') && state.bridge.includes('googleRestoreSession'));
  assert.equal(state.images, true, 'An image failed to load');
  const runtime = await send('Runtime.evaluate', {
    expression: `JSON.stringify({userAgent:navigator.userAgent,nodeExposed:typeof require!=='undefined'||typeof process!=='undefined'})`,
    returnByValue: true,
  });
  state.runtime = JSON.parse(runtime.result.value);
  assert.match(state.runtime.userAgent, /Electron\/44\.2\.0\b/);
  assert.equal(state.runtime.nodeExposed, false, 'Node leaked into the renderer');
  const session = await send('Runtime.evaluate', {
    expression: 'window.electron.googleRestoreSession()',
    awaitPromise: true, returnByValue: true,
  });
  assert.equal(session.exceptionDetails, undefined, 'Session IPC failed');
  assert.equal(session.result.value, null, 'Fresh profile unexpectedly has a session');
  const navigation = [];
  async function visit(selector, label, expected, exact = false) {
    const result = await send('Runtime.evaluate', {
      expression: `(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector + ' button')})].find(b => ${exact ? 'b.textContent.trim() === ' : 'b.textContent.includes('}${JSON.stringify(label)}${exact ? '' : ')'}); if (!button) return false; button.click(); return true; })()`,
      returnByValue: true,
    });
    assert.equal(result.result.value, true, `Missing navigation: ${label}`);
    let text;
    for (let attempt = 0; attempt < 30; attempt++) {
      const content = await send('Runtime.evaluate', { expression: 'document.querySelector("main").innerText', returnByValue: true });
      text = content.result.value;
      if (text.includes(expected)) break;
      await delay(100);
    }
    assert.ok(text.includes(expected), `Screen did not update: ${label}`);
    navigation.push(label);
  }
  // React controls the inputs: set the value through the native setter and fire the event.
  async function fill(selector, value) {
    const result = await send('Runtime.evaluate', {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false;
        const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); return true; })()`,
      returnByValue: true,
    });
    assert.equal(result.result.value, true, `Missing field: ${selector}`);
  }
  async function evaluate(expression) {
    return (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
  }
  await visit('aside', 'Klabin', 'Registro de Cargas');
  await visit('main', 'Depósitos Klabin', 'Novo Depósito');
  // Pro Cabos is hidden from the sidebar (PRO_CABOS_TAB_VISIBLE = false).
  assert.equal(await evaluate(`[...document.querySelectorAll('aside button')].some(b => b.textContent.includes('Pro Cabos'))`), false, 'Pro Cabos should be hidden');
  // Mão de Obra: right below Klabin; register 1.500 t of a R$ 150,00/t product, then settle it (fresh profile only).
  assert.match(await evaluate(`[...document.querySelectorAll('aside button')].map(b => b.textContent).join('|')`), /Klabin[^|]*\|Mão de Obra/);
  await visit('aside', 'Mão de Obra', 'Lançamentos Pendentes');
  await visit('main', 'Cadastro', 'Nome do produto', true);
  await fill('#mob-cad-produto', 'Produto de verificação');
  await fill('#mob-cad-preco', '150,00');
  await visit('main', 'Adicionar produto', 'Produto de verificação', true);
  await visit('main', 'Principal (0)', 'Lançamentos Pendentes', true);
  const productId = await evaluate(`[...document.querySelectorAll('#mob-produto-novo option')].find(o => o.textContent === 'Produto de verificação')?.value`);
  assert.ok(productId, 'Registered product is not selectable');
  await fill('#mob-produto-novo', productId);
  await fill('#mob-tons-novo', '1.500');
  assert.equal(await evaluate(`document.querySelector('#mob-valor-novo').value`), '225.000,00', 'Automatic value per ton');
  await visit('main', 'Lançar', 'Lançamentos Pendentes (1)', true);
  assert.match(await evaluate(`document.querySelector('main tbody').innerText.replace(/\\s+/g, ' ')`), /1\.500,00 .*R\$ 225\.000,00/);
  await visit('main', 'Quitar', 'Lançamentos Pendentes (0)', true);
  await visit('main', 'Quitados (1)', 'Lançamentos Quitados (1)', true);
  await visit('main', 'Reverter', 'Lançamentos Quitados (0)', true);
  await visit('aside', 'Clientes & Produtos', 'Lançamento de Vendas Diretas');
  await visit('main', 'Catálogo de Produtos', 'Novo Produto');
  await visit('aside', 'Gestão de Motoristas', 'Contas de Frete por Motorista');
  await visit('main', 'Fretes Quitados', 'Fretes Quitados');
  await visit('main', 'Cadastro de Motoristas', 'Cadastrar Motorista');
  await visit('aside', 'Configurações e Ajustes', 'Identidade Visual da Empresa');
  for (const [label, expected] of [
    ['Klabin', 'Saldo'], ['Fretes', 'Fretes'], ['Ciclos', 'Ciclo'],
    ['Dados & Backup', 'Criar backup agora'], ['Google Drive', 'Conectar Google Drive'],
    ['Aplicativo', 'Aplicativo'],
  ]) await visit('main', label, expected, true);
  await visit('aside', 'Klabin', 'Novo Depósito');
  await visit('aside', 'Clientes & Produtos', 'Lançamento de Vendas Diretas');
  await visit('aside', 'Painel Consolidado', 'Últimas Movimentações Operacionais');
  state.navigation = navigation;
  state.network = 'blocked';
  assert.deepEqual(exceptions, [], 'Renderer threw an exception');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/madeireira-rpm-smoke.png', Buffer.from(screenshot.data, 'base64'));
  writeFileSync('/tmp/madeireira-rpm-smoke.json', JSON.stringify({ ...state, exceptions, sandboxDisabled: false }, null, 2));
  console.log('PASS: installed RPM navigates all modules and renders Dashboard, images and Electron preload without renderer exceptions or --no-sandbox.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  socket?.close();
  app.kill();
  await delay(500);
  rmSync(profile, { recursive: true, force: true });
  clearTimeout(deadline);
});
