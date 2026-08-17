import React, { useState } from 'react';
import { KlabinDatabase, TableType, ResumoRecord } from '../types';
import { formatBRL, formatDate, formatNumber } from '../utils/formatters';
import { FechamentoCicloPanel } from './FechamentoCicloPanel';
import { TableResumo } from './TableResumo';
import {
  Truck,
  Building2,
  Package,
  Wallet,
  BarChart3,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  TreePine,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface DashboardOverviewProps {
  database: KlabinDatabase;
  onNavigate: (table: TableType) => void;
  lockedMonths?: string[];
  onToggleLockMonth?: (monthStr: string) => void;
  resumoRecords?: ResumoRecord[];
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  database,
  onNavigate,
  lockedMonths = [],
  onToggleLockMonth = () => {},
  resumoRecords,
}) => {
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);

  // Fallback metrics if resumoRecords is not provided directly
  const metricsList: ResumoRecord[] = resumoRecords || database.Resumo || [];

  // Compute Key Metrics
  const totalCargasTons = database.Cargas.reduce((acc, c) => acc + (Number(c.quantityTons) || 0), 0);
  const totalCargasValue = database.Cargas.reduce((acc, c) => acc + (Number(c.totalValue) || 0), 0);
  const totalCargasAbatidas = database.Cargas
    .filter((c) => c.deductFromBalance === true || c.deductFromBalance === 'YES')
    .reduce((acc, c) => acc + (Number(c.totalValue) || 0), 0);

  const totalDepositos = database.Depositos_Klabin.reduce((acc, d) => acc + (Number(d.value) || 0), 0);
  const availableKlabinBalance = totalDepositos - totalCargasAbatidas;

  // Sales Revenue (Vendas)
  const vendas = database.Vendas || [];
  const totalSalesPaidRevenue = vendas
    .filter((v) => v.status === 'PAID')
    .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
  const totalSalesPendingRevenue = vendas
    .filter((v) => v.status === 'PENDING')
    .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);

  const overallGeneralCash = availableKlabinBalance + totalSalesPaidRevenue;

  // Integrated Freight debt calculation from Cargas (where freightPayable !== false AND freightPayable !== 'NO' AND freightStatus !== 'PAID')
  const payableCargas = database.Cargas.filter(
    (c) => c.freightPayable !== false && c.freightPayable !== 'NO' && c.freightStatus !== 'PAID'
  );
  const totalFreightDebt = payableCargas.reduce((acc, c) => {
    const cost = c.freightCost !== undefined ? Number(c.freightCost) : (Number(c.quantityTons) || 0) * 15;
    return acc + cost;
  }, 0);
  const totalFreteTons = payableCargas.reduce((acc, c) => acc + (Number(c.quantityTons) || 0), 0);

  // Product Volume Breakdown
  const productVolumes: Record<string, number> = {};
  database.Cargas.forEach((c) => {
    const prod = c.product || 'Outros';
    productVolumes[prod] = (productVolumes[prod] || 0) + Number(c.quantityTons);
  });

  return (
    <div className="space-y-6">
      {/* Financial Overview - 3 Primary Elevated Cards */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-sm font-bold text-slate-100 tracking-tight">Sistema de Saldo Pré-Pago Klabin</h2>
          </div>
          <span className="text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2.5 py-0.5 rounded-full font-semibold">
            Status: Ativo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Available Klabin Balance */}
          <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/[0.04] text-slate-300 px-2.5 py-0.5 rounded-full border border-white/[0.08]">
                  Silo Financeiro Klabin
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                1. Saldo Disponível Klabin
              </p>
              <p className={`text-2xl lg:text-3xl font-extrabold font-mono tracking-tight mb-2 ${availableKlabinBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatBRL(availableKlabinBalance)}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-white/[0.07]">
              <span>Aportes: {formatBRL(totalDepositos)}</span>
              <button
                onClick={() => onNavigate('Depositos_Klabin')}
                className="hover:underline text-blue-400 flex items-center gap-1 font-semibold transition-opacity"
              >
                Depósitos <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Card 2: Total Spent on Cargo */}
          <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/[0.04] text-slate-300 px-2.5 py-0.5 rounded-full border border-white/[0.08]">
                  Silo Financeiro Klabin
                </span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                2. Total Gasto em Cargas
              </p>
              <p className="text-2xl lg:text-3xl font-extrabold font-mono tracking-tight text-slate-100 mb-2">
                {formatBRL(totalCargasValue)}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-white/[0.07]">
              <span>Abatido do Saldo: {formatBRL(totalCargasAbatidas)}</span>
              <button
                onClick={() => onNavigate('Cargas')}
                className="hover:underline text-blue-400 flex items-center gap-1 font-semibold"
              >
                Cargas <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Card 3: Total Freight Debt */}
          <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/[0.04] text-slate-300 px-2.5 py-0.5 rounded-full border border-white/[0.08]">
                  Silo Logística (Passivo Isolado)
                </span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                3. Total Fretes a Pagar
              </p>
              <p className="text-2xl lg:text-3xl font-extrabold font-mono tracking-tight text-amber-300 mb-2">
                {formatBRL(totalFreightDebt)}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-white/[0.07]">
              <span>{formatNumber(totalFreteTons)} t (R$ 15,00/ton)</span>
              <button
                onClick={() => onNavigate('Motoristas')}
                className="hover:underline text-blue-400 flex items-center gap-1 font-semibold"
              >
                Gestão Motoristas <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Dual-View Cash Flow Banner */}
        <div className="mt-4 glass-card-static rounded-2xl p-5 border border-white/[0.08] relative overflow-hidden">
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.07]">
            <span className="text-xs font-semibold text-slate-300">
              Visão Integrada de Fluxo Financeiro
            </span>
            <button
              onClick={() => onNavigate('Gestao_Clientes')}
              className="mac-button-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <span>Gerenciar Vendas & Clientes</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3.5">
            {/* View 1: Saldo de Adiantamentos Klabin */}
            <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Saldo de Adiantamentos Klabin
                </span>
                <span className="text-[10px] font-mono text-slate-400">Total Depósitos - Total Abatido</span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-slate-100 mt-1.5">
                {formatBRL(availableKlabinBalance)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Aportes: <span className="font-semibold text-slate-200">{formatBRL(totalDepositos)}</span> | Abatimento: <span className="font-semibold text-slate-200">{formatBRL(totalCargasAbatidas)}</span>
              </p>
            </div>

            {/* View 2: Caixa Geral / Receitas de Vendas */}
            <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Caixa Geral / Receitas de Vendas
                </span>
                <span className="text-[10px] font-mono text-amber-400 font-semibold">
                  Pendentes: {formatBRL(totalSalesPendingRevenue)}
                </span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-emerald-400 mt-1.5">
                {formatBRL(totalSalesPaidRevenue)} <span className="text-xs text-slate-400 font-normal">Recebidos (PAGO)</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Saldo Consolidado (Klabin + Vendas): <strong className="text-slate-100 font-mono font-semibold">{formatBRL(overallGeneralCash)}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Core Nav Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          onClick={() => onNavigate('Cargas')}
          className="glass-card p-4 text-left group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Truck className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 transition-colors" />
          </div>
          <span className="text-xs font-bold text-slate-100 block">Tabela: Cargas</span>
          <span className="text-[11px] font-mono text-slate-200 block mt-0.5 font-semibold">
            {formatNumber(totalCargasTons)} t
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{database.Cargas.length} registros</span>
        </button>

        <button
          onClick={() => onNavigate('Depositos_Klabin')}
          className="glass-card p-4 text-left group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Building2 className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 transition-colors" />
          </div>
          <span className="text-xs font-bold text-slate-100 block">Tabela: Depósitos</span>
          <span className="text-[11px] font-mono text-slate-200 block mt-0.5 font-semibold">
            {formatBRL(totalDepositos)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{database.Depositos_Klabin.length} aportes</span>
        </button>

        <button
          onClick={() => onNavigate('Motoristas')}
          className="glass-card p-4 text-left group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <Truck className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 transition-colors" />
          </div>
          <span className="text-xs font-bold text-slate-100 block">Gestão Motoristas</span>
          <span className="text-[11px] font-mono text-amber-300 block mt-0.5 font-semibold">
            {formatBRL(totalFreightDebt)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Fretes por Motorista/Placa</span>
        </button>

        <button
          onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
          className="glass-card p-4 text-left group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <BarChart3 className="w-4 h-4" />
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 group-hover:text-slate-200 transition-transform duration-200 ${showDetailedMetrics ? 'rotate-180' : ''}`} />
          </div>
          <span className="text-xs font-bold text-slate-100 block">Métricas Detalhadas</span>
          <span className="text-[11px] font-mono text-slate-200 block mt-0.5 font-semibold">
            {metricsList.length} Indicadores
          </span>
          <span className="text-[10px] text-blue-400 block mt-0.5 font-medium">
            {showDetailedMetrics ? '▲ Ocultar' : '▼ Ver Detalhes'}
          </span>
        </button>
      </div>

      {/* Expandable Detailed Metrics Section */}
      <div className="glass-card p-5 transition-all">
        <button
          onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
          className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm group-hover:text-white transition-colors">
                Resumo Detalhado de Indicadores & Métricas
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="mac-button-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <span>{showDetailedMetrics ? 'Ocultar detalhamento' : 'Ver detalhamento completo'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showDetailedMetrics ? 'rotate-180' : ''}`} />
            </span>
          </div>
        </button>

        {showDetailedMetrics && (
          <div className="mt-5 pt-5 border-t border-white/[0.07] animate-in fade-in duration-200">
            <TableResumo records={metricsList} searchTerm="" />
          </div>
        )}
      </div>

      {/* Middle Section: Volume Breakdown + Recent Cargas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Product Volume Distribution */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-100 text-xs tracking-tight flex items-center gap-2">
                <TreePine className="w-4 h-4 text-blue-400" />
                <span>Volume por Tipologia de Madeira</span>
              </h3>
              <span className="text-[11px] font-mono font-bold text-slate-200 bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-md">
                {formatNumber(totalCargasTons)} t Total
              </span>
            </div>

            <div className="space-y-3">
              {Object.entries(productVolumes).map(([prod, vol]) => {
                const percentage = totalCargasTons > 0 ? (vol / totalCargasTons) * 100 : 0;
                return (
                  <div key={prod} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-300">
                      <span>{prod}</span>
                      <span className="font-mono text-slate-400">{formatNumber(vol)} t ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-white/[0.07] flex items-center justify-between text-xs text-slate-400">
            <span>Abatimento de Saldo Aprovado</span>
            <span className="font-mono font-bold text-slate-100">{formatBRL(totalCargasAbatidas)}</span>
          </div>
        </div>

        {/* Recent Cargas */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-100 text-xs tracking-tight">Últimas Cargas Recebidas</h3>
            </div>
            <button
              onClick={() => onNavigate('Cargas')}
              className="text-xs text-blue-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mac-table-container">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">NF</th>
                  <th className="py-2.5 px-3">Fornecedor</th>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3 text-right">Volume</th>
                  <th className="py-2.5 px-3 text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[...database.Cargas]
                  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                  .slice(0, 5)
                  .map((c) => (
                  <tr key={c.id} className="mac-table-row">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{formatDate(c.date)}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-200">{c.invoiceNumber}</td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-[150px]">{c.supplier}</td>
                    <td className="py-2.5 px-3 text-slate-400">{c.product}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-200">{formatNumber(c.quantityTons)} t</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-100">{formatBRL(c.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Fechamento de Ciclo (Trancamento de Período) */}
      <FechamentoCicloPanel
        cargas={database.Cargas}
        vendas={database.Vendas || []}
        depositos={database.Depositos_Klabin}
        lockedMonths={lockedMonths}
        onToggleLockMonth={onToggleLockMonth}
      />
    </div>
  );
};
