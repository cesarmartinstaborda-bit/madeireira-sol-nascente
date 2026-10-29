import React from 'react';
import { CheckCircle2, Edit2, HardHat, Lock, RotateCcw, Trash2 } from 'lucide-react';
import { MaoDeObraClienteRecord, MaoDeObraLancamentoRecord, MaoDeObraProdutoRecord } from '../../types';
import { formatDateBR, formatDateTimeBR } from '../../utils/formatters';
import { formatOptionalBRL, formatTons } from '../../utils/maoDeObra';

interface LancamentosTableProps {
  title: string;
  records: MaoDeObraLancamentoRecord[];
  clientes: MaoDeObraClienteRecord[];
  produtos: MaoDeObraProdutoRecord[];
  paidView: boolean;
  isDateLocked: (dateStr?: string) => boolean;
  onSetStatus: (id: string, status: 'PENDING' | 'PAID') => void;
  onEdit?: (record: MaoDeObraLancamentoRecord) => void;
  onDelete?: (record: MaoDeObraLancamentoRecord) => void;
}

/** Nome atual do cadastro; sem cadastro, o nome gravado no próprio lançamento. */
function displayName(list: { id: string; name: string }[], id: string | null, savedName: string | null) {
  return (id && list.find((item) => item.id === id)?.name) || savedName || '—';
}

export const LancamentosTable: React.FC<LancamentosTableProps> = ({
  title,
  records,
  clientes,
  produtos,
  paidView,
  isDateLocked,
  onSetStatus,
  onEdit,
  onDelete,
}) => (
  <div className="glass-card-static overflow-hidden">
    <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
      <h2 className="text-sm font-bold text-white flex items-center space-x-2">
        <HardHat className="w-4 h-4 text-blue-400" />
        <span>{title} ({records.length})</span>
      </h2>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="mac-table-header">
            <th className="py-2.5 px-3">Data</th>
            <th className="py-2.5 px-3">Cliente</th>
            <th className="py-2.5 px-3">Produto</th>
            <th className="py-2.5 px-3 text-right">Toneladas</th>
            <th className="py-2.5 px-3 text-right">Preço/t</th>
            <th className="py-2.5 px-3 text-right">Valor Total</th>
            {paidView && <th className="py-2.5 px-3">Quitado em</th>}
            <th className="py-2.5 px-3 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
          {records.length === 0 ? (
            <tr>
              <td colSpan={paidView ? 8 : 7} className="p-8 text-center text-slate-500 font-medium">
                {paidView ? 'Nenhum lançamento quitado.' : 'Nenhum lançamento pendente.'}
              </td>
            </tr>
          ) : (
            records.map((r) => {
              const locked = Boolean(r.date && isDateLocked(r.date));
              return (
                <tr key={r.id} className="mac-table-row">
                  <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      {locked && <Lock className="w-3 h-3 text-amber-400" />}
                      <span>{r.date ? formatDateBR(r.date) : '—'}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">{displayName(clientes, r.clientId, r.clientName)}</td>
                  <td className="py-2.5 px-3">{displayName(produtos, r.productId, r.productName)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-200 font-mono">{formatTons(r.quantityTons)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400 font-mono">{formatOptionalBRL(r.pricePerTon)}</td>
                  <td className="py-2.5 px-3 text-right font-extrabold text-emerald-400 font-mono">{formatOptionalBRL(r.totalValue)}</td>
                  {paidView && (
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{r.paidAt ? formatDateTimeBR(r.paidAt) : '—'}</td>
                  )}
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => onSetStatus(r.id, paidView ? 'PENDING' : 'PAID')}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                          paidView
                            ? 'bg-[#1a1d24] text-slate-300 border border-[var(--graphite-border-subtle)] hover:bg-[#232832]'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/80'
                        }`}
                        title={paidView ? 'Reverter a quitação e voltar para Principal' : 'Marcar este lançamento como quitado'}
                      >
                        {paidView ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span>{paidView ? 'Reverter' : 'Quitar'}</span>
                      </button>
                      {onEdit && (
                        <button
                          onClick={() => onEdit(r)}
                          disabled={locked}
                          className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all disabled:opacity-40 disabled:pointer-events-none"
                          title="Editar lançamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(r)}
                          disabled={locked}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all disabled:opacity-40 disabled:pointer-events-none"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
);
