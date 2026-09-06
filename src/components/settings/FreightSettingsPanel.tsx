import { CheckCircle2, DollarSign, Info, Save, Truck, Users } from 'lucide-react';
import { formatBRL, parseBRLCurrency } from '../../utils/formatters';
import type { useSettingsController } from './useSettingsController';

type Props = {
  model: Pick<ReturnType<typeof useSettingsController>,
    'activeTab'
    | 'localFreightRate'
    | 'activeDriversCount'
    | 'inactiveDriversCount'
    | 'handleSaveFreight'
    | 'setLocalFreightRate'
    | 'defaultCargoFreightPayable'
    | 'setDefaultCargoFreightPayable'
    | 'defaultSaleFreightPayable'
    | 'setDefaultSaleFreightPayable'
    | 'freightFeedback'
  >;
};

export function FreightSettingsPanel({ model }: Props) {
  const {
    activeTab,
    localFreightRate,
    activeDriversCount,
    inactiveDriversCount,
    handleSaveFreight,
    setLocalFreightRate,
    defaultCargoFreightPayable,
    setDefaultCargoFreightPayable,
    defaultSaleFreightPayable,
    setDefaultSaleFreightPayable,
    freightFeedback,
  } = model;
  return <>{activeTab === 'FRETES' && (
        <div className="space-y-6">
          {/* Read-Only Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Tarifa Atual</span>
                <DollarSign className="w-4 h-4 text-[var(--graphite-accent-blue)]" />
              </div>
              <p className="text-xl font-bold font-mono text-white">
                {formatBRL(parseBRLCurrency(localFreightRate) || 15)}
                <span className="text-xs text-slate-400 font-normal"> / ton</span>
              </p>
              <p className="text-[10px] text-slate-500">Valor base para novos lançamentos</p>
            </div>

            <div className="glass-card p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Motoristas Ativos</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-bold font-mono text-emerald-400">
                {activeDriversCount}
              </p>
              <p className="text-[10px] text-slate-500">Disponíveis para fretes</p>
            </div>

            <div className="glass-card p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Motoristas Inativos</span>
                <Users className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-xl font-bold font-mono text-slate-300">
                {inactiveDriversCount}
              </p>
              <p className="text-[10px] text-slate-500">Histórico preservado</p>
            </div>
          </div>

          {/* Fretes Settings Form */}
          <form onSubmit={handleSaveFreight} className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Configurações e Tarifas de Frete</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Preferências globais aplicadas na criação de novos registros
                </p>
              </div>
            </div>

            {/* Freight Rate per Ton */}
            <div className="space-y-2 p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)]">
              <label className="block text-xs font-bold text-white">
                Valor padrão do frete por tonelada (R$)
              </label>
              <p className="text-xs text-[var(--graphite-text-secondary)]">
                Utilizado para o cálculo automático do custo de frete (Quantidade em Toneladas × Tarifa) ao selecionar frete a pagar em novos registros.
              </p>
              <div className="max-w-xs pt-1">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={localFreightRate}
                    onChange={(e) => setLocalFreightRate(e.target.value)}
                    placeholder="15,00"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  />
                </div>
              </div>
            </div>

            {/* Defaults for New Records */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Preferências para novos lançamentos
              </h4>

              {/* Toggle 1: Cargas default freight payable */}
              <div className="flex items-start justify-between gap-4 p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)]">
                <div className="space-y-1 pr-4">
                  <label
                    htmlFor="toggle-cargo-freight"
                    className="text-xs font-bold text-white cursor-pointer select-none"
                  >
                    Frete a pagar por padrão em novas Cargas
                  </label>
                  <p className="text-xs text-[var(--graphite-text-secondary)] leading-relaxed">
                    Quando ativo, o campo "Frete a Pagar" iniciará marcado como SIM ao abrir o formulário de Nova Carga.
                  </p>
                </div>

                <div className="shrink-0 pt-0.5">
                  <button
                    type="button"
                    id="toggle-cargo-freight"
                    role="switch"
                    aria-checked={defaultCargoFreightPayable}
                    onClick={() => setDefaultCargoFreightPayable(!defaultCargoFreightPayable)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      defaultCargoFreightPayable ? 'bg-[var(--graphite-accent-blue)]' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        defaultCargoFreightPayable ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Toggle 2: Sales default freight payable */}
              <div className="flex items-start justify-between gap-4 p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)]">
                <div className="space-y-1 pr-4">
                  <label
                    htmlFor="toggle-sale-freight"
                    className="text-xs font-bold text-white cursor-pointer select-none"
                  >
                    Frete a pagar por padrão em novas Vendas
                  </label>
                  <p className="text-xs text-[var(--graphite-text-secondary)] leading-relaxed">
                    Quando ativo, o campo "Frete a Pagar" iniciará marcado como SIM ao abrir o formulário de Nova Venda.
                  </p>
                </div>

                <div className="shrink-0 pt-0.5">
                  <button
                    type="button"
                    id="toggle-sale-freight"
                    role="switch"
                    aria-checked={defaultSaleFreightPayable}
                    onClick={() => setDefaultSaleFreightPayable(!defaultSaleFreightPayable)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      defaultSaleFreightPayable ? 'bg-[var(--graphite-accent-blue)]' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        defaultSaleFreightPayable ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Explanatory note */}
            <div className="p-3.5 bg-[#16191f] border border-[var(--graphite-border-subtle)] rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
              <Info className="w-4 h-4 text-[var(--graphite-accent-blue)] shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-slate-200">
                  Esta opção define apenas o estado inicial ao cadastrar novos registros.
                </p>
                <p className="text-[11px] text-[var(--graphite-text-secondary)]">
                  Registros e fretes já lançados continuam com os valores salvos. A gestão operacional e a quitação de fretes continuam disponíveis em Gestão de Motoristas → Fretes.
                </p>
              </div>
            </div>

            {freightFeedback && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{freightFeedback}</span>
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
