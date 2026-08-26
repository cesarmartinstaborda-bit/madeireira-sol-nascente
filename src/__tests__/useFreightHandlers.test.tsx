import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFreightHandlers } from '../hooks/useFreightHandlers';

const firebase = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock('../utils/firebaseSync', () => ({ upsertFirestoreRecord: firebase.upsert }));

const baseDatabase = () => ({
  Motoristas: [{ id: 'm1', name: 'João', licensePlate: 'ABC-1234' }],
  Cargas: [
    { id: 'c1', date: '2026-08-10', driverId: 'm1', freightPayable: 'YES', freightCost: 150, freightStatus: 'PENDING' },
    { id: 'c2', date: '2026-07-10', driverId: 'm1', freightPayable: 'YES', freightCost: 200, freightStatus: 'PENDING' },
    { id: 'c3', date: '2026-08-10', driverId: 'm1', freightPayable: 'NO', freightCost: 300, freightStatus: 'PENDING' },
  ],
  Vendas: [{ id: 'v1', date: '2026-08-11', motoristaId: 'm1', freightPayable: 'YES', freightCost: 90, freightStatus: 'PENDING' }],
  Depositos_Klabin: [], Produtos: [], Clientes: [], Frete: [],
} as any);

function setup(isLocked: (date?: string) => boolean = () => false) {
  let database = baseDatabase();
  const mutateDatabase = vi.fn((updater: (prev: any) => any) => { database = updater(database); });
  const showToast = vi.fn();
  const { result } = renderHook(() => useFreightHandlers({ database, mutateDatabase, showToast, isDateLocked: isLocked }));
  return { result, mutateDatabase, showToast, getDatabase: () => database };
}

describe('useFreightHandlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('quita cargas e vendas do motorista, preservando itens sem frete', () => {
    const h = setup();
    act(() => h.result.current.handlePayFreightForDriver('m1', 'tx-qa'));
    expect(h.getDatabase().Cargas.map((x: any) => x.freightStatus)).toEqual(['PAID', 'PAID', 'PENDING']);
    expect(h.getDatabase().Vendas[0]).toMatchObject({ freightStatus: 'PAID', transactionKey: 'tx-qa' });
    expect(h.getDatabase().Cargas[0].freightPaidAt).toEqual(expect.any(String));
    expect(firebase.upsert).toHaveBeenCalledTimes(3);
    expect(firebase.upsert).toHaveBeenCalledWith('vendas', expect.objectContaining({ id: 'v1', freightStatus: 'PAID' }));
  });

  it('preserva competências fechadas e informa quantidade ignorada', () => {
    const h = setup(date => date?.startsWith('2026-07') === true);
    act(() => h.result.current.handlePayFreightForDriver('ABC-1234'));
    expect(h.getDatabase().Cargas[0].freightStatus).toBe('PAID');
    expect(h.getDatabase().Cargas[1].freightStatus).toBe('PENDING');
    expect(h.showToast).toHaveBeenCalledWith(expect.stringContaining('1 registro(s) em meses trancados'));
  });

  it('reverte pagamentos, remove freightPaidAt e sincroniza ambas as entidades', () => {
    const h = setup();
    act(() => h.result.current.handlePayFreightForDriver('João / ABC-1234'));
    firebase.upsert.mockClear();
    act(() => h.result.current.handleRevertFreightForDriver('m1'));
    expect(h.getDatabase().Cargas[0]).toMatchObject({ freightStatus: 'PENDING', freightPaidAt: undefined });
    expect(h.getDatabase().Vendas[0]).toMatchObject({ freightStatus: 'PENDING', freightPaidAt: undefined });
    expect(firebase.upsert).toHaveBeenCalledTimes(3);
  });

  it('alterna um único frete e limpa a transação ao voltar para pendente', () => {
    const h = setup();
    act(() => h.result.current.handleToggleSingleFreight('CARGA', 'c1', 'tx-single'));
    expect(h.getDatabase().Cargas[0]).toMatchObject({ freightStatus: 'PAID', transactionKey: 'tx-single' });
    act(() => h.result.current.handleToggleSingleFreight('CARGA', 'c1'));
    expect(h.getDatabase().Cargas[0]).toMatchObject({ freightStatus: 'PENDING', transactionKey: undefined, freightPaidAt: undefined });
  });

  it('não altera nem sincroniza um frete individual de mês fechado', () => {
    const h = setup(() => true);
    act(() => h.result.current.handleToggleSingleFreight('VENDA', 'v1'));
    expect(h.mutateDatabase).not.toHaveBeenCalled();
    expect(firebase.upsert).not.toHaveBeenCalled();
    expect(h.showToast).toHaveBeenCalledWith(expect.stringContaining('mês trancado'));
  });
});
