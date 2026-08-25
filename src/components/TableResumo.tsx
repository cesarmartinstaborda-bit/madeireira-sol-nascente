import React from 'react';
import { ResumoRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { FileText } from 'lucide-react';

interface TableResumoProps {
  records: ResumoRecord[];
  searchTerm: string;
}

export const TableResumo: React.FC<TableResumoProps> = ({ records, searchTerm }) => {
  const filtered = records.filter((r) => {
    if (!searchTerm) return true;
    return r.metricName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="glass-card-static overflow-hidden">
      <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
        <h2 className="text-sm font-bold text-white flex items-center space-x-2">
          <FileText className="w-4 h-4 text-[var(--graphite-accent-blue)]" />
          <span>Resumo Financeiro e Operacional ({filtered.length})</span>
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="mac-table-header">
              <th className="p-4">Indicador / Métrica</th>
              <th className="p-4 text-right">Valor Consolidado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
            {filtered.map((r) => {
              const isCurrency = r.metricName.includes('(R$)');
              const isTon = r.metricName.includes('(Toneladas)');

              return (
                <tr key={r.id} className="mac-table-row">
                  <td className="p-4 font-semibold text-white">{r.metricName}</td>
                  <td className="p-4 text-right font-extrabold text-sm text-emerald-400 font-mono">
                    {isCurrency
                      ? formatCurrency(r.metricValue)
                      : isTon
                      ? `${formatNumber(r.metricValue, 2)} Ton`
                      : formatNumber(r.metricValue, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
