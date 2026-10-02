import { describe, expect, it } from 'vitest';
import { CargaRecord, DepositoKlabinRecord, KlabinDatabase } from '../types';
import {
  calcOpenKlabinBalance,
  splitKlabinRecordsByCompetency,
} from '../utils/klabinBalance';
import { computeDashboardMetrics } from '../utils/dashboard/computedMetrics';

const carga = (id: string, date: string, totalValue: number): CargaRecord => ({
  id,
  date,
  product: 'Pinus',
  productId: 'p1',
  quantityTons: 1,
  valuePerTon: totalValue,
  totalValue,
  deductFromBalance: true,
} as CargaRecord);

const deposito = (id: string, date: string, value: number): DepositoKlabinRecord => ({
  id,
  date,
  value,
  notes: '',
} as DepositoKlabinRecord);

// Julho aberto, Agosto trancado.
const cargas = [carga('c-jul', '2026-07-10', 150), carga('c-ago', '2026-08-20', 200)];
const depositos = [deposito('d-jul', '2026-07-11', 500), deposito('d-ago', '2026-08-21', 1000)];
const lockedMonths = ['2026-08'];

describe('splitKlabinRecordsByCompetency', () => {
  it('separa cargas e depósitos entre competência aberta e trancada', () => {
    const result = splitKlabinRecordsByCompetency(cargas, depositos, lockedMonths);
    expect(result.openCargas.map((c) => c.id)).toEqual(['c-jul']);
    expect(result.closedCargas.map((c) => c.id)).toEqual(['c-ago']);
    expect(result.openDepositos.map((d) => d.id)).toEqual(['d-jul']);
    expect(result.closedDepositos.map((d) => d.id)).toEqual(['d-ago']);
  });

  it('sem meses trancados, tudo fica aberto', () => {
    const result = splitKlabinRecordsByCompetency(cargas, depositos, []);
    expect(result.openCargas).toHaveLength(2);
    expect(result.closedCargas).toHaveLength(0);
  });
});

describe('calcOpenKlabinBalance — regra do Saldo Livre Klabin', () => {
  it('competências abertas entram no saldo', () => {
    const { saldo } = calcOpenKlabinBalance(cargas, depositos, lockedMonths);
    expect(saldo).toBe(350); // 500 (depósito jul) - 150 (carga jul)
  });

  it('competências trancadas NÃO entram no saldo', () => {
    const { saldo } = calcOpenKlabinBalance(cargas, depositos, lockedMonths);
    // Se a competência de agosto (saldo 800) entrasse, o total seria 1150.
    expect(saldo).not.toBe(1150);
  });

  it('destrancar uma competência volta a incluí-la no saldo', () => {
    const { saldo: saldoTrancado } = calcOpenKlabinBalance(cargas, depositos, ['2026-08']);
    const { saldo: saldoDestrancado } = calcOpenKlabinBalance(cargas, depositos, []);
    expect(saldoTrancado).toBe(350);
    expect(saldoDestrancado).toBe(1150);
  });
});

describe('computeDashboardMetrics — mesma fonte usada por Header/Configurações/Resumo/Caixa', () => {
  const baseDatabase: KlabinDatabase = {
    Cargas: cargas,
    Depositos_Klabin: depositos,
    Frete: [],
    Clientes: [],
    Produtos: [],
    Motoristas: [],
    Vendas: [],
    appSettings: { freightRatePerTon: 15, cycles: { lockedMonths } },
  } as unknown as KlabinDatabase;

  it('saldoLiquidoKlabin reflete só a competência aberta', () => {
    const metrics = computeDashboardMetrics(baseDatabase);
    expect(metrics.saldoLiquidoKlabin).toBe(350);
    expect(metrics.totalDepositos).toBe(500);
    expect(metrics.totalAbatido).toBe(150);
  });

  it('destrancar o mês no appSettings muda o saldo calculado', () => {
    const reaberta: KlabinDatabase = {
      ...baseDatabase,
      appSettings: { ...baseDatabase.appSettings, cycles: { lockedMonths: [] } },
    };
    const metrics = computeDashboardMetrics(reaberta);
    expect(metrics.saldoLiquidoKlabin).toBe(1150);
  });

  it('volume e valor total de compras continuam refletindo o banco inteiro (indicador diferente, fora de escopo)', () => {
    const metrics = computeDashboardMetrics(baseDatabase);
    expect(metrics.totalComprasVal).toBe(350); // 150 + 200, as duas cargas
  });
});
