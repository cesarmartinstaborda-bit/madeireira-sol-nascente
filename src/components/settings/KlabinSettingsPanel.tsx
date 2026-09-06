import { CheckCircle2, Info, Save, Trees, Wallet } from 'lucide-react';
import { formatBRL } from '../../utils/formatters';
import type { useSettingsController } from './useSettingsController';

type Props = {
  model: Pick<ReturnType<typeof useSettingsController>,
    'activeTab'
    | 'klabinBalance'
    | 'handleSaveKlabin'
    | 'defaultDeductFromBalance'
    | 'setDefaultDeductFromBalance'
    | 'klabinFeedback'
  >;
};

export function KlabinSettingsPanel({ model }: Props) {
  const {
    activeTab,
    klabinBalance,
    handleSaveKlabin,
    defaultDeductFromBalance,
    setDefaultDeductFromBalance,
    klabinFeedback,
  } = model;
  return <>{activeTab === 'KLABIN' && (
        <div className="space-y-6">
          {/* Saldo Livre Klabin Card (READ-ONLY) */}
          <div className="glass-card p-6 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[var(--graphite-surface-2)] text-emerald-400 rounded-lg">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Saldo Livre Klabin</h3>
                  <p className="text-xs text-[var(--graphite-text-secondary)]">
                    Indicador derivado em tempo real
                  </p>
                </div>
              </div>

              <span className="text-[10px] bg-[#1c2027] text-slate-300 border border-[var(--graphite-border-subtle)] px-2.5 py-1 rounded-full font-semibold">
                Somente Leitura • Calculado Automaticamente
              </span>
            </div>

            <div className="py-2 flex items-baseline space-x-3">
              <span
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                  klabinBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatBRL(klabinBalance)}
              </span>
            </div>

            <p className="text-xs text-[var(--graphite-text-secondary)] leading-relaxed">
              O Saldo Livre Klabin é calculado automaticamente a partir dos depósitos e das cargas abatidas.
            </p>
          </div>

          {/* Preferences for New Cargoes */}
          <form onSubmit={handleSaveKlabin} className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Trees className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Preferências para novas cargas</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Comportamento padrão inicial ao criar novos registros de cargas
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)]">
              <div className="space-y-1 pr-4">
                <label
                  htmlFor="toggle-deduct-balance"
                  className="text-xs font-bold text-white cursor-pointer select-none"
                >
                  Abater novas cargas do Saldo Klabin por padrão
                </label>
                <p className="text-xs text-[var(--graphite-text-secondary)] leading-relaxed">
                  Quando ativo, o campo "Abater do Saldo Klabin" iniciará marcado como SIM ao abrir o formulário de Nova Carga.
                </p>
              </div>

              <div className="shrink-0 pt-0.5">
                <button
                  type="button"
                  id="toggle-deduct-balance"
                  role="switch"
                  aria-checked={defaultDeductFromBalance}
                  onClick={() => setDefaultDeductFromBalance(!defaultDeductFromBalance)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    defaultDeductFromBalance ? 'bg-[var(--graphite-accent-blue)]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      defaultDeductFromBalance ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-[#16191f] border border-[var(--graphite-border-subtle)] rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
              <Info className="w-4 h-4 text-[var(--graphite-accent-blue)] shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-slate-200">
                  Esta opção define apenas o estado inicial de novas cargas.
                </p>
                <p className="text-[11px] text-[var(--graphite-text-secondary)]">
                  Cargas já cadastradas não são alteradas. Ao editar uma carga existente, o valor salvo naquela carga será sempre preservado.
                </p>
              </div>
            </div>

            {klabinFeedback && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{klabinFeedback}</span>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--graphite-border-subtle)] flex items-center justify-end">
              <button
                type="submit"
                className="mac-button-primary"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar alterações</span>
              </button>
            </div>
          </form>
        </div>
      )}</>;
}
