import { CalendarDays, CheckCircle2, Lock, ShieldCheck, Unlock } from 'lucide-react';
import { formatMonthYearBR, MONTH_NAMES_BR } from '../../utils/formatters';
import type { useSettingsController } from './useSettingsController';

type Props = {
  model: Pick<ReturnType<typeof useSettingsController>,
    'activeTab'
    | 'isSelectedCycleLocked'
    | 'selectedCycleMonth'
    | 'setSelectedCycleMonth'
    | 'selectedCycleYear'
    | 'setSelectedCycleYear'
    | 'availableYears'
    | 'setConfirmModal'
    | 'selectedCycleKey'
    | 'lockedMonths'
    | 'cycleFeedback'
    | 'confirmModal'
    | 'handleConfirmCycleAction'
  >;
};

export function CyclesSettingsPanel({ model }: Props) {
  const {
    activeTab,
    isSelectedCycleLocked,
    selectedCycleMonth,
    setSelectedCycleMonth,
    selectedCycleYear,
    setSelectedCycleYear,
    availableYears,
    setConfirmModal,
    selectedCycleKey,
    lockedMonths,
    cycleFeedback,
    confirmModal,
    handleConfirmCycleAction,
  } = model;
  return <>{activeTab === 'CICLOS' && (
        <div className="space-y-6">
          {/* Cycle Manager Card */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Administração de Fechamento de Ciclo</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Bloqueie períodos mensais para impedir inclusões, edições ou exclusões acidentais
                </p>
              </div>
            </div>

            {/* Cycle Selector & Status Box */}
            <div className="p-5 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Selecionar Período
                  </h4>
                  <p className="text-xs text-[var(--graphite-text-secondary)]">
                    Escolha o mês e ano para consultar o estado ou alterar o fechamento
                  </p>
                </div>

                {/* Status Badge for Selected Month */}
                <div>
                  {isSelectedCycleLocked ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>FECHADO</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ABERTO</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Selectors and Action Button */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 items-end">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Mês
                  </label>
                  <select
                    value={selectedCycleMonth}
                    onChange={(e) => setSelectedCycleMonth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs font-medium focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  >
                    {MONTH_NAMES_BR.map((name, idx) => {
                      const monthVal = String(idx + 1).padStart(2, '0');
                      return (
                        <option key={monthVal} value={monthVal}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Ano
                  </label>
                  <select
                    value={selectedCycleYear}
                    onChange={(e) => setSelectedCycleYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs font-medium focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  {isSelectedCycleLocked ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          isOpen: true,
                          mode: 'UNLOCK',
                          monthKey: selectedCycleKey,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-[#1a1d24] hover:bg-[#232832] text-amber-300 hover:text-amber-200 border border-amber-800/80 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Reabrir ciclo</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          isOpen: true,
                          mode: 'LOCK',
                          monthKey: selectedCycleKey,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Fechar ciclo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List of currently locked months */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Períodos Fechados</span>
                  <span className="px-2 py-0.5 bg-[#1c2027] border border-[var(--graphite-border-subtle)] text-slate-300 rounded-full text-[10px] font-mono">
                    {lockedMonths.length}
                  </span>
                </h4>
              </div>

              {lockedMonths.length === 0 ? (
                <div className="p-6 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)] text-center text-xs text-slate-400">
                  Nenhum ciclo fechado no momento. Todos os períodos estão abertos para lançamento.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {lockedMonths
                    .slice()
                    .sort((a, b) => b.localeCompare(a))
                    .map((mKey) => (
                      <div
                        key={mKey}
                        className="p-3 bg-[#14171d] border border-amber-900/40 rounded-xl flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-xs font-semibold text-white truncate">
                            {formatMonthYearBR(mKey)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              mode: 'UNLOCK',
                              monthKey: mKey,
                            })
                          }
                          className="px-2.5 py-1 bg-[#1a1d24] hover:bg-amber-950/50 text-amber-300 border border-amber-800/60 rounded-lg text-[11px] font-semibold transition-colors shrink-0"
                        >
                          Reabrir
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Informative Security / Audit Note */}
            <div className="p-3.5 bg-[#16191f] border border-[var(--graphite-border-subtle)] rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-slate-200">
                  O que acontece ao fechar um ciclo mensal?
                </p>
                <p className="text-[11px] text-[var(--graphite-text-secondary)]">
                  O fechamento bloqueia a criação, edição e exclusão de Cargas, Depósitos Klabin, Vendas e quitação de Fretes pertencentes àquele mês. Cadastros de Clientes, Produtos e Motoristas continuam disponíveis. O estado de fechamento é sincronizado para todos os dispositivos.
                </p>
              </div>
            </div>

            {cycleFeedback && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{cycleFeedback}</span>
              </div>
            )}
          </div>

          {/* Confirmation Modal */}
          {confirmModal && confirmModal.isOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="glass-card p-6 max-w-md w-full border border-[var(--graphite-border-subtle)] space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
                  <div
                    className={`p-2 rounded-lg ${
                      confirmModal.mode === 'LOCK'
                        ? 'bg-amber-950/80 text-amber-400'
                        : 'bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)]'
                    }`}
                  >
                    {confirmModal.mode === 'LOCK' ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <Unlock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {confirmModal.mode === 'LOCK'
                        ? `Fechar ${formatMonthYearBR(confirmModal.monthKey)}?`
                        : `Reabrir ${formatMonthYearBR(confirmModal.monthKey)}?`}
                    </h3>
                    <p className="text-xs text-[var(--graphite-text-secondary)]">
                      Confirmação de alteração de ciclo
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {confirmModal.mode === 'LOCK'
                    ? 'Após o fechamento, registros desse período não poderão ser editados ou excluídos até que o ciclo seja reaberto.'
                    : 'As movimentações desse período voltarão a permitir alterações, inclusões e exclusões.'}
                </p>

                <div className="pt-3 border-t border-[var(--graphite-border-subtle)] flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setConfirmModal(null)}
                    className="px-3.5 py-2 bg-[#1a1d24] hover:bg-[#232832] text-slate-300 border border-[var(--graphite-border-base)] rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCycleAction}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                      confirmModal.mode === 'LOCK'
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'mac-button-primary'
                    }`}
                  >
                    {confirmModal.mode === 'LOCK' ? 'Fechar ciclo' : 'Reabrir ciclo'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}</>;
}
