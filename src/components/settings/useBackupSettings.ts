import React, { useEffect, useRef, useState } from 'react';
import type { KlabinDatabase } from '../../types';
import { FirebaseSyncStatus, getFirebaseSyncState, testFirebaseConnection } from '../../utils/firebaseSync';
import { AutoBackupEntry, createAutoBackup, exportDatabaseJSON, getAutoBackups, validateAndSanitizeBackupJSON } from '../../utils/storage';
import type { ConfiguracoesAjustesProps, SettingsSubTab } from './useSettingsController';

type Params = Pick<ConfiguracoesAjustesProps, 'database' | 'onRestoreBackup'> & { activeTab: SettingsSubTab };

/** Mounted with Settings, so pending restore state and listeners survive subtab switches. */
export function useBackupSettings({ database, onRestoreBackup, activeTab }: Params) {
  // ================= DADOS & BACKUP LOCAL STATE =================
  const [syncState, setSyncState] = useState<{
    isConfigured: boolean;
    status: FirebaseSyncStatus;
    lastSuccessfulSyncAt: string | null;
  }>(() => getFirebaseSyncState());
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [autoBackups, setAutoBackups] = useState<AutoBackupEntry[]>(() => getAutoBackups());
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreModal, setRestoreModal] = useState<{
    isOpen: boolean;
    title: string;
    sourceDescription: string;
    data: KlabinDatabase;
    summary: {
      cargas: number;
      depositos: number;
      clientes: number;
      vendas: number;
      produtos: number;
      motoristas: number;
    };
    warnings?: string[];
  } | null>(null);

  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize dynamic online/offline events for syncState
  useEffect(() => {
    const handleOnline = () => setSyncState(getFirebaseSyncState());
    const handleOffline = () => setSyncState(getFirebaseSyncState());
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Refresh sync state when activeTab switches to DADOS_BACKUP or APLICATIVO
  useEffect(() => {
    if (activeTab === 'DADOS_BACKUP' || activeTab === 'APLICATIVO') {
      setSyncState(getFirebaseSyncState());
      setAutoBackups(getAutoBackups());
    }
  }, [activeTab]);

  // ================= DADOS & BACKUP HANDLERS =================
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    const res = await testFirebaseConnection();
    setIsTestingConnection(false);
    setTestResult({
      success: res.success,
      message: res.message,
    });
    setSyncState(getFirebaseSyncState());
  };

  const handleCreateBackupNow = () => {
    if (!database) {
      setBackupFeedback({ type: 'error', message: 'Dados da aplicação indisponíveis para backup.' });
      setTimeout(() => setBackupFeedback(null), 4000);
      return;
    }

    createAutoBackup(database, { force: true });
    const updatedList = getAutoBackups();
    setAutoBackups(updatedList);
    setBackupFeedback({ type: 'success', message: 'Backup automático criado com sucesso.' });
    setTimeout(() => setBackupFeedback(null), 4000);
  };

  const handleExportBackupCurrent = () => {
    if (!database) {
      setBackupFeedback({ type: 'error', message: 'Dados da aplicação indisponíveis para exportação.' });
      setTimeout(() => setBackupFeedback(null), 4000);
      return;
    }

    exportDatabaseJSON(database);
    setBackupFeedback({ type: 'success', message: 'Arquivo de backup JSON exportado com sucesso.' });
    setTimeout(() => setBackupFeedback(null), 4000);
  };

  const prepareRestoreModal = (
    title: string,
    sourceDescription: string,
    targetDb: KlabinDatabase,
    warnings?: string[]
  ) => {
    const summary = {
      cargas: (targetDb.Cargas || []).length,
      depositos: (targetDb.Depositos_Klabin || []).length,
      clientes: (targetDb.Clientes || []).length,
      vendas: (targetDb.Vendas || []).length,
      produtos: (targetDb.Produtos || []).length,
      motoristas: (targetDb.Motoristas || []).length,
    };

    setRestoreModal({
      isOpen: true,
      title,
      sourceDescription,
      data: targetDb,
      summary,
      warnings,
    });
  };

  const handleSelectImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setImportError('Tipo de arquivo inválido. Selecione um arquivo de backup com extensão .json.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        setImportError('O arquivo selecionado não contém um JSON válido.');
        return;
      }
      const validation = validateAndSanitizeBackupJSON(parsed);

      if (!validation.isValid || !validation.sanitizedDb) {
        setImportError(validation.errorMessage || 'O arquivo selecionado não contém um backup válido.');
        return;
      }

      prepareRestoreModal(
        'Importar Arquivo de Backup',
        `Arquivo: ${file.name}`,
        validation.sanitizedDb,
        validation.warnings
      );
    };

    reader.onerror = () => {
      setImportError('Falha ao ler o arquivo de backup selecionado.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restoreModal || !onRestoreBackup) return;

    setIsRestoring(true);
    try {
      await onRestoreBackup(restoreModal.data, {
        filename: restoreModal.sourceDescription,
        skipConfirm: true,
      });
      setAutoBackups(getAutoBackups());
      setBackupFeedback({ type: 'success', message: 'Backup restaurado com sucesso.' });
      setTimeout(() => setBackupFeedback(null), 4000);
    } catch (err) {
      console.error(err);
      setBackupFeedback({ type: 'error', message: 'Ocorreu uma falha ao restaurar o backup.' });
    } finally {
      setIsRestoring(false);
      setRestoreModal(null);
    }
  };

  return {
    backupFeedback,
    setBackupFeedback,
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
    restoreModal,
    setRestoreModal,
    isRestoring,
    handleConfirmRestore,
  };
}
