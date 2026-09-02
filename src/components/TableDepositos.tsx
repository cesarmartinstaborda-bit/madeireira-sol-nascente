import React from 'react';
import { DepositoKlabinRecord } from '../types';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import { sumDepositos } from '../utils/klabinBalance';
import { Building2, Plus, Edit2, Trash2, Lock } from 'lucide-react';
import { sortByDateDescending } from '../utils/dateSorting';

interface TableDepositosProps {
  records: DepositoKlabinRecord[];
  searchTerm: string;
  onEdit: (record: DepositoKlabinRecord) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  lockedMonths?: string[];
}

export const TableDepositos: React.FC<TableDepositosProps> = ({
  records,
  searchTerm,
  onEdit,
  onDelete,
  onAdd,
  lockedMonths = [],
}) => {
  const filtered = sortByDateDescending(records.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return r.date?.toLowerCase().includes(term) || r.notes?.toLowerCase().includes(term);
  }), (record) => record.date);

  const totalDeposits = sumDepositos(filtered);

  const isLocked = (dateStr?: string) => {
    if (!dateStr || dateStr.length < 7 || !Array.isArray(lockedMonths)) return false;
    return lockedMonths.includes(dateStr.slice(0, 7));
  };

  return (
    <div className="space-y-4">
      {/* Metric Header Card */}
      <div className="glass-card p-4 flex items-center space-x-3">
        <div className="p-2.5 bg-[#232832] text-emerald-400 rounded-xl border border-[var(--graphite-border-subtle)]">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
            Total Depósitos e Adiantamentos Recebidos
          </span>
          <span className="text-xl font-extrabold text-emerald-400 font-mono">{formatCurrency(totalDeposits)}</span>
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-card-static overflow-hidden">
        <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Depósitos Klabin ({filtered.length})</span>
          </h2>
          <button
            onClick={onAdd}
            className="mac-button-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Depósito</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="mac-table-header">
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3 text-right">Valor do Depósito</th>
                <th className="py-2.5 px-3">Observações / Comprovante</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-medium">
                    Nenhum depósito cadastrado.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const locked = isLocked(r.date);
                  return (
                    <tr key={r.id} className="mac-table-row">
                      <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          {locked && <Lock className="w-3 h-3 text-amber-400" />}
                          <span>{formatDateBR(r.date)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-emerald-400 font-mono text-sm">
                        {formatCurrency(r.value)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{r.notes || 'Sem observações'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            disabled={locked}
                            onClick={() => onEdit(r)}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Editar depósito"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={locked}
                            onClick={() => onDelete(r.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Excluir depósito"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
