import { act, cleanup, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';
import { useProdutoHandlers } from '../hooks/useProdutoHandlers';
import { useMotoristaHandlers } from '../hooks/useMotoristaHandlers';
import { useClienteVendaHandlers } from '../hooks/useClienteVendaHandlers';
import { computeDashboardMetrics } from '../utils/dashboard/computedMetrics';
const cloud = vi.hoisted(() => ({ upsert: vi.fn(), remove: vi.fn() }));
vi.mock('../utils/firebaseSync', () => ({ upsertFirestoreRecord: cloud.upsert, deleteFirestoreRecord: cloud.remove }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup(locked = false) {
  return renderHook(() => {
    const [database, mutateDatabase] = useState(regressionDatabase());
    const params = { database, mutateDatabase, showToast: vi.fn(), isDateLocked: () => locked };
    return { database, ...useProdutoHandlers(params), ...useMotoristaHandlers(params), ...useClienteVendaHandlers(params) };
  });
}
it('cria, edita e exclui produtos e motoristas livres, inativando os que têm histórico', () => {
  const { result } = setup();
  act(() => result.current.handleAddProduto({ name: 'Produto auditoria', referencePrice: 80 }));
  const product = result.current.database.Produtos!.at(-1)!;
  act(() => result.current.handleUpdateProduto({ ...product, referencePrice: 120 }));
  expect(result.current.database.Produtos!.at(-1)!.referencePrice).toBe(120);
  act(() => result.current.handleDeleteProduto(product.id));
  expect(result.current.database.Produtos).toHaveLength(1);
  act(() => result.current.handleDeleteProduto('p1'));
  expect(result.current.database.Produtos![0].status).toBe('INACTIVE');
  const driver = { ...result.current.database.Motoristas![0], id: 'new-driver', name: 'Novo', licensePlate: 'XYZ-1234' };
  act(() => result.current.handleAddMotorista(driver));
  act(() => result.current.handleUpdateMotorista({ ...driver, name: 'Editado' }));
  expect(result.current.database.Motoristas!.at(-1)!.name).toBe('Editado');
  act(() => result.current.handleDeleteDriver(driver.id));
  act(() => result.current.handleDeleteDriver('m1'));
  expect(result.current.database.Motoristas).toHaveLength(1);
  expect(result.current.database.Motoristas![0].status).toBe('INACTIVE');
  expect(result.current.database.Cargas).toEqual(regressionDatabase().Cargas);
  expect(result.current.database.Vendas).toEqual(regressionDatabase().Vendas);
  expect(cloud.remove.mock.calls).toEqual([['produtos', product.id], ['motoristas', driver.id]]);
});
it('cria, edita e exclui cliente e venda mantendo totais e demais registros', () => {
  const { result } = setup();
  act(() => result.current.handleAddClient({ name: 'Cliente novo' }));
  const client = result.current.database.Clientes!.at(-1)!;
  act(() => result.current.handleUpdateClient({ ...client, contact: 'Contato novo' }));
  expect(result.current.database.Clientes!.at(-1)!.contact).toBe('Contato novo');
  act(() => result.current.handleAddVenda({ date: '2026-09-01', clientId: client.id, clientName: client.name, product: 'Pinus Teste', quantity: 2.5, unitPrice: 120 }));
  const sale = result.current.database.Vendas!.at(-1)!;
  expect(sale.totalValue).toBe(300);
  act(() => result.current.handleUpdateVenda({ ...sale, quantity: 3, totalValue: 360 }));
  expect(result.current.database.Vendas!.at(-1)!.totalValue).toBe(360);
  act(() => result.current.handleDeleteVenda(sale.id));
  act(() => result.current.handleDeleteClient(client.id));
  expect(result.current.database.Vendas).toEqual(regressionDatabase().Vendas);
  expect(result.current.database.Clientes).toEqual(regressionDatabase().Clientes);
  expect(cloud.remove.mock.calls).toEqual([['vendas', sale.id], ['clientes', client.id]]);
});
it('mês fechado bloqueia criação, edição, exclusão e quitação de venda sem escrita remota', () => {
  const { result } = setup(true);
  const before = result.current.database;
  act(() => { result.current.handleAddVenda(before.Vendas![0]); result.current.handleUpdateVenda({ ...before.Vendas![0], totalValue: 999 }); result.current.handleDeleteVenda('v1'); result.current.handleToggleVendaStatus('v1'); });
  expect(result.current.database).toBe(before);
  expect(cloud.upsert).not.toHaveBeenCalled();
  expect(cloud.remove).not.toHaveBeenCalled();
});
it('indicadores reconciliam depósitos, compras, volume, fretes e caixa sem misturar vendas no saldo Klabin', () => {
  const metrics = computeDashboardMetrics(regressionDatabase());
  expect(metrics).toMatchObject({ totalVolumeTons: 2, totalComprasVal: 200, totalAbatido: 200, totalDepositos: 1000, saldoLiquidoKlabin: 800, totalFreteVal: 75, totalFreteTons: 5, avgFretePerTon: 15 });
  expect(metrics.caixaRecords.map(r => r.value)).toEqual([1000, -200, 800]);
});
