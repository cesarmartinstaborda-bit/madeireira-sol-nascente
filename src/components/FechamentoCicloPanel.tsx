import React, { useState } from 'react';
import { CargaRecord, VendaRecord, DepositoKlabinRecord } from '../types';
import { formatBRL, formatNumber } from '../utils/formatters';
import { Lock, Unlock, Calendar, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface FechamentoCicloPanelProps {
  cargas: CargaRecord[];
  vendas: VendaRecord[];
  depositos: DepositoKlabinRecord[];
  lockedMonths: string[];
  onToggleLockMonth: (monthStr: string) => void;
}

export const FechamentoCicloPanel: React.FC<FechamentoCicloPanelProps> = ({
  cargas,
  vendas,
  depositos,
  lockedMonths,
  onToggleLockMonth,
}) => {
  const [unlockConfirmMonth, setUnlockConfirmMonth] = useState<string | null>(null);

  // Extract all unique YYYY-MM months from Cargas, Vendas, and Depositos
  const monthSet = new Set<string>();

  cargas.forEach((c) => {
    if (c.date && c.date.length >= 7) monthSet.add(c.date.slice(0, 7));
  });
  vendas.forEach((v) => {
    if (v.date && v.date.length >= 7) monthSet.add(v.date.slice(0, 7));
  });
  depositos.forEach((d) => {
    if (d.date && d.date.length >= 7) monthSet.add(d.date.slice(0, 7));
  });

  // Include current month if not present
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  monthSet.add(currentMonthStr);

  const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  // Month formatter helper (2026-07 -> Julho / 2026)
  const formatMonthLabel = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, 15);
      const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
      return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
    } catch {
      return monthStr;
    }
  };

  const handleActionClick = (monthStr: string, isLocked: boolean) => {
    if (isLocked) {
      setUnlockConfirmMonth(monthStr);
    } else {
      onToggleLockMonth(monthStr);
    }
  };

  const confirmUnlock = () => {
    if (unlockConfirmMonth) {
      onToggleLockMonth(unlockConfirmMonth);
      setUnlockConfirmMonth(null);
    }
  };

  return (
    <div className="glass-card p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 tracking-tight">Fechamento de Ciclo (Trancamento de Períodos)</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Competências Trancadas: <strong className="text-slate-100 font-mono">{lockedMonths.length}</strong></span>
        </div>
      </div>

      {/* Grid of Months */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedMonths.map((monthStr) => {
          const isLocked = lockedMonths.includes(monthStr);

          // Calculate statistics for this month
          const monthCargas = cargas.filter((c) => c.date?.startsWith(monthStr));
          const monthVendas = vendas.filter((v) => v.date?.startsWith(monthStr));
          const monthDepositos = depositos.filter((d) => d.date?.startsWith(monthStr));

          const cargasVal = monthCargas.reduce((acc, c) => acc + (Number(c.totalValue) || 0), 0);
          const cargasTons = monthCargas.reduce((acc, c) => acc + (Number(c.quantityTons) || 0), 0);
          const vendasVal = monthVendas.reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
          const depositosVal = monthDepositos.reduce((acc, d) => acc + (Number(d.value) || 0), 0);

          return (
            <div
              key={monthStr}
              className={`rounded-2xl p-4 border transition-all ${
                isLocked
                  ? 'bg-amber-500/[0.03] border-amber-500/25 shadow-xs'
                  : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="font-bold text-xs text-slate-100 tracking-tight">{formatMonthLabel(monthStr)}</span>
                </div>

                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                    isLocked
                      ? 'badge-amber'
                      : 'badge-neutral'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-3 h-3 text-amber-400" /> TRANCADO
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-slate-400" /> ABERTO
                    </>
                  )}
                </span>
              </div>

              {/* Month Summary Stats */}
              <div className="space-y-1.5 text-xs bg-white/[0.02] p-3 rounded-xl border border-white/[0.05] mb-3.5 font-medium text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cargas de Madeira:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {monthCargas.length} ({formatNumber(cargasTons)} t - {formatBRL(cargasVal)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Depósitos Klabin:</span>
                  <span className="font-mono font-bold text-slate-100">{formatBRL(depositosVal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vendas a Clientes:</span>
                  <span className="font-mono font-bold text-slate-100">{formatBRL(vendasVal)}</span>
                </div>
              </div>

              {/* Toggle Button */}
              <button
                onClick={() => handleActionClick(monthStr, isLocked)}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  isLocked
                    ? 'mac-button-secondary text-amber-400 border-amber-500/30 hover:bg-amber-500/10'
                    : 'mac-button-secondary'
                }`}
              >
                {isLocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Desbloquear Período</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Fechar & Trancar Mês</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Unlock Confirmation Modal */}
      {unlockConfirmMonth && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="mac-hud max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/15 rounded-xl border border-amber-500/25">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-slate-100 text-sm tracking-tight">Desbloquear Competência?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Você está prestes a desbloquear o mês <strong className="text-slate-100">{formatMonthLabel(unlockConfirmMonth)}</strong>. Ao desbloquear, todos os lançamentos deste período voltarão a permitir edições, alterações de valores e exclusões.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setUnlockConfirmMonth(null)}
                className="mac-button-secondary text-xs px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={confirmUnlock}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Unlock className="w-4 h-4" />
                <span>Confirmar Desbloqueio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
