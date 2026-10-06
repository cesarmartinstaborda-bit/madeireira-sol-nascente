import React, { useContext, useState } from 'react';
import { CargaRecord, ProdutoRecord, MotoristaRecord } from '../types';
import { formatCurrency, formatNumber, formatDateBR } from '../utils/formatters';
import { isDeductedFromBalance } from '../utils/klabinBalance';
import { isProCabosCarga } from '../utils/proCabos';
import { Truck, Edit2, Trash2, Plus, Lock, Paperclip } from 'lucide-react';
import { useAttachmentCounts } from '../hooks/useAttachmentCounts';
import { AttachmentHandlersContext } from '../hooks/AttachmentHandlersContext';
import { CargaAttachmentsModal } from './CargaAttachmentsModal';
import { sortByDateDescending } from '../utils/dateSorting';

interface TableCargasProps {
  records: CargaRecord[];
  searchTerm: string;
  onEdit?: (record: CargaRecord) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onUpdateRecord: (record: CargaRecord) => void;
  produtos?: ProdutoRecord[];
  lockedMonths?: string[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
  /** Hides the "Adicionar Carga" action — used by the Histórico view over closed competencies. */
  readOnly?: boolean;
}

export const TableCargas: React.FC<TableCargasProps> = ({
  records,
  searchTerm,
  onEdit,
  onDelete,
  onAdd,
  onUpdateRecord,
  lockedMonths = [],
  freightRatePerTon = 15,
  readOnly = false,
}) => {
  // Anexos PDF (locais): carga sem anexo não ganha nada na linha.
  const attachmentCounts = useAttachmentCounts();
  const attachmentHandlers = useContext(AttachmentHandlersContext);
  const [attachmentsOf, setAttachmentsOf] = useState<CargaRecord | null>(null);
  const filteredRecords = sortByDateDescending(records.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.date?.toLowerCase().includes(term) ||
      r.invoiceNumber?.toLowerCase().includes(term) ||
      r.supplier?.toLowerCase().includes(term) ||
      r.product?.toLowerCase().includes(term) ||
      r.driverPlate?.toLowerCase().includes(term) ||
      r.notes?.toLowerCase().includes(term)
    );
  }), (record) => record.date);

  const isLocked = (dateStr?: string) => {
    if (!dateStr || dateStr.length < 7 || !Array.isArray(lockedMonths)) return false;
    return lockedMonths.includes(dateStr.slice(0, 7));
  };

  return (
    <div className="space-y-4">
      {/* Main Table Card */}
      <div className="glass-card-static overflow-hidden">
        <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Truck className="w-4 h-4 text-blue-400" />
            <span>Registro de Cargas ({filteredRecords.length})</span>
          </h2>
          {!readOnly && (
            <button
              onClick={onAdd}
              className="mac-button-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Carga</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="mac-table-header">
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Fornecedor</th>
                <th className="py-2.5 px-3">Produto</th>
                <th className="py-2.5 px-3 text-right">Qtd (Ton)</th>
                <th className="py-2.5 px-3 text-right">R$/Ton</th>
                <th className="py-2.5 px-3 text-right">Valor Total</th>
                <th className="py-2.5 px-3">Motorista / Placa</th>
                <th className="py-2.5 px-3 text-center">Frete</th>
                <th className="py-2.5 px-3 text-center">Abater Saldo?</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 font-medium">
                    Nenhuma carga encontrada.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const locked = isLocked(r.date);
                  const isDeducted = isDeductedFromBalance(r);
                  const hasFreight = r.freightPayable !== 'NO' && (r.freightPayable as any) !== false;

                  return (
                    <tr key={r.id} className="mac-table-row">
                      <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          {locked && <Lock className="w-3 h-3 text-amber-400" />}
                          <span>{formatDateBR(r.date)}</span>
                          {attachmentCounts[r.id] > 0 &&
                            (attachmentHandlers ? (
                              <button
                                type="button"
                                onClick={() => setAttachmentsOf(r)}
                                className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-semibold text-slate-400 hover:text-blue-400 rounded transition-colors"
                                title={`${attachmentCounts[r.id]} anexo${attachmentCounts[r.id] > 1 ? 's' : ''} PDF — clique para ver`}
                                aria-label={`Ver anexos (${attachmentCounts[r.id]})`}
                                data-testid="attachment-indicator"
                              >
                                <Paperclip className="w-3 h-3" />
                                {attachmentCounts[r.id]}
                              </button>
                            ) : (
                              <span
                                className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-semibold text-slate-400"
                                title={`${attachmentCounts[r.id]} anexo${attachmentCounts[r.id] > 1 ? 's' : ''} PDF`}
                                data-testid="attachment-indicator"
                              >
                                <Paperclip className="w-3 h-3" />
                                {attachmentCounts[r.id]}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {r.supplier || 'Klabin'}
                        {isProCabosCarga(r) && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                            Pro Cabos
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{r.product || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-200 font-mono">{formatNumber(r.quantityTons, 2)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">{formatCurrency(r.valuePerTon)}</td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-emerald-400 font-mono">{formatCurrency(r.totalValue)}</td>
                      <td className="py-2.5 px-3 text-slate-300">{r.driverPlate || r.licensePlate || '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            hasFreight ? 'bg-blue-950/80 text-blue-300 border border-blue-800' : 'bg-[#1a1d24] text-slate-500 border border-[var(--graphite-border-subtle)]'
                          }`}
                        >
                          {hasFreight ? formatCurrency(r.freightCost !== undefined && r.freightCost !== null ? Number(r.freightCost) : (Number(r.quantityTons) || 0) * freightRatePerTon) : 'Sem Frete'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          disabled={locked}
                          onClick={() =>
                            onUpdateRecord({
                              ...r,
                              deductFromBalance: isDeducted ? 'NO' : 'YES',
                            })
                          }
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                            isDeducted
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/80'
                              : 'bg-[#1a1d24] text-slate-400 border border-[var(--graphite-border-subtle)] hover:bg-[#232832]'
                          }`}
                          title="Alternar se esta carga é abatida do saldo Klabin"
                        >
                          {isDeducted ? 'SIM (Abatido)' : 'NÃO'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            disabled={locked}
                            onClick={() => onEdit && onEdit(r)}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Editar registro"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={locked}
                            onClick={() => onDelete(r.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Excluir registro"
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

      {attachmentsOf && attachmentHandlers && (
        <CargaAttachmentsModal
          carga={attachmentsOf}
          locked={isLocked(attachmentsOf.date)}
          handlers={attachmentHandlers}
          onClose={() => setAttachmentsOf(null)}
        />
      )}
    </div>
  );
};
