import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCargaDepositoHandlers } from '../hooks/useCargaDepositoHandlers';

const firebase = vi.hoisted(() => ({ upsert: vi.fn(), remove: vi.fn() }));

vi.mock('../utils/firebaseSync', () => ({
  upsertFirestoreRecord: firebase.upsert,
  deleteFirestoreRecord: firebase.remove,
}));

const baseDatabase = () => ({
  Cargas: [{ id: 'c1', date: '2026-08-20', quantityTons: 10, totalValue: 1000 }],
  Depositos_Klabin: [{ id: 'd1', date: '2026-08-21', value: 500 }],
  Vendas: [], Motoristas: [], Produtos: [], Clientes: [], Frete: [],
} as any);

function setup(locked = false) {
  let database = baseDatabase();
  const mutateDatabase = vi.fn((updater: (prev: any) => any) => { database = updater(database); });
  const showToast = vi.fn();
  const isDateLocked = vi.fn(() => locked);
  const hook = renderHook(() => useCargaDepositoHandlers({ database, mutateDatabase, showToast, isDateLocked }));
  return { ...hook, mutateDatabase, showToast, isDateLocked, getDatabase: () => database };
}

describe('useCargaDepositoHandlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('atualiza carga e sincroniza a coleção correta', () => {
    const h = setup();
    const updated = { ...h.getDatabase().Cargas[0], quantityTons: 12, totalValue: 1200 };
    act(() => h.result.current.handleUpdateCargaRecord(updated));
    expect(h.getDatabase().Cargas[0]).toMatchObject({ quantityTons: 12, totalValue: 1200 });
    expect(firebase.upsert).toHaveBeenCalledWith('cargas', updated);
  });

  it('bloqueia atualização financeira em mês fechado', () => {
    const h = setup(true);
    act(() => h.result.current.handleUpdateDepositoRecord({ ...h.getDatabase().Depositos_Klabin[0], value: 999 }));
    expect(h.mutateDatabase).not.toHaveBeenCalled();
    expect(firebase.upsert).not.toHaveBeenCalled();
    expect(h.showToast).toHaveBeenCalledWith(expect.stringContaining('mês deste depósito está trancado'));
  });

  it('só exclui carga após confirmação e permite cancelar', () => {
    const h = setup();
    act(() => h.result.current.handleDeleteCarga('c1'));
    expect(h.result.current.confirmDeleteTarget).toEqual({ id: 'c1', table: 'Cargas' });
    expect(h.getDatabase().Cargas).toHaveLength(1);
    act(() => h.result.current.cancelDelete());
    expect(h.result.current.confirmDeleteTarget).toBeNull();
    act(() => h.result.current.handleDeleteCarga('c1'));
    act(() => h.result.current.handleConfirmDelete());
    expect(h.getDatabase().Cargas).toHaveLength(0);
    expect(firebase.remove).toHaveBeenCalledWith('cargas', 'c1');
    expect(h.showToast).toHaveBeenCalledWith('Carga excluída com sucesso.');
  });

  it('confirma exclusão de depósito e bloqueia staging quando o mês está fechado', () => {
    const open = setup();
    act(() => open.result.current.handleDeleteDeposito('d1'));
    act(() => open.result.current.handleConfirmDelete());
    expect(open.getDatabase().Depositos_Klabin).toHaveLength(0);
    expect(firebase.remove).toHaveBeenCalledWith('depositos', 'd1');

    const locked = setup(true);
    act(() => locked.result.current.handleDeleteDeposito('d1'));
    expect(locked.result.current.confirmDeleteTarget).toBeNull();
    expect(locked.showToast).toHaveBeenCalledWith(expect.stringContaining('mês trancado'));
  });
});
