import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';

const sdk = vi.hoisted(() => ({
  snapshots: [] as any[], stop: vi.fn(), getDocs: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(),
  commit: vi.fn(), sets: vi.fn(), deletes: vi.fn(),
}));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}), getApps: () => [], getApp: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}), collection: (_db: any, name: string) => name, doc: (_db: any, col: string, id: string) => `${col}/${id}`,
  getDoc: vi.fn(), getDocs: sdk.getDocs, setDoc: sdk.setDoc, deleteDoc: sdk.deleteDoc,
  onSnapshot: (col: string, next: any, error: any) => { sdk.snapshots.push({ col, next, error }); return sdk.stop; },
  writeBatch: () => ({ set: sdk.sets, delete: sdk.deletes, commit: sdk.commit }),
}));

import {
  deleteFirestoreRecord,
  flushPendingFirestoreUpserts,
  getPendingFirestoreUpserts,
  restoreFirestoreAuthoritatively,
  subscribeToFirestore,
  upsertFirestoreRecord,
} from '../utils/firebaseSync';
import { hasPendingFirestoreRestore, readPendingFirestoreDeletes } from '../utils/firestorePendingOps';

const snapshot = (docs: any[]) => ({
  empty: docs.length === 0,
  metadata: { fromCache: false },
  forEach: (fn: any) => docs.forEach((d) => fn({ id: d.id, data: () => d })),
});
const denied = () => Promise.reject(new Error('permission-denied'));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  sdk.snapshots = [];
  sdk.getDocs.mockResolvedValue({ empty: true, docs: [] });
  sdk.commit.mockResolvedValue(undefined);
  sdk.setDoc.mockResolvedValue(undefined);
  sdk.deleteDoc.mockResolvedValue(undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it('exclusão sem login fica pendente, não volta pelo snapshot e é concluída depois', async () => {
  sdk.deleteDoc.mockImplementationOnce(denied);
  await deleteFirestoreRecord('maoDeObraLancamentos', 'mob-1');
  expect(readPendingFirestoreDeletes()).toEqual([{ collection: 'maoDeObraLancamentos', id: 'mob-1' }]);

  const update = vi.fn();
  subscribeToFirestore(update);
  sdk.snapshots.find((s) => s.col === 'maoDeObraLancamentos').next(snapshot([{ id: 'mob-1' }, { id: 'mob-2' }]));
  expect(update.mock.calls.at(-1)![1].map((r: any) => r.id)).toEqual(['mob-2']);

  await flushPendingFirestoreUpserts();
  expect(sdk.deleteDoc).toHaveBeenLastCalledWith('maoDeObraLancamentos/mob-1');
  expect(readPendingFirestoreDeletes()).toEqual([]);
});

it('exclusão confirmada sai da fila e uma gravação nova do mesmo id supera a exclusão pendente', async () => {
  await deleteFirestoreRecord('cargas', 'c1');
  expect(readPendingFirestoreDeletes()).toEqual([]);

  sdk.deleteDoc.mockImplementationOnce(denied);
  await deleteFirestoreRecord('cargas', 'c2');
  sdk.setDoc.mockImplementationOnce(denied);
  await upsertFirestoreRecord('cargas', { id: 'c2', date: '2026-09-01' });
  expect(readPendingFirestoreDeletes()).toEqual([]);
  expect(getPendingFirestoreUpserts('cargas')).toHaveLength(1);
});

it('restauração sem login preserva fila e dados, ignora snapshots e conclui depois sem reaplicar o que já foi enviado', async () => {
  sdk.setDoc.mockImplementation(denied);
  sdk.deleteDoc.mockImplementation(denied);
  await upsertFirestoreRecord('maoDeObraLancamentos', { id: 'mob-1', quantityTons: 3 });
  await deleteFirestoreRecord('cargas', 'old');

  sdk.getDocs.mockImplementation(denied);
  const db = regressionDatabase();
  expect((await restoreFirestoreAuthoritatively(db)).success).toBe(false);
  expect(hasPendingFirestoreRestore()).toBe(true);
  expect(getPendingFirestoreUpserts()).toHaveLength(1);
  expect(readPendingFirestoreDeletes()).toHaveLength(1);

  const update = vi.fn();
  subscribeToFirestore(update);
  sdk.snapshots.find((s) => s.col === 'cargas').next(snapshot([{ id: 'remota-antiga' }]));
  expect(update).not.toHaveBeenCalled();

  // Alteração feita durante a nova tentativa continua na fila depois do sucesso.
  sdk.getDocs.mockResolvedValue({ empty: true, docs: [] });
  sdk.commit.mockImplementationOnce(async () => {
    await upsertFirestoreRecord('maoDeObraClientes', { id: 'mobcli-1', name: 'Nova' });
  });
  expect((await restoreFirestoreAuthoritatively(db)).success).toBe(true);
  expect(hasPendingFirestoreRestore()).toBe(false);
  expect(readPendingFirestoreDeletes()).toEqual([]);
  expect(getPendingFirestoreUpserts().map((p) => p.record.id)).toEqual(['mobcli-1']);

  sdk.snapshots.find((s) => s.col === 'cargas').next(snapshot([{ id: 'c-nuvem' }]));
  expect(update).toHaveBeenCalledWith('Cargas', [expect.objectContaining({ id: 'c-nuvem' })]);
});
