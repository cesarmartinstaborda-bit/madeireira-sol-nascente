import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';
const cloud = vi.hoisted(() => ({ listener: null as any, unsubscribe: vi.fn(), seed: vi.fn().mockResolvedValue(false) }));
vi.mock('../utils/firebaseSync', () => ({ subscribeToFirestore: (cb: any) => { cloud.listener = cb; return cloud.unsubscribe; }, checkAndSeedFirestoreIfEmpty: cloud.seed, isFirebaseConfigured: () => true }));
// A sincronização agora espera o Firebase Auth: `auth.current` é o usuário no
// mount e `auth.cb` deixa o teste disparar login/logout depois.
const auth = vi.hoisted(() => ({ cb: null as null | ((u: any) => void), current: null as any }));
vi.mock('../utils/googleAuth', () => ({ getCurrentGoogleUser: () => auth.current, onFirebaseUser: (cb: any) => { auth.cb = cb; cb(auth.current); return vi.fn(); } }));
import { useKlabinDatabase } from '../hooks/useKlabinDatabase';
import { getAutoBackups, sanitizeDatabase } from '../utils/storage';
beforeEach(() => { localStorage.clear(); localStorage.setItem('klabin_base_app_database_v1', JSON.stringify(regressionDatabase())); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06T12:00:00Z')); vi.clearAllMocks(); cloud.listener = null; auth.cb = null; auth.current = { uid: 'test-user', email: 'cesarmartinstaborda@gmail.com' }; });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('persiste mutações locais e adia backup; snapshots e setter bruto não agendam backup', () => {
  const { result } = renderHook(useKlabinDatabase);
  expect(getAutoBackups()).toHaveLength(0);
  act(() => result.current.mutateDatabase(prev => ({ ...prev, Depositos_Klabin: [{ id: 'new', date: '2026-09-01', value: 2000 }] })));
  expect(JSON.parse(localStorage.getItem('klabin_base_app_database_v1')!).Depositos_Klabin[0].value).toBe(2000);
  expect(getAutoBackups()).toHaveLength(0);
  act(() => vi.runOnlyPendingTimers());
  expect(getAutoBackups()[0].data.Depositos_Klabin[0].value).toBe(2000);
  act(() => cloud.listener('Depositos_Klabin', []));
  expect(result.current.database.Depositos_Klabin).toEqual([]);
  act(() => vi.advanceTimersByTime(100000));
  expect(getAutoBackups()[0].data.Depositos_Klabin[0].value).toBe(2000);
  act(() => result.current.setDatabase(sanitizeDatabase(regressionDatabase())));
  act(() => vi.advanceTimersByTime(100000));
  expect(getAutoBackups()[0].data.Depositos_Klabin[0].value).toBe(2000);
  expect(getAutoBackups()[0].data.Depositos_Klabin[0].value).toBe(2000);
});
it('mescla Settings conforme presença dos campos, mantém demais coleções e encerra uma assinatura', () => {
  const view = renderHook(useKlabinDatabase);
  const before = view.result.current.database;
  act(() => cloud.listener('Settings', { customLogo: 'data:image/png;base64,AAAA' }));
  expect(view.result.current.database.appSettings).toEqual(before.appSettings);
  expect(view.result.current.database.Cargas).toEqual(before.Cargas);
  act(() => cloud.listener('Settings', { customLogo: null }));
  expect(view.result.current.database.customLogo).toBeUndefined();
  expect(cloud.seed).toHaveBeenCalledTimes(1);
  view.unmount(); expect(cloud.unsubscribe).toHaveBeenCalledTimes(1);
});
it('só assina o Firestore depois que o Firebase Auth confirma um usuário e cancela ao sair', () => {
  auth.current = null; // sem sessão no mount
  const { unmount } = renderHook(useKlabinDatabase);
  expect(cloud.listener).toBeNull();
  expect(cloud.seed).not.toHaveBeenCalled();
  act(() => auth.cb!({ uid: 'u1', email: 'cesarmartinstaborda@gmail.com' }));
  expect(typeof cloud.listener).toBe('function');
  expect(cloud.seed).toHaveBeenCalledTimes(1);
  act(() => auth.cb!(null)); // logout / sessão expirada
  expect(cloud.unsubscribe).toHaveBeenCalledTimes(1);
  unmount();
});
