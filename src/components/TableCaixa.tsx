import React from 'react';
import { CaixaRecord } from '../types';
import { formatCurrency } from '../utils/formatters';
import { Wallet } from 'lucide-react';

interface TableCaixaProps {
  records: CaixaRecord[];
  searchTerm: string;
}

export const TableCaixa: React.FC<TableCaixaProps> = ({ records, searchTerm }) => {
  const filtered = records.filter((r) => {
    if (!searchTerm) return true;
    return r.balanceControlKlabin.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="glass-card-static overflow-hidden">
      <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
        <h2 className="text-sm font-bold text-white flex items-center space-x-2">
          <Wallet className="w-4 h-4 text-[var(--graphite-accent-blue)]" />
          <span>Fluxo de Caixa Operacional ({filtered.length})</span>
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="mac-table-header">
              <th className="p-4">Controle de Saldo Klabin</th>
              <th className="p-4 text-right">Valor Operacional (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
            {filtered.map((r) => (
              <tr key={r.id} className="mac-table-row">
                <td className="p-4 font-semibold text-white">{r.balanceControlKlabin}</td>
                <td
                  className={`p-4 text-right font-extrabold text-sm font-mono ${
                    r.value < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(r.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
