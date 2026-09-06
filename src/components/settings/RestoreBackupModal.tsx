import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import type { useSettingsController } from './useSettingsController';

type Props = {
  model: Pick<ReturnType<typeof useSettingsController>,
    'restoreModal'
    | 'setRestoreModal'
    | 'isRestoring'
    | 'handleConfirmRestore'
  >;
};

export function RestoreBackupModal({ model }: Props) {
  const { restoreModal, setRestoreModal, isRestoring, handleConfirmRestore } = model;
  return <>{restoreModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-950/60 text-amber-400 rounded-xl border border-amber-800/70">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{restoreModal.title}</h3>
                  <p className="text-xs text-[var(--graphite-text-secondary)] font-mono">
                    {restoreModal.sourceDescription}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRestoreModal(null)}
                disabled={isRestoring}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-amber-950/40 text-amber-300 border border-amber-800/50 rounded-xl text-xs leading-relaxed">
                Restaurar este arquivo substituirá os dados atuais pelo conteúdo do backup selecionado.
              </div>

              {restoreModal.warnings && restoreModal.warnings.length > 0 && (
                <div className="p-3 bg-slate-900 text-slate-300 border border-slate-700 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-amber-400">Observações:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {restoreModal.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-bold text-slate-300">Resumo dos dados contidos:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Cargas Klabin</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.cargas}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Depósitos Klabin</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.depositos}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Clientes</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.clientes}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Vendas</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.vendas}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Produtos</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.produtos}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Motoristas</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.motoristas}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--graphite-border-subtle)] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRestoreModal(null)}
                disabled={isRestoring}
                className="px-3.5 py-2 bg-[#1a1d24] hover:bg-[#232832] disabled:opacity-50 text-slate-300 border border-[var(--graphite-border-base)] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <span>Restaurar backup</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}</>;
}
