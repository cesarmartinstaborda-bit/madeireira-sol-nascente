import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';
const sdk = vi.hoisted(() => ({ snapshots: [] as any[], stop: vi.fn(), getDocs: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), commit: vi.fn(), sets: vi.fn(), deletes: vi.fn() }));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}), getApps: () => [], getApp: () => ({}) }));
vi.mock('firebase/firestore', () => ({ getFirestore: () => ({}), collection: (_db: any, name: string) => name, doc: (_db: any, col: string, id: string) => `${col}/${id}`, getDoc: vi.fn(), getDocs: sdk.getDocs, setDoc: sdk.setDoc, deleteDoc: sdk.deleteDoc,
  onSnapshot: (col: string, next: any, error: any) => { sdk.snapshots.push({ col, next, error }); return sdk.stop; },
  writeBatch: () => ({ set: sdk.sets, delete: sdk.deletes, commit: sdk.commit }),
}));
import { subscribeToFirestore, restoreFirestoreAuthoritatively, isFirestoreSyncSuspended, checkAndSeedFirestoreIfEmpty, upsertFirestoreRecord } from '../utils/firebaseSync';
import { initialKlabinData } from '../data/initialData';
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); sdk.snapshots = []; sdk.getDocs.mockResolvedValue({ empty: true, docs: [] }); sdk.commit.mockResolvedValue(undefined); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
it('sete listeners ignoram cache vazio, propagam remoção confirmada, ordenam datas e encerram sem escrever dados', () => {
  const update = vi.fn(); const stop = subscribeToFirestore(update);
  expect(sdk.snapshots).toHaveLength(7);
  const carga = sdk.snapshots.find(s => s.col === 'cargas');
  carga.next({ empty: true, metadata: { fromCache: true }, forEach() {} });
  expect(update).not.toHaveBeenCalled();
  carga.next({ empty: true, metadata: { fromCache: false }, forEach() {} });
  expect(update).toHaveBeenLastCalledWith('Cargas', []);
  carga.next({ empty: false, metadata: { fromCache: false }, forEach: (fn: any) => [{ id: 'old', date: '01/08/2026' }, { id: 'new', date: '2026-09-01' }].forEach(v => fn({ id: v.id, data: () => v })) });
  expect(update.mock.calls.at(-1)![1].map((r: any) => r.id)).toEqual(['new', 'old']);
  carga.error(new Error('isolated permission-denied'));
  stop(); expect(sdk.stop).toHaveBeenCalledTimes(7);
  expect(sdk.setDoc).not.toHaveBeenCalled();
});
it('restauração elimina órfãos e limita batches a 400 operações; falha libera suspensão', async () => {
  sdk.getDocs.mockResolvedValue({ empty: false, docs: [{ id: 'orphan' }] });
  const db = regressionDatabase(); db.Cargas = Array.from({ length: 805 }, (_, i) => ({ ...db.Cargas[0], id: `c${i}` }));
  sdk.commit.mockImplementation(async () => { expect(isFirestoreSyncSuspended()).toBe(true); });
  expect(await restoreFirestoreAuthoritatively(db)).toEqual({ success: true });
  expect(sdk.deletes).toHaveBeenCalledTimes(6);
  expect(sdk.sets).toHaveBeenCalledTimes(811);
  expect(sdk.commit).toHaveBeenCalledTimes(3);
  expect(isFirestoreSyncSuspended()).toBe(false);
  sdk.commit.mockRejectedValueOnce(new Error('simulated offline'));
  expect((await restoreFirestoreAuthoritatively(db)).success).toBe(false);
  expect(isFirestoreSyncSuspended()).toBe(false);
});
it('não publica dados demonstrativos e retira undefined do upsert', async () => {
  expect(await checkAndSeedFirestoreIfEmpty(initialKlabinData)).toBe(false);
  expect(sdk.setDoc).not.toHaveBeenCalled();
  await upsertFirestoreRecord('cargas', { id: 'test', date: '2026-09-01', note: undefined });
  expect(sdk.setDoc).toHaveBeenCalledWith('cargas/test', { id: 'test', date: '2026-09-01' }, { merge: true });
});
