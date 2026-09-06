import { CaixaRecord, KlabinDatabase, ResumoRecord } from '../../types';
import { getFreightRecords, getTotalFreight } from '../freightUtils';
import { calcKlabinBalance } from '../klabinBalance';

export function computeDashboardMetrics(database: KlabinDatabase) {
  const totalVolumeTons = database.Cargas.reduce(
    (acc, c) => acc + (Number(c.quantityTons) || 0),
    0
  );

  const totalComprasVal = database.Cargas.reduce(
    (acc, c) => acc + (Number(c.totalValue) || 0),
    0
  );

  const { totalDepositos, totalAbatido, saldo: saldoLiquidoKlabin } = calcKlabinBalance({
    cargas: database.Cargas,
    depositos: database.Depositos_Klabin,
  });
  const freightRatePerTon = database.appSettings?.freightRatePerTon || 15;

  const allFreightRecords = getFreightRecords(database);
  const totalFreteVal = getTotalFreight(database);

  const totalFreteTons = allFreightRecords.reduce(
    (acc, r) => acc + (Number(r.tons) || 0),
    0
  );

  const avgFretePerTon = totalFreteTons > 0 ? totalFreteVal / totalFreteTons : freightRatePerTon;

  const resumoRecords: ResumoRecord[] = [
    { id: 'res-dyn-1', metricName: 'Total Volume Cargas (Toneladas)', metricValue: Number(totalVolumeTons.toFixed(2)) },
    { id: 'res-dyn-2', metricName: 'Valor Total Compras de Cargas (R$)', metricValue: Number(totalComprasVal.toFixed(2)) },
    { id: 'res-dyn-3', metricName: 'Total Abatido do Saldo Klabin (R$)', metricValue: Number(totalAbatido.toFixed(2)) },
    { id: 'res-dyn-4', metricName: 'Total Depósitos Recebidos Klabin (R$)', metricValue: Number(totalDepositos.toFixed(2)) },
    { id: 'res-dyn-5', metricName: 'Saldo Líquido Disponível Klabin (R$)', metricValue: Number(saldoLiquidoKlabin.toFixed(2)) },
    { id: 'res-dyn-6', metricName: 'Custo Total de Fretes (R$)', metricValue: Number(totalFreteVal.toFixed(2)) },
    { id: 'res-dyn-7', metricName: 'Custo Médio de Frete / Tonelada (R$)', metricValue: Number(avgFretePerTon.toFixed(2)) },
  ];

  const caixaRecords: CaixaRecord[] = [
    {
      id: 'cx-dyn-1',
      balanceControlKlabin: 'Adiantamento Depósitos Klabin (Entrada de Caixa)',
      value: Number(totalDepositos.toFixed(2)),
    },
    {
      id: 'cx-dyn-2',
      balanceControlKlabin: 'Abatimento Saldo Cargas Fornecidas Klabin',
      value: -Number(totalAbatido.toFixed(2)),
    },
    {
      id: 'cx-dyn-3',
      balanceControlKlabin: 'Saldo Atualizado de Caixa Operacional Klabin',
      value: Number(saldoLiquidoKlabin.toFixed(2)),
    },
  ];

  return {
    totalVolumeTons,
    totalComprasVal,
    totalAbatido,
    totalDepositos,
    saldoLiquidoKlabin,
    totalFreteVal,
    totalFreteTons,
    avgFretePerTon,
    resumoRecords,
    caixaRecords,
  };
}
