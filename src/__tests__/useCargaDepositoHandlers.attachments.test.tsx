import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCargaDepositoHandlers } from '../hooks/useCargaDepositoHandlers';

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), remove: vi.fn(), discard: vi.fn() }));
vi.mock('../utils/firebaseSync', () => ({ upsertFirestoreRecord: mocks.upsert, deleteFirestoreRecord: mocks.remove }));
vi.mock('../utils/cargaAttachments', () => ({ discardCargaAttachments: mocks.discard }));

const baseDatabase = () =>
  ({
    Cargas: [
      { id: 'c-antiga', date: '2026-08-20', quantityTons: 10, totalValue: 1000 },
      { id: 'c-pro', date: '2026-08-21', quantityTons: 4, totalValue: 400, proCabos: true },
    ],
    Depositos_Klabin: [{ id: 'd1', date: '2026-08-21', value: 500 }],
    Vendas: [], Motoristas: [], Produtos: [], Clientes: [], Frete: [],
  }) as any;

function setup(locked = false) {
  let database = baseDatabase();
  const mutateDatabase = vi.fn((updater: (prev: any) => any) => { database = updater(database); return database; });
  const showToast = vi.fn();
  const hook = renderHook(() => useCargaDepositoHandlers({ database, mutateDatabase, showToast, isDateLocked: () => locked }));
  return { ...hook, showToast, getDatabase: () => database };
}

describe('useCargaDepositoHandlers × anexos locais', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.discard.mockResolvedValue(undefined);
  });

  it('excluir carga apaga também a pasta de anexos dela, imediatamente e de forma síncrona', () => {
    const h = setup();
    act(() => h.result.current.handleDeleteCarga('c-antiga'));
    act(() => { h.result.current.handleConfirmDelete(); });
    expect(h.getDatabase().Cargas.map((c: any) => c.id)).toEqual(['c-pro']);
    expect(mocks.remove).toHaveBeenCalledWith('cargas', 'c-antiga');
    expect(mocks.discard).toHaveBeenCalledWith('c-antiga');
    expect(h.showToast).toHaveBeenCalledWith('Carga excluída com sucesso.');
  });

  it('falha ao apagar a pasta não desfaz nem impede a exclusão da carga', async () => {
    mocks.discard.mockRejectedValue(new Error('disco somente leitura'));
    const h = setup();
    act(() => h.result.current.handleDeleteCarga('c-antiga'));
    act(() => { h.result.current.handleConfirmDelete(); });
    await act(async () => { await Promise.resolve(); });
    expect(h.getDatabase().Cargas.map((c: any) => c.id)).toEqual(['c-pro']);
    expect(h.showToast).toHaveBeenCalledWith('Carga excluída com sucesso.');
  });

  it('excluir depósito não mexe em anexos; cancelar e mês trancado também não', () => {
    const h = setup();
    act(() => h.result.current.handleDeleteDeposito('d1'));
    act(() => { h.result.current.handleConfirmDelete(); });
    act(() => h.result.current.handleDeleteCarga('c-pro'));
    act(() => h.result.current.cancelDelete());
    expect(mocks.discard).not.toHaveBeenCalled();

    const locked = setup(true);
    act(() => locked.result.current.handleDeleteCarga('c-antiga'));
    expect(locked.result.current.confirmDeleteTarget).toBeNull();
    expect(mocks.discard).not.toHaveBeenCalled();
  });

  it('editar carga nunca perde anexos: o registro não carrega anexos e o Firestore não recebe nenhum campo deles', () => {
    const h = setup();
    const edited = { id: 'c-antiga', date: '2026-08-20', quantityTons: 12, totalValue: 1200 } as any;
    act(() => { h.result.current.handleSaveCargaOrDeposito('Cargas', edited); });
    act(() => h.result.current.handleUpdateCargaRecord({ ...edited, quantityTons: 13 }));
    act(() => h.result.current.handleSetProCabosStatus('c-pro', 'PAID'));
    const cargas = h.getDatabase().Cargas;
    expect(cargas.find((c: any) => c.id === 'c-antiga')).toMatchObject({ quantityTons: 13 });
    expect(cargas.every((c: any) => !('attachments' in c))).toBe(true);
    for (const [, payload] of mocks.upsert.mock.calls) expect('attachments' in payload).toBe(false);
    expect(mocks.discard).not.toHaveBeenCalled();
  });
});
