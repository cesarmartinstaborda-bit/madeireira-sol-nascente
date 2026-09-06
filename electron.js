const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron');
const path = require('path');
const { pathToFileURL } = require('node:url');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

// Preserve Electron 33's Linux window/focus behavior and GTK dependency.
// Newer Electron defaults to native Wayland and GTK 4 on GNOME.
if (process.platform === 'linux') {
  if (!app.commandLine.hasSwitch('ozone-platform')) {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
  }
  if (!app.commandLine.hasSwitch('gtk-version')) {
    app.commandLine.appendSwitch('gtk-version', '3');
  }
}

// .env is optional — GOOGLE_OAUTH_CLIENT_SECRET can also be exported in the shell
// before launching the app (e.g. `GOOGLE_OAUTH_CLIENT_SECRET=... npm run electron:dev`).
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // no .env file present — ignore
}

const gotTheLock = app.requestSingleInstanceLock();
let mainWindow = null;

// Google OAuth credentials are supplied locally through environment variables.
// Scopes must be kept in sync with src/utils/googleAuth.ts:GOOGLE_DRIVE_SCOPES.
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
];
const GOOGLE_SIGNIN_TIMEOUT_MS = 3 * 60 * 1000;

// Tracks the single in-flight sign-in attempt (server + timeout), if any.
let signInState = null;

// ---------------------------------------------------------------------------
// Persistent Google Drive session (refresh_token stored encrypted via safeStorage)
// ---------------------------------------------------------------------------
const sessionFilePath = () => path.join(app.getPath('userData'), 'gdrive-session.bin');

function hasSecureTokenStorage() {
  return safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' || !['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend()));
}

function persistRefreshToken(refreshToken) {
  if (!refreshToken) return;
  try {
    if (!hasSecureTokenStorage()) {
      console.warn(
        '[Auth] safeStorage indisponível neste ambiente — refresh_token NÃO será salvo (login persistente desativado). Nunca gravamos em texto puro.'
      );
      return;
    }
    fs.writeFileSync(sessionFilePath(), safeStorage.encryptString(refreshToken), { mode: 0o600 });
    fs.chmodSync(sessionFilePath(), 0o600);
  } catch (err) {
    console.warn('[Auth] Falha ao salvar sessão do Google Drive:', err.message);
  }
}

function loadRefreshToken() {
  try {
    if (!hasSecureTokenStorage()) return null;
    const file = sessionFilePath();
    if (!fs.existsSync(file)) return null;
    return safeStorage.decryptString(fs.readFileSync(file));
  } catch (err) {
    console.warn('[Auth] Falha ao ler sessão do Google Drive:', err.message);
    return null;
  }
}

function clearStoredSession() {
  try {
    const file = sessionFilePath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (err) {
    console.warn('[Auth] Falha ao limpar sessão do Google Drive:', err.message);
  }
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  if (GOOGLE_OAUTH_CLIENT_SECRET) {
    body.set('client_secret', GOOGLE_OAUTH_CLIENT_SECRET);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(
      data.error_description || data.error || `Falha ao renovar token (HTTP ${response.status})`
    );
    err.code = data.error;
    throw err;
  }
  if (!data.access_token) {
    throw new Error('Resposta de renovação do Google não contém access_token.');
  }
  return { accessToken: data.access_token, idToken: data.id_token || null };
}

function base64URLEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function signInResultPage(success, message) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${success ? 'Login concluído' : 'Falha no login'}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #0f1115; color: #e5e7eb; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { text-align: center; padding: 2.5rem 3rem; border-radius: 12px; background: #1a1d24; border: 1px solid #2a2f3a; }
  h1 { font-size: 1.15rem; margin: 0 0 .5rem; color: ${success ? '#34d399' : '#fb7185'}; }
  p { color: #9ca3af; margin: 0; font-size: .9rem; }
</style>
</head>
<body>
  <div class="card">
    <h1>${success ? 'Login concluído com sucesso' : 'Não foi possível concluir o login'}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

function cleanupSignIn() {
  if (!signInState) return;
  clearTimeout(signInState.timeoutId);
  try {
    signInState.server.close();
  } catch {
    // already closed — ignore
  }
  signInState = null;
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function exchangeCodeForTokens(code, codeVerifier, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });
  if (GOOGLE_OAUTH_CLIENT_SECRET) {
    body.set('client_secret', GOOGLE_OAUTH_CLIENT_SECRET);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data.error_description || data.error || `Falha ao trocar código por tokens (HTTP ${response.status})`
    );
  }
  if (!data.id_token || !data.access_token) {
    throw new Error('Resposta do Google não contém id_token/access_token.');
  }
  return {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
  };
}

function startGoogleSignIn() {
  if (signInState) {
    return Promise.reject(new Error('Já existe um login com Google em andamento.'));
  }
  if (!GOOGLE_OAUTH_CLIENT_SECRET) {
    return Promise.reject(
      new Error('GOOGLE_OAUTH_CLIENT_SECRET não configurado. Defina essa variável de ambiente antes de fazer login.')
    );
  }

  return new Promise((resolve, reject) => {
    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = base64URLEncode(crypto.createHash('sha256').update(codeVerifier).digest());
    const state = crypto.randomBytes(16).toString('hex');

    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanupSignIn();
      fn(value);
    };

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://127.0.0.1:${server.address().port}`);
      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }

      const error = reqUrl.searchParams.get('error');
      const returnedState = reqUrl.searchParams.get('state');
      const code = reqUrl.searchParams.get('code');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(signInResultPage(false, 'O login foi cancelado. Você pode fechar esta aba.'));
        settle(
          reject,
          new Error(
            error === 'access_denied' ? 'Login com Google cancelado pelo usuário.' : `Google retornou um erro: ${error}`
          )
        );
        return;
      }

      if (returnedState !== state || !code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(signInResultPage(false, 'Resposta inválida do Google. Feche esta aba e tente novamente.'));
        settle(reject, new Error('Resposta de login inválida (state ou code ausente).'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(signInResultPage(true, 'Você pode fechar esta aba e voltar para o aplicativo.'));

      const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
      exchangeCodeForTokens(code, codeVerifier, redirectUri)
        .then((tokens) => {
          focusMainWindow();
          // Persist the refresh_token (encrypted) so the app can silently
          // reconnect on next launch without a new interactive login.
          persistRefreshToken(tokens.refreshToken);
          settle(resolve, { idToken: tokens.idToken, accessToken: tokens.accessToken });
        })
        .catch((err) => settle(reject, err));
    });

    server.on('error', (err) => {
      settle(reject, new Error(`Não foi possível iniciar o servidor local de login: ${err.message}`));
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_OAUTH_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '));
      // offline + consent guarantee Google returns a refresh_token every time,
      // which is what powers the persistent (auto-reconnect) login.
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent select_account');
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('state', state);

      shell.openExternal(authUrl.toString()).catch(() => {
        settle(reject, new Error('Não foi possível abrir o navegador para login.'));
      });
    });

    const timeoutId = setTimeout(() => {
      settle(reject, new Error('Tempo esgotado: login com Google não foi concluído a tempo.'));
    }, GOOGLE_SIGNIN_TIMEOUT_MS);

    signInState = { server, timeoutId };
  });
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 700,
      title: 'Madeireira Sol Nascente',
      icon: path.join(__dirname, 'assets', 'icon.png'),
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    const isDev = !app.isPackaged;
    const startUrl = isDev ? (process.env.ELECTRON_START_URL || 'http://localhost:3000') : null;
    const trustedUrl = startUrl || pathToFileURL(path.join(__dirname, 'dist', 'index.html')).href;
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      // Drive's existing 'open file' links belong in the system browser.
      try {
        const target = new URL(url);
        if (target.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(target.hostname)) {
          shell.openExternal(target.href).catch(() => console.warn('[Drive] Falha ao abrir arquivo no navegador.'));
        }
      } catch { /* Ignore invalid remote file links. */ }
      return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (url !== trustedUrl) event.preventDefault();
    });
    mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    mainWindow.webContents.session.setPermissionCheckHandler(() => false);
    if (startUrl) {
      mainWindow.loadURL(startUrl);
    } else {
      mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  function requireMainFrame(event) {
    const contents = mainWindow?.webContents;
    if (!contents || event.sender !== contents || event.senderFrame !== contents.mainFrame) {
      throw new Error('Origem IPC não autorizada.');
    }
    const expected = app.isPackaged
      ? pathToFileURL(path.join(__dirname, 'dist', 'index.html')).href
      : (process.env.ELECTRON_START_URL || 'http://localhost:3000');
    if (new URL(event.senderFrame.url).href !== new URL(expected).href) {
      throw new Error('Origem IPC não autorizada.');
    }
  }

  ipcMain.handle('google-sign-in', (event) => { requireMainFrame(event); return startGoogleSignIn(); });

  // Silent reconnect on boot: exchange the stored refresh_token for a fresh
  // access_token. Returns null when there is no stored session or it is no
  // longer valid (in which case the stale session file is removed).
  ipcMain.handle('google-restore-session', async (event) => {
    requireMainFrame(event);
    const refreshToken = loadRefreshToken();
    if (!refreshToken) return null;
    try {
      const { accessToken, idToken } = await refreshAccessToken(refreshToken);
      return { accessToken, idToken };
    } catch (err) {
      if (err.code === 'invalid_grant') {
        clearStoredSession();
      }
      console.warn('[Auth] Não foi possível restaurar a sessão do Google Drive:', err.message);
      return null;
    }
  });

  // Manual logout: drop the persisted refresh_token so the app stops
  // auto-reconnecting until the user signs in again.
  ipcMain.handle('google-clear-session', (event) => {
    requireMainFrame(event);
    clearStoredSession();
    return true;
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
