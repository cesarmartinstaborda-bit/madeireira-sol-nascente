import { CheckCircle2, Clock, Globe, Laptop, LayoutDashboard, Settings, ShieldCheck, Smartphone } from 'lucide-react';
import type { useSettingsController } from './useSettingsController';

type Props = {
  model: Pick<ReturnType<typeof useSettingsController>,
    'activeTab'
    | 'appFeedback'
    | 'companyName'
    | 'detectAppEnvironment'
    | 'checkLocalStorageAvailable'
    | 'handleStartupPreferenceChange'
    | 'startupPreference'
  >;
};

export function ApplicationSettingsPanel({ model }: Props) {
  const {
    activeTab,
    appFeedback,
    companyName,
    detectAppEnvironment,
    checkLocalStorageAvailable,
    handleStartupPreferenceChange,
    startupPreference,
  } = model;
  return <>{activeTab === 'APLICATIVO' && (
        <div className="space-y-6">
          {appFeedback && (
            <div className="p-4 bg-emerald-950/50 text-emerald-300 border border-emerald-800/60 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-top-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{appFeedback}</span>
            </div>
          )}

          {/* CARD 1: INFORMAÇÕES TÉCNICAS E AMBIENTE */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Informações do Aplicativo</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Especificações técnicas e ambiente de execução
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider block">
                  Nome do Sistema
                </span>
                <span className="text-xs font-bold text-white block">
                  {companyName || 'Madeireira Sol Nascente'}
                </span>
              </div>

              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider block">
                  Versão da Aplicação
                </span>
                <span className="text-xs font-bold text-white font-mono block">
                  v0.0.0
                </span>
              </div>

              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider block">
                  Ambiente de Execução
                </span>
                <div className="flex items-center space-x-1.5 pt-0.5">
                  {detectAppEnvironment() === 'Electron' ? (
                    <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-[var(--graphite-accent-blue)]" />
                  )}
                  <span className="text-xs font-bold text-white block">
                    {detectAppEnvironment()}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider block">
                  Armazenamento Local
                </span>
                <span
                  className={`text-xs font-bold block ${
                    checkLocalStorageAvailable() ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {checkLocalStorageAvailable() ? 'Disponível' : 'Indisponível'}
                </span>
              </div>
            </div>
          </div>

          {/* CARD 2: PREFERÊNCIAS DE INICIALIZAÇÃO */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Preferências de Inicialização</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Defina qual tela deve ser apresentada ao abrir a aplicação neste dispositivo
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Ao abrir o aplicativo:
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleStartupPreferenceChange('DASHBOARD')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-3 ${
                    startupPreference === 'DASHBOARD'
                      ? 'bg-[var(--graphite-surface-2)] border-[var(--graphite-accent-blue)] ring-1 ring-[var(--graphite-accent-blue)]'
                      : 'bg-[#12151a] hover:bg-[#161a21] border-[var(--graphite-border-subtle)]'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      startupPreference === 'DASHBOARD'
                        ? 'bg-[var(--graphite-accent-blue)] text-white'
                        : 'bg-[#1a1d24] text-slate-400'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white">Painel Consolidado (Padrão)</div>
                    <p className="text-[11px] text-[var(--graphite-text-secondary)] leading-relaxed">
                      Inicia sempre no Dashboard com visão geral dos indicadores operacionais e financeiros.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartupPreferenceChange('LAST_USED')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-3 ${
                    startupPreference === 'LAST_USED'
                      ? 'bg-[var(--graphite-surface-2)] border-[var(--graphite-accent-blue)] ring-1 ring-[var(--graphite-accent-blue)]'
                      : 'bg-[#12151a] hover:bg-[#161a21] border-[var(--graphite-border-subtle)]'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      startupPreference === 'LAST_USED'
                        ? 'bg-[var(--graphite-accent-blue)] text-white'
                        : 'bg-[#1a1d24] text-slate-400'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white">Último módulo utilizado</div>
                    <p className="text-[11px] text-[var(--graphite-text-secondary)] leading-relaxed">
                      Reabre automaticamente o último módulo visualizado (Klabin, Clientes, Motoristas ou Ajustes).
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* CARD 3: SOBRE */}
          <div className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-[var(--graphite-surface-2)] text-slate-300 rounded-xl border border-[var(--graphite-border-subtle)]">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {companyName || 'Madeireira Sol Nascente'}
                </h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Sistema de Gestão Operacional e Controle Financeiro
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-mono bg-[#12151a] px-3.5 py-1.5 rounded-lg border border-[var(--graphite-border-subtle)] self-start md:self-auto">
              Versão 0.0.0 • Madeireira V3
            </div>
          </div>
        </div>
      )}</>;
}
