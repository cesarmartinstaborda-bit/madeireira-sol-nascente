import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ cb: null as any, stop: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), credential: vi.fn(), auth: { currentUser: null } }));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}), getApps: () => [], getApp: () => ({}) }));
vi.mock('firebase/auth', () => ({ getAuth: () => sdk.auth, onAuthStateChanged: (_a: any, cb: any) => { sdk.cb = cb; return sdk.stop; }, signInWithCredential: sdk.signIn, signOut: sdk.signOut, GoogleAuthProvider: Object.assign(class {}, { credential: sdk.credential }) }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); localStorage.clear(); sdk.signIn.mockResolvedValue({ user: { uid: 'isolated-user' } }); sdk.signOut.mockResolvedValue(undefined); });
afterEach(() => { delete window.electron; vi.restoreAllMocks(); });
it('assinatura Firebase independe de token Drive e retorna unsubscribe', async () => {
  const auth = await import('../utils/googleAuth'); const cb = vi.fn();
  const stop = auth.onFirebaseUser(cb); sdk.cb({ uid: 'isolated-user' });
  expect(cb).toHaveBeenCalledWith({ uid: 'isolated-user' });
  expect(await auth.getAccessToken()).toBeNull(); stop(); expect(sdk.stop).toHaveBeenCalledOnce();
});
it('login publica token antes do callback Firebase; logout limpa sessão e nunca grava token no localStorage', async () => {
  window.electron = { isElectron: true, googleRestoreSession: vi.fn().mockResolvedValue(null), googleClearSession: vi.fn().mockResolvedValue(true), googleSignIn: vi.fn().mockResolvedValue({ idToken: 'fake-id', accessToken: 'fake-access' }) };
  const auth = await import('../utils/googleAuth');
  sdk.signIn.mockImplementation(async () => { expect(await auth.getAccessToken()).toBe('fake-access'); return { user: { uid: 'isolated-user' } }; });
  expect((await auth.googleSignIn())!.accessToken).toBe('fake-access');
  expect(localStorage.length).toBe(0);
  await auth.googleSignOut(); expect(window.electron.googleClearSession).toHaveBeenCalledOnce(); expect(sdk.signOut).toHaveBeenCalledOnce(); expect(await auth.getAccessToken()).toBeNull();
});
it('cancelamento não deixa token e falha de credencial é propagada sem persistência', async () => {
  window.electron = { isElectron: true, googleRestoreSession: vi.fn().mockResolvedValue(null), googleClearSession: vi.fn().mockResolvedValue(true), googleSignIn: vi.fn().mockRejectedValue(new Error('Login cancelado')) };
  const auth = await import('../utils/googleAuth');
  expect(await auth.googleSignIn()).toBeNull();
  vi.mocked(window.electron.googleSignIn).mockResolvedValue({ idToken: 'fake-id', accessToken: 'fake-access' });
  sdk.signIn.mockRejectedValue(new Error('isolated invalid credential'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(auth.googleSignIn()).rejects.toThrow('invalid credential');
  expect(await auth.getAccessToken()).toBeNull(); expect(localStorage.length).toBe(0);
});
it('restauração silenciosa é única por execução e aceita refresh sem id_token', async () => {
  window.electron = { isElectron: true, googleRestoreSession: vi.fn().mockResolvedValue(null), googleClearSession: vi.fn().mockResolvedValue(true), googleSignIn: vi.fn() };
  vi.mocked(window.electron.googleRestoreSession).mockResolvedValue({ accessToken: 'fake-restored', idToken: null });
  const auth = await import('../utils/googleAuth');
  await Promise.all([auth.restoreGoogleSession(), auth.restoreGoogleSession()]);
  expect(window.electron.googleRestoreSession).toHaveBeenCalledOnce();
  expect(sdk.credential).toHaveBeenCalledWith(null, 'fake-restored');
  expect(await auth.getAccessToken()).toBe('fake-restored');
});
it('assinatura Firebase preserva a reconexão silenciosa local sem duplicar a restauração', async () => {
  window.electron = { isElectron: true, googleSignIn: vi.fn(), googleClearSession: vi.fn(), googleRestoreSession: vi.fn().mockResolvedValue({ accessToken: 'fake-restored', idToken: null }) };
  const auth = await import('../utils/googleAuth');
  const stop = auth.onFirebaseUser(vi.fn());
  await auth.restoreGoogleSession();
  expect(window.electron.googleRestoreSession).toHaveBeenCalledOnce();
  expect(sdk.signIn).toHaveBeenCalledOnce();
  stop(); expect(sdk.stop).toHaveBeenCalledOnce();
});
