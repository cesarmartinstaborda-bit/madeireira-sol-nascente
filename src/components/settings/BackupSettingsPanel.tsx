import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Download, FileText, Globe, HardDrive, Plus, RefreshCw, Upload, Wifi, WifiOff, XCircle } from 'lucide-react';
import { formatDateTimeBR } from '../../utils/formatters';
import { downloadBackupEntry } from '../../utils/storage';
import type { useSettingsController } from './useSettingsController';

type Props = {
  model: Pick<ReturnType<typeof useSettingsController>,
    'activeTab'
    | 'backupFeedback'
    | 'handleTestConnection'
    | 'isTestingConnection'
    | 'testResult'
    | 'syncState'
    | 'autoBackups'
    | 'handleCreateBackupNow'
    | 'handleExportBackupCurrent'
    | 'prepareRestoreModal'
    | 'importError'
    | 'importFileInputRef'
    | 'handleSelectImportFile'
  >;
};

export function BackupSettingsPanel({ model }: Props) {
  const {
    activeTab,
    backupFeedback,
    handleTestConnection,
    isTestingConnection,
    testResult,
    syncState,
    autoBackups,
    handleCreateBackupNow,
    handleExportBackupCurrent,
    prepareRestoreModal,
    importError,
    importFileInputRef,
    handleSelectImportFile,
  } = model;
  return <>{activeTab === 'DADOS_BACKUP' && (
        <div className="space-y-6">
          {/* Feedback messages */}
          {backupFeedback && (
            <div
              className={`p-4 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-top-1 ${
                backupFeedback.type === 'success'
                  ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/60'
                  : backupFeedback.type === 'error'
                  ? 'bg-rose-950/50 text-rose-300 border border-rose-800/60'
                  : 'bg-amber-950/50 text-amber-300 border border-amber-800/60'
              }`}
            >
              {backupFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : backupFeedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{backupFeedback.message}</span>
            </div>
          )}

          {/* SECTION 1: SINCRONIZAÇÃO */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Sincronização de Dados</h3>
                  <p className="text-xs text-[var(--graphite-text-secondary)]">
                    Estado do serviço de persistência e banco remoto
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="px-3.5 py-2 bg-[#1a1d24] hover:bg-[#232832] disabled:opacity-50 text-white border border-[var(--graphite-border-base)] rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--graphite-accent-blue)] ${isTestingConnection ? 'animate-spin' : ''}`} />
                <span>{isTestingConnection ? 'Testando...' : 'Testar conexão'}</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium flex items-center space-x-2 ${
                  testResult.success
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-800/50'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Firebase Status */}
              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-2">
                <div className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider">
                  Firebase Firestore
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                      syncState.isConfigured
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                        : 'bg-amber-950/60 text-amber-300 border-amber-800/70'
                    }`}
                  >
                    {syncState.isConfigured ? 'Configurado' : 'Não configurado'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  {syncState.isConfigured
                    ? 'Ambiente possui projeto Firebase configurado.'
                    : 'A aplicação está funcionando com armazenamento local neste dispositivo.'}
                </p>
              </div>

              {/* Card 2: Estado da Sincronização */}
              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-2">
                <div className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider">
                  Estado da Sincronização
                </div>
                <div className="flex items-center space-x-2">
                  {!syncState.isConfigured ? (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      <WifiOff className="w-3 h-3 text-slate-400" />
                      <span>Não configurado</span>
                    </span>
                  ) : syncState.status === 'CONNECTED' ? (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/70">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>Conectada</span>
                    </span>
                  ) : syncState.status === 'OFFLINE' ? (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/60 text-amber-300 border border-amber-800/70">
                      <WifiOff className="w-3 h-3 text-amber-400" />
                      <span>Offline</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/60 text-rose-300 border border-rose-800/70">
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span>Erro</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  {!syncState.isConfigured
                    ? 'Operando em modo local seguro neste navegador.'
                    : syncState.status === 'CONNECTED'
                    ? 'Sincronização em tempo real ativa e operando normalmente.'
                    : syncState.status === 'OFFLINE'
                    ? 'Sem conexão com a internet. A aplicação continua operando com armazenamento local.'
                    : 'Falha na conexão com o serviço Firestore.'}
                </p>
              </div>

              {/* Card 3: Última Sincronização Bem-Sucedida */}
              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-2">
                <div className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider">
                  Última Sincronização
                </div>
                <div className="flex items-center space-x-2 text-white font-mono text-xs font-bold pt-0.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--graphite-accent-blue)] shrink-0" />
                  <span>{formatDateTimeBR(syncState.lastSuccessfulSyncAt)}</span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Registro da última comunicação confirmada com o servidor.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: BACKUPS AUTOMÁTICOS */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-white">Backups Automáticos</h3>
                    <span className="px-2 py-0.5 bg-[#1a1d24] text-slate-300 border border-[var(--graphite-border-subtle)] rounded-md text-[11px] font-bold font-mono">
                      {autoBackups.length} / 5
                    </span>
                  </div>
                  <p className="text-xs text-[var(--graphite-text-secondary)]">
                    Histórico rotativo de cópias de segurança locais salvas automaticamente
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateBackupNow}
                  className="px-3.5 py-2 bg-[#1a1d24] hover:bg-[#232832] text-white border border-[var(--graphite-border-base)] rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Criar backup agora</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportBackupCurrent}
                  className="px-3.5 py-2 mac-button-primary rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar backup atual</span>
                </button>
              </div>
            </div>

            {/* Backups List */}
            {autoBackups.length === 0 ? (
              <div className="p-6 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] text-center text-xs text-[var(--graphite-text-secondary)]">
                Nenhum backup automático registrado até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {autoBackups.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-[#12151a] hover:bg-[#161a21] rounded-xl border border-[var(--graphite-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white font-mono">
                          {formatDateTimeBR(b.timestamp)}
                        </div>
                        <div className="text-[11px] text-[var(--graphite-text-secondary)] flex items-center space-x-2">
                          <span>Backup Automático</span>
                          <span>•</span>
                          <span>{b.filename || `madeireira_auto_backup_${idx + 1}.json`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => downloadBackupEntry(b)}
                        className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#232832] text-slate-200 border border-[var(--graphite-border-base)] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-[var(--graphite-accent-blue)]" />
                        <span>Baixar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          prepareRestoreModal(
                            'Restaurar Backup Automático',
                            `Cópia de ${formatDateTimeBR(b.timestamp)}`,
                            b.data
                          )
                        }
                        className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Restaurar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: IMPORTAÇÃO E RESTAURAÇÃO */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-amber-400 rounded-lg">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Importação e Restauração de Arquivo</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Carregue um arquivo JSON de backup gerado anteriormente para restaurar a base de dados
                </p>
              </div>
            </div>

            {importError && (
              <div className="p-3.5 bg-rose-950/50 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <div className="p-6 bg-[#12151a] rounded-xl border border-dashed border-[var(--graphite-border-base)] flex flex-col items-center justify-center text-center space-y-3">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleSelectImportFile}
                className="hidden"
              />

              <div className="p-3 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-xl border border-[var(--graphite-border-subtle)]">
                <FileText className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-white">
                  Selecione um arquivo de backup em formato JSON (.json)
                </p>
                <p className="text-[11px] text-[var(--graphite-text-secondary)] max-w-md">
                  Antes da restauração, o sistema validará o conteúdo do arquivo e apresentará o resumo completo das coleções contidas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                className="px-4 py-2 bg-[#1a1d24] hover:bg-[#232832] text-white border border-[var(--graphite-border-base)] rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[var(--graphite-accent-blue)]" />
                <span>Selecionar arquivo JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}</>;
}
