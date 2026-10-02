import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';
const sdk = vi.hoisted(() => ({ snapshots: [] as any[], stop: vi.fn(), getDocs: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), commit: vi.fn(), sets: vi.fn(), deletes: vi.fn() }));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}), getApps: () => [], getApp: () => ({}) }));
vi.mock('firebase/firestore', () => ({ getFirestore: () => ({}), collection: (_db: any, name: string) => name, doc: (_db: any, col: string, id: string) => `${col}/${id}`, getDoc: vi.fn(), getDocs: sdk.getDocs, setDoc: sdk.setDoc, deleteDoc: sdk.deleteDoc,
  onSnapshot: (col: string, next: any, error: any) => { sdk.snapshots.push({ col, next, error }); return sdk.stop; },
  writeBatch: () => ({ set: sdk.sets, delete: sdk.deletes, commit: sdk.commit }),
}));
import { syncFirestoreSettings, subscribeToFirestore, restoreFirestoreAuthoritatively, isFirestoreSyncSuspended, checkAndSeedFirestoreIfEmpty, flushPendingFirestoreUpserts, getPendingFirestoreUpserts, upsertFirestoreRecord } from '../utils/firebaseSync';
import { initialKlabinData } from '../data/initialData';
import { sanitizeDatabase } from '../utils/storage';
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
it('grava as configurações sem undefined aninhado, que o Firestore rejeita', async () => {
  const appSettings = sanitizeDatabase({ ...regressionDatabase(), appSettings: { freightRatePerTon: 15, company: { name: 'Madeireira Sol Nascente' }, cycles: { lockedMonths: ['2026-08'] } } }).appSettings!;
  expect(appSettings.company).toHaveProperty('cnpj', undefined);
  await syncFirestoreSettings({ appSettings });
  const [ref, data, options] = sdk.setDoc.mock.calls.at(-1)!;
  expect(ref).toBe('settings/global');
  expect(options).toEqual({ merge: true });
  expect(JSON.stringify(data)).toBe(JSON.stringify(data, (_k, v) => { if (v === undefined) throw new Error('undefined'); return v; }));
  expect(Object.keys(data.appSettings.company)).toEqual(['name']);
  expect(data.appSettings.cycles.lockedMonths).toEqual(['2026-08']);
  expect(data.appSettings.freightRatePerTon).toBe(15);

  sdk.getDocs.mockResolvedValue({ empty: true, docs: [] });
  await restoreFirestoreAuthoritatively({ ...regressionDatabase(), appSettings });
  const restored = sdk.sets.mock.calls.find((c: any[]) => c[0] === 'settings/global')!;
  expect(Object.keys(restored[1].appSettings.company)).toEqual(['name']);
});
it('preserva um status local pendente de envio contra snapshot antigo e o reenvia depois', async () => {
  let rejectWrite: ((reason: Error) => void) | undefined;
  sdk.setDoc.mockImplementationOnce(() => new Promise((_, reject) => { rejectWrite = reject; }));
  const paid = {
    id: 'crg-f04ebbce-15b5-49d4-8762-6789de7f16e6',
    date: '2026-08-25',
    driverPlate: 'Cleverson Gonçalves Costa / AFD-3J31',
    quantityTons: 21.72,
    freightCost: 325.8,
    freightStatus: 'PAID',
  };
  const write = upsertFirestoreRecord('cargas', paid);

  expect(getPendingFirestoreUpserts('cargas')).toEqual([{ collection: 'cargas', record: paid }]);

  const update = vi.fn();
  subscribeToFirestore(update);
  const carga = sdk.snapshots.find(s => s.col === 'cargas');
  carga.next({
    empty: false,
    metadata: { fromCache: false },
    forEach: (fn: any) => fn({ id: paid.id, data: () => ({ ...paid, freightStatus: 'PENDING' }) }),
  });
  expect(update).toHaveBeenLastCalledWith('Cargas', [paid]);

  rejectWrite!(new Error('permission-denied'));
  await write;
  expect(getPendingFirestoreUpserts('cargas')).toHaveLength(1);

  sdk.setDoc.mockResolvedValueOnce(undefined);
  await flushPendingFirestoreUpserts();
  expect(sdk.setDoc).toHaveBeenLastCalledWith(`cargas/${paid.id}`, paid, { merge: true });
  expect(getPendingFirestoreUpserts()).toEqual([]);
});
