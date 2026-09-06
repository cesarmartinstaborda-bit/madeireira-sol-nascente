import { Settings, ShieldCheck } from 'lucide-react';
import React from 'react';
import { KlabinDatabase } from '../types';
import { GoogleDriveExplorer } from './GoogleDriveExplorer';
import { ApplicationSettingsPanel } from './settings/ApplicationSettingsPanel';
import { BackupSettingsPanel } from './settings/BackupSettingsPanel';
import { CompanySettingsPanel } from './settings/CompanySettingsPanel';
import { CyclesSettingsPanel } from './settings/CyclesSettingsPanel';
import { FreightSettingsPanel } from './settings/FreightSettingsPanel';
import { KlabinSettingsPanel } from './settings/KlabinSettingsPanel';
import { RestoreBackupModal } from './settings/RestoreBackupModal';
import { useSettingsController, type ConfiguracoesAjustesProps } from './settings/useSettingsController';
export { checkLocalStorageAvailable, detectAppEnvironment } from './settings/useSettingsController';
export type { SettingsSubTab } from './settings/useSettingsController';

export const ConfiguracoesAjustes: React.FC<ConfiguracoesAjustesProps> = (props) => {
  const model = useSettingsController(props);
  const { tabs, activeTab, setActiveTab, database, onRestoreBackup, setBackupFeedback } = model;
  return (<div className="space-y-6">
      {/* Module Title Header */}
      <div className="glass-card-static p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-xl border border-[var(--graphite-border-subtle)]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Configurações e Ajustes</h2>
            <p className="text-xs text-[var(--graphite-text-secondary)] mt-0.5">
              Central de preferências globais, informações institucionais e administração do sistema
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#1a1d24] border border-[var(--graphite-border-subtle)] px-3.5 py-1.5 rounded-lg text-xs text-[var(--graphite-text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Preferências Globais • Persistência Sincronizada</span>
        </div>
      </div>

      {/* Internal Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)] overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[var(--graphite-surface-2)] text-white shadow-xs border border-[var(--graphite-border-base)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1d24]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--graphite-accent-blue)]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: EMPRESA ================= */}
      <CompanySettingsPanel model={model} />

      {/* ================= TAB 2: KLABIN ================= */}
      <KlabinSettingsPanel model={model} />

      {/* ================= TAB 3: FRETES ================= */}
      <FreightSettingsPanel model={model} />

      {/* ================= TAB 4: CICLOS ================= */}
      <CyclesSettingsPanel model={model} />

      {/* ================= TAB 5: DADOS & BACKUP ================= */}
      <BackupSettingsPanel model={model} />

      {/* ================= TAB: GOOGLE DRIVE ================= */}
      {activeTab === 'GOOGLE_DRIVE' && (
        <GoogleDriveExplorer
          database={database || ({} as KlabinDatabase)}
          onRestoreDatabase={(restoredDb) => {
            if (onRestoreBackup) {
              onRestoreBackup(restoredDb, {
                filename: 'Google Drive Cloud Backup',
              });
            }
          }}
          onShowToast={(msg) => {
            setBackupFeedback({ type: 'success', message: msg });
            setTimeout(() => setBackupFeedback(null), 4500);
          }}
        />
      )}

      {/* ================= TAB 6: APLICATIVO ================= */}
      <ApplicationSettingsPanel model={model} />

      {/* RESTORE CONFIRMATION MODAL */}
      <RestoreBackupModal model={model} />
    </div>);
};
