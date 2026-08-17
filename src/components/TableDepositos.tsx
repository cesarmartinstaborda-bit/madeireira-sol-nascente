import React, { useState } from 'react';
import { DepositoKlabinRecord } from '../types';
import { formatBRL, formatDate } from '../utils/formatters';
import { Building2, Calendar, Edit3, Trash2, ArrowUpRight, Sparkles, Lock } from 'lucide-react';
import { Pagination } from './Pagination';

interface TableDepositosProps {
  records: DepositoKlabinRecord[];
  searchTerm: string;
  onEdit?: (record: DepositoKlabinRecord) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onUpdateRecord: (record: DepositoKlabinRecord) => void;
  lockedMonths?: string[];
}

export const TableDepositos: React.FC<TableDepositosProps> = ({
  records,
  searchTerm,
  onEdit,
  onDelete,
  onAdd,
  onUpdateRecord,
  lockedMonths = [],
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const filtered = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      !term ||
      r.date.includes(term) ||
      (r.notes && r.notes.toLowerCase().includes(term)) ||
      r.value.toString().includes(term)
    );
  });

  // Chronological sorting by date descending
  const sortedFiltered = [...filtered].sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    return dateB.localeCompare(dateA);
  });

  const totalPages = Math.ceil(sortedFiltered.length / pageSize) || 1;
  const paginatedRecords = sortedFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalDeposited = filtered.reduce((acc, r) => acc + (Number(r.value) || 0), 0);
  const latestDeposit = sortedFiltered.length > 0 ? sortedFiltered[0] : null;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Depósitos Klabin</p>
            <p className="text-2xl font-bold text-slate-100 mt-1 font-mono">{formatBRL(totalDeposited)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Aportes acumulados em conta</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Building2 className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lotes de Depósitos</p>
            <p className="text-2xl font-bold text-slate-100 mt-1 font-mono">{filtered.length} Lotes</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Adiantamentos registrados</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <ArrowUpRight className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Último Aporte</p>
            <p className="text-lg font-bold text-slate-100 mt-1 font-mono">
              {latestDeposit ? formatBRL(latestDeposit.value) : 'R$ 0,00'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Data: {latestDeposit ? formatDate(latestDeposit.date) : '-'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Calendar className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* Direct Editing Info Banner & Action Button */}
      <div className="glass-card p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong>Data Grid Editável:</strong> Edite a data, valor ou observações diretamente nas células. As alterações recalculam o Saldo Klabin automaticamente.
          </span>
        </div>
        <button
          onClick={onAdd}
          className="mac-button-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          <span>+ Novo Depósito</span>
        </button>
      </div>

      {/* Main Data Grid Table */}
      <div className="mac-table-container">
        <div className="p-3.5 border-b border-white/[0.07] flex items-center justify-between bg-white/[0.02]">
          <div>
            <h3 className="font-bold text-slate-100 text-xs">Histórico de Depósitos Klabin</h3>
          </div>
          <span className="text-[11px] font-mono bg-white/[0.04] text-slate-300 px-2.5 py-0.5 rounded-full font-semibold border border-white/[0.08]">
            {filtered.length} Registros
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">Nenhum depósito cadastrado</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Cadastre adiantamentos da Klabin para permitir o controle de abatimento de cargas.
            </p>
            <button
              onClick={onAdd}
              className="mt-4 mac-button-primary px-4 py-2 text-xs font-semibold"
            >
              Adicionar Depósito
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-4 w-44">Data do Depósito</th>
                  <th className="py-2.5 px-4 text-right w-52">Valor Depósito (R$)</th>
                  <th className="py-2.5 px-4">Observações / Comprovante</th>
                  <th className="py-2.5 px-4 text-center w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedRecords.map((item) => {
                  const monthKey = item.date ? item.date.slice(0, 7) : '';
                  const isLocked = lockedMonths.includes(monthKey);

                  return (
                    <tr key={item.id} className={`mac-table-row ${isLocked ? 'bg-amber-500/[0.04]' : ''}`}>
                      {/* Date */}
                      <td className="py-2 px-4 font-mono font-medium text-slate-200 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {isLocked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Mês Trancado (Fechamento de Ciclo)" />}
                          <input
                            type="date"
                            disabled={isLocked}
                            value={item.date || ''}
                            onChange={(e) => onUpdateRecord({ ...item, date: e.target.value })}
                            className={`w-full mac-input py-0.5 px-2 font-mono text-xs text-slate-200 ${
                              isLocked ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 cursor-not-allowed font-bold' : ''
                            }`}
                          />
                        </div>
                      </td>

                      {/* Value */}
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          disabled={isLocked}
                          value={item.value ?? 0}
                          onChange={(e) => onUpdateRecord({ ...item, value: Number(e.target.value) })}
                          className="w-full mac-input py-0.5 px-2 font-mono text-right font-bold text-slate-100 text-xs"
                        />
                      </td>

                      {/* Notes */}
                      <td className="py-2 px-4 text-slate-300">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={item.notes || ''}
                          onChange={(e) => onUpdateRecord({ ...item, notes: e.target.value })}
                          placeholder="Observações do depósito..."
                          className="w-full mac-input py-0.5 px-2 text-slate-200 text-xs"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          {isLocked ? (
                            <span className="p-1 text-amber-400 bg-amber-500/20 rounded-lg" title="Lançamento em mês trancado (Fechamento de Ciclo)">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <>
                              {onEdit && (
                                <button
                                  onClick={() => onEdit(item)}
                                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] rounded-lg transition-colors"
                                  title="Editar depósito via modal"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => onDelete(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                                title="Excluir depósito"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={sortedFiltered.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};
