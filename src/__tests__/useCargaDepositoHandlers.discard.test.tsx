import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCargaDepositoHandlers } from '../hooks/useCargaDepositoHandlers';

// Aqui `cargaAttachments` NÃO é mockado: a exclusão da carga precisa chegar de verdade à ponte do Electron.
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), remove: vi.fn() }));
vi.mock('../utils/firebaseSync', () => ({ upsertFirestoreRecord: mocks.upsert, deleteFirestoreRecord: mocks.remove }));

function setup() {
  let database = {
    Cargas: [{ id: 'c-antiga', date: '2026-08-20', quantityTons: 10, totalValue: 1000 }],
    Depositos_Klabin: [], Vendas: [], Motoristas: [], Produtos: [], Clientes: [], Frete: [],
  } as any;
  const mutateDatabase = vi.fn((updater: (prev: any) => any) => { database = updater(database); return database; });
  const showToast = vi.fn();
  const hook = renderHook(() => useCargaDepositoHandlers({ database, mutateDatabase, showToast, isDateLocked: () => false }));
  return { ...hook, showToast, getDatabase: () => database };
}

describe('excluir carga → ponte de anexos (integração sem mock do cliente)', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { delete (window as any).electron; vi.restoreAllMocks(); });

  it('a exclusão da carga pede à ponte para apagar a pasta dela e avisa a interface', async () => {
    const removeForCarga = vi.fn(async () => ({ ok: true, data: true }));
    (window as any).electron = { isElectron: true, attachments: { removeForCarga } };
    const changed = vi.fn();
    window.addEventListener('carga-attachments-changed', changed);
    const h = setup();
    act(() => h.result.current.handleDeleteCarga('c-antiga'));
    act(() => { h.result.current.handleConfirmDelete(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(removeForCarga).toHaveBeenCalledWith('c-antiga');
    expect(changed).toHaveBeenCalled();
    window.removeEventListener('carga-attachments-changed', changed);
  });

  it('se a ponte recusar apagar a pasta, a carga foi excluída mesmo assim, com o aviso de sucesso', async () => {
    const removeForCarga = vi.fn(async () => ({ ok: false, code: 'DELETE_FAILED', message: 'sem permissão' }));
    (window as any).electron = { isElectron: true, attachments: { removeForCarga } };
    const h = setup();
    act(() => h.result.current.handleDeleteCarga('c-antiga'));
    act(() => { h.result.current.handleConfirmDelete(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(h.getDatabase().Cargas).toHaveLength(0);
    expect(mocks.remove).toHaveBeenCalledWith('cargas', 'c-antiga');
    expect(h.showToast).toHaveBeenCalledWith('Carga excluída com sucesso.');
    expect(console.warn).toHaveBeenCalled(); // só registra; nunca desfaz
  });
});
