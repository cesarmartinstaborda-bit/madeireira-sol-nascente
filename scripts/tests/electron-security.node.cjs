const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

function harness({ backend = 'gnome_libsecret', encrypted = true, openFails = false } = {}) {
  const handlers = {}, writes = [], requests = [];
  let window, callback, opened, timeout;
  const server = new EventEmitter();
  server.listen = (_port, _host, ready) => { queueMicrotask(ready); };
  server.address = () => ({ port: 43210 });
  server.close = () => { server.closed = true; };
  const app = Object.assign(new EventEmitter(), {
    isPackaged: true, commandLine: { hasSwitch: () => true },
    requestSingleInstanceLock: () => true, getPath: () => '/fake-profile',
    whenReady: () => ({ then: fn => fn() }),
  });
  const electron = { app, ipcMain: { handle: (name, fn) => { handlers[name] = fn; } },
    shell: { openExternal: async url => { opened = new URL(url); if (openFails) throw new Error('browser unavailable'); } },
    safeStorage: { isEncryptionAvailable: () => encrypted, getSelectedStorageBackend: () => backend,
      encryptString: value => Buffer.from(value), decryptString: () => 'test-refresh' },
    BrowserWindow: class extends EventEmitter {
      constructor(options) { super(); window = this; this.options = options;
        this.webContents = Object.assign(new EventEmitter(), {
          mainFrame: {}, session: { setPermissionRequestHandler: fn => { this.permission = fn; }, setPermissionCheckHandler: fn => { this.check = fn; } },
          setWindowOpenHandler: fn => { this.open = fn; },
        });
      }
      loadFile(file) { this.webContents.mainFrame.url = require('node:url').pathToFileURL(file).href; }
      isMinimized() { return false; } show() {} focus() {}
    },
  };
  const fakeFs = { writeFileSync: (...args) => writes.push(args), chmodSync: (...args) => writes.push(args), existsSync: () => true, readFileSync: () => Buffer.from('test'), unlinkSync: () => writes.push(['delete']) };
  const context = vm.createContext({ require: name => name === 'electron' ? electron : name === 'fs' ? fakeFs : name === 'http' ? { createServer: fn => { callback = fn; return server; } } : require(name),
    __dirname: path.resolve(__dirname, '../..'), Buffer, URL, URLSearchParams,
    process: { platform: 'linux', env: { GOOGLE_OAUTH_CLIENT_ID: 'test-client', GOOGLE_OAUTH_CLIENT_SECRET: 'test-secret', ELECTRON_START_URL: 'https://untrusted.invalid' }, loadEnvFile() {} },
    console: { warn() {} }, setTimeout: fn => { timeout = fn; return 1; }, clearTimeout() {},
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ id_token: 'test-id', access_token: 'test-access', refresh_token: 'test-refresh' }) }; },
  });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../electron.js'), 'utf8'), context);
  return { handlers, writes, requests, window, server, context,
    event: () => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame }),
    callback: query => { const res = { writeHead() { return this; }, end() {} }; callback({ url: '/callback?' + query }, res); },
    opened: () => opened, timeout: () => timeout(),
  };
}

test('packaged window isolates Node, enables sandbox and rejects navigation, permissions and foreign IPC', async () => {
  const h = harness();
  assert.equal(h.window.options.webPreferences.contextIsolation, true);
  assert.equal(h.window.options.webPreferences.sandbox, true);
  assert.equal(h.window.options.webPreferences.nodeIntegration, false);
  assert.match(h.window.webContents.mainFrame.url, /^file:/);
  assert.equal(h.window.open({ url: 'file:///etc/passwd' }).action, 'deny');
  assert.equal(h.opened(), undefined);
  assert.equal(h.window.open({ url: 'https://drive.google.com/file/d/test/view' }).action, 'deny');
  assert.equal(h.opened().hostname, 'drive.google.com');
  let prevented = false;
  h.window.webContents.emit('will-navigate', { preventDefault() { prevented = true; } }, 'https://evil.invalid');
  assert.equal(prevented, true);
  h.window.permission(null, 'camera', allowed => assert.equal(allowed, false));
  assert.equal(h.window.check(), false);
  for (const fn of Object.values(h.handlers)) {
    await assert.rejects(async () => fn({ sender: {}, senderFrame: {} }), /IPC/);
    await assert.rejects(async () => fn({ sender: h.window.webContents, senderFrame: { url: h.window.webContents.mainFrame.url } }), /IPC/);
  }
  h.window.webContents.mainFrame.url = 'https://evil.invalid';
  await assert.rejects(async () => h.handlers['google-restore-session'](h.event()), /IPC/);
});

test('safeStorage refuses basic_text/unavailable storage and restricts token file permissions', async () => {
  for (const options of [{ backend: 'basic_text' }, { backend: 'unknown' }, { encrypted: false }]) {
    const h = harness(options);
    vm.runInContext("persistRefreshToken('test-refresh')", h.context);
    assert.equal(h.writes.length, 0);
    assert.equal(await h.handlers['google-restore-session'](h.event()), null);
    assert.equal(h.requests.length, 0);
  }
  const h = harness();
  vm.runInContext("persistRefreshToken('test-refresh')", h.context);
  assert.equal(h.writes[0][2].mode, 0o600);
  assert.equal(h.writes[1][1], 0o600);
  assert.equal((await h.handlers['google-restore-session'](h.event())).accessToken, 'test-access');
  assert.equal(h.handlers['google-clear-session'](h.event()), true);
});

test('OAuth uses state and PKCE, persists only successful exchange and closes callback server', async () => {
  const h = harness();
  const pending = h.handlers['google-sign-in'](h.event());
  await new Promise(resolve => setImmediate(resolve));
  const url = h.opened();
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge').length, 43);
  await assert.rejects(h.handlers['google-sign-in'](h.event()), /andamento/);
  h.callback(new URLSearchParams({ code: 'fake-code', state: url.searchParams.get('state') }));
  assert.equal((await pending).accessToken, 'test-access');
  assert.equal(h.server.closed, true);
  assert.equal(h.requests[0].options.body.get('code_verifier').length, 43);
});

test('OAuth rejects cancellation, invalid state, timeout and browser launch failure without persisting', async () => {
  for (const mode of ['cancel', 'state', 'timeout', 'browser']) {
    const h = harness({ openFails: mode === 'browser' });
    const pending = h.handlers['google-sign-in'](h.event());
    const rejected = assert.rejects(pending);
    await new Promise(resolve => setImmediate(resolve));
    if (mode === 'cancel') h.callback('error=access_denied');
    if (mode === 'state') h.callback('state=wrong&code=fake');
    if (mode === 'timeout') h.timeout();
    await rejected;
    assert.equal(h.writes.length, 0);
    assert.equal(h.requests.length, 0);
    assert.equal(h.server.closed, true);
  }
});
