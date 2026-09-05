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
  assert.deepEqual(exceptions, [], 'Renderer threw an exception');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/madeireira-rpm-smoke.png', Buffer.from(screenshot.data, 'base64'));
  writeFileSync('/tmp/madeireira-rpm-smoke.json', JSON.stringify({ ...state, exceptions, sandboxDisabled: false }, null, 2));
  console.log('PASS: installed RPM renders Dashboard, images and Electron preload without renderer exceptions or --no-sandbox.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  socket?.close();
  app.kill();
  await delay(500);
  rmSync(profile, { recursive: true, force: true });
  clearTimeout(deadline);
});
