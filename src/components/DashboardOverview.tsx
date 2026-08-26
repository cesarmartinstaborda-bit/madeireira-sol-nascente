import React, { useState } from 'react';
import { KlabinDatabase, TableType } from '../types';
import { formatBRL, formatNumber, formatDateBR } from '../utils/formatters';
import { getPendingFreightTotal, getPaidFreightTotal, getTotalFreight } from '../utils/freightUtils';
import { calcKlabinBalance } from '../utils/klabinBalance';
import {
  Wallet,
  Truck,
  Building2,
  Users,
  Lock,
  Unlock,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';

interface DashboardOverviewProps {
  database: KlabinDatabase;
  onNavigate: (table: TableType) => void;
  lockedMonths?: string[];
  onToggleLockMonth: (monthStr: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  database,
  onNavigate,
  lockedMonths = [],
  onToggleLockMonth,
}) => {
  const [activeViewMode, setActiveViewMode] = useState<'VISAO_GERAL' | 'FLUXO_CAIXA' | 'RESUMO_VOLUMES'>('VISAO_GERAL');

  // Calculations
  const totalVolumeTons = database.Cargas.reduce((acc, c) => acc + (Number(c.quantityTons) || 0), 0);
  const totalComprasVal = database.Cargas.reduce((acc, c) => acc + (Number(c.totalValue) || 0), 0);
  const { totalDepositos, totalAbatido, saldo: saldoLiquidoKlabin } = calcKlabinBalance({
    cargas: database.Cargas,
    depositos: database.Depositos_Klabin,
  });

  // Unified Fretes metrics (Cargas + Vendas com frete a pagar)
  const totalFretesPending = getPendingFreightTotal(database);
  const totalFretesPaid = getPaidFreightTotal(database);
  const totalFretesGeral = getTotalFreight(database);

  // Vendas metrics
  const totalVendasVal = (database.Vendas || []).reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
  const totalVendasRecebidas = (database.Vendas || [])
    .filter((v) => v.status === 'PAID')
    .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
  const totalVendasPendentes = totalVendasVal - totalVendasRecebidas;

  // Volume by Product
  const volumeByProduct = React.useMemo(() => {
    const map: Record<string, { tons: number; value: number }> = {};
    database.Cargas.forEach((c) => {
      const prod = c.product || 'Outros';
      if (!map[prod]) map[prod] = { tons: 0, value: 0 };
      map[prod].tons += Number(c.quantityTons) || 0;
      map[prod].value += Number(c.totalValue) || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].tons - a[1].tons);
  }, [database.Cargas]);

  // Available months in dataset for Fechamento de Ciclo
  const availableMonths = React.useMemo(() => {
    const monthSet = new Set<string>();
    database.Cargas.forEach((c) => {
      if (c.date && c.date.length >= 7) monthSet.add(c.date.slice(0, 7));
    });
    database.Depositos_Klabin.forEach((d) => {
      if (d.date && d.date.length >= 7) monthSet.add(d.date.slice(0, 7));
    });
    (database.Vendas || []).forEach((v) => {
      if (v.date && v.date.length >= 7) monthSet.add(v.date.slice(0, 7));
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    monthSet.add(currentMonth);

    return Array.from(monthSet).sort().reverse();
  }, [database]);

  // Recent activity combined
  const recentMovements = React.useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      title: string;
      subtitle: string;
      value: number;
      type: 'CARGA' | 'DEPOSITO' | 'VENDA';
    }> = [];

    database.Cargas.slice(-6).forEach((c) => {
      list.push({
        id: c.id,
        date: c.date,
        title: `Carga: ${c.supplier || 'Fornecedor'} (${c.product || 'Madeira'})`,
        subtitle: `${formatNumber(c.quantityTons, 2)} Ton - NF ${c.invoiceNumber || 'S/N'}`,
        value: Number(c.totalValue) || 0,
        type: 'CARGA',
      });
    });

    database.Depositos_Klabin.slice(-6).forEach((d) => {
      list.push({
        id: d.id,
        date: d.date,
        title: 'Depósito / Adiantamento Klabin',
        subtitle: d.notes || 'Entrada Financeira',
        value: Number(d.value) || 0,
        type: 'DEPOSITO',
      });
    });

    (database.Vendas || []).slice(-6).forEach((v) => {
      list.push({
        id: v.id,
        date: v.date,
        title: `Venda Direta: ${v.clientName}`,
        subtitle: `${v.product} (${v.quantity} un/ton)`,
        value: Number(v.totalValue) || 0,
        type: 'VENDA',
      });
    });

    return list.sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 8);
  }, [database]);

  return (
    <div className="space-y-6">
      {/* Primary Balance Hero Card - Graphite Pro */}
      <div className="glass-card p-6 border-l-4 border-l-[var(--graphite-accent-blue)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <Wallet className="w-4 h-4" />
              <span>Saldo Operacional Livre Klabin</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-mono ${
              saldoLiquidoKlabin >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {formatBRL(saldoLiquidoKlabin)}
            </h2>
            <p className="text-xs text-[var(--graphite-text-secondary)] mt-1.5 font-medium">
              Total Depósitos ({formatBRL(totalDepositos)}) − Total Cargas Abatidas ({formatBRL(totalAbatido)})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('Klabin')}
              className="mac-button-primary"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Módulo Klabin</span>
            </button>
            <button
              onClick={() => onNavigate('Clientes_Produtos')}
              className="mac-button-secondary"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Clientes & Vendas</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Volume */}
        <div
          onClick={() => onNavigate('Klabin')}
          className="glass-card p-4 cursor-pointer hover:border-[var(--graphite-border-base)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Volume Florestal</span>
            <div className="p-1.5 bg-[#232832] text-amber-400 rounded-lg border border-[var(--graphite-border-subtle)]">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-white font-mono">{formatNumber(totalVolumeTons, 2)} Ton</div>
          <div className="text-[11px] text-[var(--graphite-text-secondary)] mt-1">
            {database.Cargas.length} cargas lançadas
          </div>
        </div>

        {/* Total Cargas Compras */}
        <div
          onClick={() => onNavigate('Klabin')}
          className="glass-card p-4 cursor-pointer hover:border-[var(--graphite-border-base)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Cargas</span>
            <div className="p-1.5 bg-[#232832] text-blue-400 rounded-lg border border-[var(--graphite-border-subtle)]">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-white font-mono">{formatBRL(totalComprasVal)}</div>
          <div className="text-[11px] text-[var(--graphite-text-secondary)] mt-1">
            Abatido: {formatBRL(totalAbatido)}
          </div>
        </div>

        {/* Depósitos Klabin */}
        <div
          onClick={() => onNavigate('Klabin')}
          className="glass-card p-4 cursor-pointer hover:border-[var(--graphite-border-base)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Depósitos Klabin</span>
            <div className="p-1.5 bg-[#232832] text-emerald-400 rounded-lg border border-[var(--graphite-border-subtle)]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">{formatBRL(totalDepositos)}</div>
          <div className="text-[11px] text-[var(--graphite-text-secondary)] mt-1">
            {database.Depositos_Klabin.length} adiantamentos creditados
          </div>
        </div>

        {/* Fretes & Terceiros */}
        <div
          onClick={() => onNavigate('Motoristas')}
          className="glass-card p-4 cursor-pointer hover:border-[var(--graphite-border-base)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fretes a Pagar</span>
            <div className="p-1.5 bg-[#232832] text-rose-400 rounded-lg border border-[var(--graphite-border-subtle)]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-400 font-mono">{formatBRL(totalFretesPending)}</div>
          <div className="text-[11px] text-[var(--graphite-text-secondary)] mt-1">
            Quitados: {formatBRL(totalFretesPaid)}
          </div>
        </div>
      </div>

      {/* Mode Selector for Integrated Views (Sub-panels of Dashboard) */}
      <div className="flex items-center justify-between border-b border-[var(--graphite-border-subtle)] pb-3">
        <div className="mac-segmented-control">
          <button
            onClick={() => setActiveViewMode('VISAO_GERAL')}
            className={`mac-segmented-item ${activeViewMode === 'VISAO_GERAL' ? 'mac-segmented-item-active' : ''}`}
          >
            <span>Visão Integrada</span>
          </button>
          <button
            onClick={() => setActiveViewMode('FLUXO_CAIXA')}
            className={`mac-segmented-item ${activeViewMode === 'FLUXO_CAIXA' ? 'mac-segmented-item-active' : ''}`}
          >
            <span>Demonstrativo de Caixa</span>
          </button>
          <button
            onClick={() => setActiveViewMode('RESUMO_VOLUMES')}
            className={`mac-segmented-item ${activeViewMode === 'RESUMO_VOLUMES' ? 'mac-segmented-item-active' : ''}`}
          >
            <span>Volumes por Madeira</span>
          </button>
        </div>

        <span className="text-xs text-[var(--graphite-text-tertiary)]">
          Consolidação Operacional & Financeira
        </span>
      </div>

      {/* Sub-view Content */}
      {activeViewMode === 'FLUXO_CAIXA' && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Demonstrativo Consolidado de Fluxo de Caixa</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)] space-y-2">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Entradas Totais</div>
              <div className="text-lg font-bold text-white font-mono">{formatBRL(totalDepositos + totalVendasRecebidas)}</div>
              <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-[var(--graphite-border-subtle)]">
                <div className="flex justify-between">
                  <span>Depósitos Klabin:</span>
                  <span className="font-mono">{formatBRL(totalDepositos)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vendas Quitadas:</span>
                  <span className="font-mono">{formatBRL(totalVendasRecebidas)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)] space-y-2">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Saídas & Abatimentos</div>
              <div className="text-lg font-bold text-white font-mono">{formatBRL(totalAbatido + totalFretesPaid)}</div>
              <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-[var(--graphite-border-subtle)]">
                <div className="flex justify-between">
                  <span>Cargas Abatidas:</span>
                  <span className="font-mono">{formatBRL(totalAbatido)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fretes Pagos:</span>
                  <span className="font-mono">{formatBRL(totalFretesPaid)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)] space-y-2">
              <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Compromissos Pendentes</div>
              <div className="text-lg font-bold text-white font-mono">{formatBRL(totalFretesPending)}</div>
              <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-[var(--graphite-border-subtle)]">
                <div className="flex justify-between">
                  <span>Fretes a Pagar:</span>
                  <span className="font-mono text-rose-400">{formatBRL(totalFretesPending)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vendas a Receber:</span>
                  <span className="font-mono text-emerald-400">{formatBRL(totalVendasPendentes)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeViewMode === 'RESUMO_VOLUMES' && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-bold text-white text-sm">Distribuição de Volumes por Tipologia de Madeira</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-4">Produto / Madeira</th>
                  <th className="py-2.5 px-4 text-right">Volume (Ton)</th>
                  <th className="py-2.5 px-4 text-right">% Volume</th>
                  <th className="py-2.5 px-4 text-right">Valor Total (R$)</th>
                  <th className="py-2.5 px-4 text-right">Preço Médio / Ton</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--graphite-border-subtle)]">
                {volumeByProduct.map(([prod, stats]) => {
                  const pct = totalVolumeTons > 0 ? (stats.tons / totalVolumeTons) * 100 : 0;
                  const avgPrice = stats.tons > 0 ? stats.value / stats.tons : 0;

                  return (
                    <tr key={prod} className="mac-table-row">
                      <td className="py-3 px-4 font-bold text-white">{prod}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-200">{formatNumber(stats.tons, 2)} Ton</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">{formatNumber(pct, 1)}%</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">{formatBRL(stats.value)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">{formatBRL(avgPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fechamento de Ciclo & Recent Activity Dual Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fechamento de Ciclo (Locked Months) */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-white font-bold text-sm mb-1">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Fechamento de Competências</span>
            </div>
            <p className="text-xs text-[var(--graphite-text-secondary)] mb-4">
              Bloqueie meses encerrados para proteger lançamentos de cargas e depósitos contra alterações.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {availableMonths.map((m) => {
                const isLocked = Array.isArray(lockedMonths) && lockedMonths.includes(m);
                const [year, month] = m.split('-');
                const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                });

                return (
                  <div
                    key={m}
                    className="flex items-center justify-between p-2.5 bg-[#14171d] rounded-lg border border-[var(--graphite-border-subtle)] text-xs"
                  >
                    <span className="font-semibold text-slate-200 capitalize">{monthName}</span>
                    <button
                      onClick={() => onToggleLockMonth(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1.5 transition-all ${
                        isLocked
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800/80 hover:bg-amber-900/60'
                          : 'bg-[#232832] text-slate-300 border border-[var(--graphite-border-subtle)] hover:bg-[#2c3340]'
                      }`}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>Trancado</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3 text-slate-400" />
                          <span>Aberto</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="lg:col-span-2 glass-card p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Últimas Movimentações Operacionais</span>
          </h3>

          <div className="divide-y divide-[var(--graphite-border-subtle)]">
            {recentMovements.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">Nenhuma movimentação cadastrada.</div>
            ) : (
              recentMovements.map((mov) => (
                <div
                  key={mov.id}
                  className="py-2.5 flex items-center justify-between text-xs hover:bg-[var(--graphite-surface-2)] px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-md shrink-0 ${
                        mov.type === 'DEPOSITO'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                          : mov.type === 'CARGA'
                          ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                          : 'bg-purple-950/60 text-purple-400 border border-purple-800/60'
                      }`}
                    >
                      {mov.type === 'DEPOSITO' ? (
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-200 block truncate">{mov.title}</span>
                      <span className="text-slate-400 text-[10px] block truncate">{mov.subtitle}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span
                      className={`font-bold font-mono text-xs block ${
                        mov.type === 'DEPOSITO' ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {formatBRL(mov.value)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">{formatDateBR(mov.date)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
