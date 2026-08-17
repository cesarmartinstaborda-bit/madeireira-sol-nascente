import React from 'react';
import { ResumoRecord } from '../types';
import { formatBRL, formatNumber } from '../utils/formatters';
import { BarChart3, CheckCircle2, TrendingUp, DollarSign, Scale, Layers, Zap } from 'lucide-react';

interface TableResumoProps {
  records: ResumoRecord[];
  searchTerm: string;
}

export const TableResumo: React.FC<TableResumoProps> = ({
  records,
  searchTerm,
}) => {
  const filtered = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      !term ||
      r.metricName.toLowerCase().includes(term) ||
      r.metricValue.toString().includes(term)
    );
  });

  // Helper to choose display format based on metric name
  const formatMetricDisplay = (name: string, val: number) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('tonelada') || lowerName.includes('volume') || lowerName.includes(' (ton)')) {
      return `${formatNumber(val)} t`;
    }
    return formatBRL(val);
  };

  return (
    <div className="space-y-4">
      {/* Live Sync Callout Header */}
      <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <BarChart3 className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-xs">Resumo Consolidado de Indicadores</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <Zap className="w-3 h-3 text-blue-400" /> Em Tempo Real
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Metric Cards Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {records.map((m) => {
          const lowerName = m.metricName.toLowerCase();
          let icon = <Layers className="w-4.5 h-4.5 text-blue-400" />;

          if (lowerName.includes('volume') || lowerName.includes('tonelada')) {
            icon = <Scale className="w-4.5 h-4.5 text-blue-400" />;
          } else if (lowerName.includes('saldo') || lowerName.includes('disponível')) {
            icon = <DollarSign className="w-4.5 h-4.5 text-emerald-400" />;
          } else if (lowerName.includes('frete')) {
            icon = <TrendingUp className="w-4.5 h-4.5 text-amber-400" />;
          }

          return (
            <div key={m.id} className="glass-card p-3.5 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {m.metricName}
                </span>
                <span className="text-xl font-bold font-mono text-slate-100">
                  {formatMetricDisplay(m.metricName, m.metricValue)}
                </span>
              </div>
              <div className="p-2 rounded-xl border bg-white/[0.04] border-white/[0.08]">{icon}</div>
            </div>
          );
        })}
      </div>

      {/* Main Table */}
      <div className="mac-table-container">
        <div className="p-3.5 border-b border-white/[0.07] flex items-center justify-between bg-white/[0.02]">
          <div>
            <h3 className="font-bold text-slate-100 text-xs">Tabela de Indicadores da Operação</h3>
          </div>
          <span className="text-[11px] font-mono bg-white/[0.04] text-slate-300 border border-white/[0.08] px-2.5 py-0.5 rounded-full font-semibold">
            {filtered.length} Métricas Ativas
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">Nenhuma métrica encontrada para o filtro</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-4">Nome da Métrica</th>
                  <th className="py-2.5 px-4 text-right">Valor Numérico Bruto</th>
                  <th className="py-2.5 px-4 text-right">Visualização Formatada</th>
                  <th className="py-2.5 px-4 text-center w-32">Origem dos Dados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((item) => (
                  <tr key={item.id} className="mac-table-row">
                    <td className="py-2.5 px-4 font-semibold text-slate-100 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{item.metricName}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-400 whitespace-nowrap">
                      {item.metricValue}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                      {formatMetricDisplay(item.metricName, item.metricValue)}
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 bg-white/[0.04] text-slate-400 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-white/[0.08]">
                        Cargas / Depósitos
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
