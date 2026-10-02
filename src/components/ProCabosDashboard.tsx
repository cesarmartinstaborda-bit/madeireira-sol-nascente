import React, { useMemo, useState } from 'react';
import { CargaRecord } from '../types';
import { formatCurrency, formatDateBR, formatNumber } from '../utils/formatters';
import { sortByDateDescending } from '../utils/dateSorting';
import {
  calcProCabosAmountDue,
  getProCabosLaborRate,
  splitProCabosCargas,
  sumProCabosAmountDue,
} from '../utils/proCabos';
import { CheckCircle2, Clock, Lock, RotateCcw, Truck, Wallet } from 'lucide-react';

type ProCabosTab = 'ABERTO' | 'QUITADOS';

interface ProCabosDashboardProps {
  /** Todas as cargas Klabin; o módulo só projeta as marcadas como Pro Cabos. */
  cargas: CargaRecord[];
  searchTerm: string;
  lockedMonths?: string[];
  /** Altera só a situação financeira da Pro Cabos; continua disponível em mês trancado. */
  onSetProCabosStatus: (id: string, status: 'PENDING' | 'PAID') => void;
}

export const ProCabosDashboard: React.FC<ProCabosDashboardProps> = ({
  cargas,
  searchTerm,
  lockedMonths = [],
  onSetProCabosStatus,
}) => {
  const [activeTab, setActiveTab] = useState<ProCabosTab>('ABERTO');

  const { open, paid } = useMemo(() => splitProCabosCargas(cargas), [cargas]);
  const saldoDevedor = useMemo(() => sumProCabosAmountDue(open), [open]);

  const isPaidTab = activeTab === 'QUITADOS';

  const filteredRecords = sortByDateDescending((isPaidTab ? paid : open).filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.date?.toLowerCase().includes(term) ||
      r.invoiceNumber?.toLowerCase().includes(term) ||
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
    <div className="space-y-6">
      {/* Resumo único do módulo: saldo devedor da Pro Cabos */}
      <div className="glass-card p-4 flex items-center space-x-3">
        <div className="p-2.5 bg-[#232832] text-amber-400 rounded-xl border border-[var(--graphite-border-subtle)]">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
            Saldo Devedor Pro Cabos
          </span>
          <span className="text-lg font-bold font-mono text-amber-400">{formatCurrency(saldoDevedor)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-[var(--graphite-border-subtle)] pb-4">
        <div className="mac-segmented-control">
          <button
            onClick={() => setActiveTab('ABERTO')}
            className={`mac-segmented-item ${!isPaidTab ? 'mac-segmented-item-active' : ''}`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Em aberto ({open.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('QUITADOS')}
            className={`mac-segmented-item ${isPaidTab ? 'mac-segmented-item-active' : ''}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Quitados ({paid.length})</span>
          </button>
        </div>

        <div className="hidden sm:block text-xs text-[var(--graphite-text-secondary)] font-medium">
          Módulo Pro Cabos
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass-card-static overflow-hidden">
          <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <Truck className="w-4 h-4 text-blue-400" />
              <span>
                {isPaidTab ? 'Cargas Quitadas' : 'Cargas em Aberto'} ({filteredRecords.length})
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3 text-right">Qtd (Ton)</th>
                  <th className="py-2.5 px-3 text-right">R$/Ton Klabin</th>
                  <th className="py-2.5 px-3 text-right">Mão de Obra/Ton</th>
                  <th className="py-2.5 px-3 text-right">Valor Pro Cabos</th>
                  <th className="py-2.5 px-3">Motorista / Placa</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                      {isPaidTab ? 'Nenhuma carga quitada.' : 'Nenhuma carga em aberto.'}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const locked = isLocked(r.date);

                    return (
                      <tr key={r.id} className="mac-table-row">
                        <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                          <div className="flex items-center space-x-1">
                            {locked && <Lock className="w-3 h-3 text-amber-400" />}
                            <span>{formatDateBR(r.date)}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{r.product || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-200 font-mono">{formatNumber(r.quantityTons, 2)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-400 font-mono">{formatCurrency(r.valuePerTon)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-400 font-mono">{formatCurrency(getProCabosLaborRate(r))}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-emerald-400 font-mono">{formatCurrency(calcProCabosAmountDue(r))}</td>
                        <td className="py-2.5 px-3 text-slate-300">{r.driverPlate || r.licensePlate || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => onSetProCabosStatus(r.id, isPaidTab ? 'PENDING' : 'PAID')}
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                              isPaidTab
                                ? 'bg-[#1a1d24] text-slate-300 border border-[var(--graphite-border-subtle)] hover:bg-[#232832]'
                                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/80'
                            }`}
                            title={isPaidTab ? 'Voltar esta carga para Em aberto' : 'Marcar esta carga como paga pela Pro Cabos'}
                          >
                            {isPaidTab ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                            <span>{isPaidTab ? 'Reverter' : 'Pago'}</span>
                          </button>
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
    </div>
  );
};
