import { useEffect, useMemo, useState } from 'react';
import { ClientesProdutosDashboard } from './components/ClientesProdutosDashboard';
import { ConfiguracoesAjustes } from './components/ConfiguracoesAjustes';
import { ConfirmModal } from './components/ConfirmModal';
import { DashboardOverview } from './components/DashboardOverview';
import { Header } from './components/Header';
import { KlabinDashboard } from './components/KlabinDashboard';
import { RecordModal } from './components/RecordModal';
import { Sidebar } from './components/Sidebar';
import { TableCaixa } from './components/TableCaixa';
import { TableMotoristas } from './components/TableMotoristas';
import { TableResumo } from './components/TableResumo';
import { useCargaDepositoHandlers } from './hooks/useCargaDepositoHandlers';
import { useClienteVendaHandlers } from './hooks/useClienteVendaHandlers';
import { useFreightHandlers } from './hooks/useFreightHandlers';
import { useKlabinDatabase } from './hooks/useKlabinDatabase';
import { useMotoristaHandlers } from './hooks/useMotoristaHandlers';
import { useProdutoHandlers } from './hooks/useProdutoHandlers';
import { AppSettings, TableType } from './types';
import { computeDashboardMetrics } from './utils/dashboard/computedMetrics';
import { exportActiveTable } from './utils/exports/exportActiveTable';
import { restoreFirestoreAuthoritatively, syncFirestoreSettings, } from './utils/firebaseSync';
import { formatMonthYearBR, isMonthLocked } from './utils/formatters';
import { mergeAppSettings } from './utils/settings/mergeAppSettings';
import { createAutoBackup, saveDatabase, validateAndSanitizeBackupJSON } from './utils/storage';

export default function App() {
  const { database, setDatabase, mutateDatabase } = useKlabinDatabase();
  const [activeTable, setActiveTable] = useState<TableType>(() => {
    try {
      const pref = localStorage.getItem('app_startup_preference');
      if (pref === 'LAST_USED') {
        const last = localStorage.getItem('app_last_active_table') as TableType;
        const validModules: TableType[] = ['Dashboard', 'Klabin', 'Clientes_Produtos', 'Motoristas', 'Configuracoes'];
        if (last && validModules.includes(last)) {
          return last;
        }
      }
    } catch {
      // Fallback to Dashboard
    }
    return 'Dashboard';
  });
  const [klabinSubTab, setKlabinSubTab] = useState<'CARGAS' | 'DEPOSITOS'>('CARGAS');
  const [modalTableType, setModalTableType] = useState<TableType>('Cargas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Locked months synchronized via database.appSettings.cycles.lockedMonths
  const lockedMonths = database.appSettings?.cycles?.lockedMonths || [];

  const handleToggleLockMonth = (monthKey: string) => {
    const currentList = database.appSettings?.cycles?.lockedMonths || [];
    const isAlreadyLocked = currentList.includes(monthKey);
    const updatedLockedMonths = isAlreadyLocked
      ? currentList.filter((m) => m !== monthKey)
      : [...currentList, monthKey].sort((a, b) => b.localeCompare(a));

    handleUpdateAppSettings({
      cycles: {
        lockedMonths: updatedLockedMonths,
      },
    });

    const formatted = formatMonthYearBR(monthKey);
    if (isAlreadyLocked) {
      showToast(`Ciclo de ${formatted} reaberto.`);
    } else {
      showToast(`Ciclo de ${formatted} fechado.`);
    }
  };

  const isDateLocked = (dateStr?: string): boolean => {
    return isMonthLocked(dateStr, lockedMonths);
  };


  // Show transient notification toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Discreet feedback when an auto-generated PDF is (or isn't) mirrored to Google Drive
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { status: string; usedFallbackFolder?: boolean; message?: string }
        | undefined;
      if (!detail) return;
      if (detail.status === 'uploaded') {
        showToast(
          detail.usedFallbackFolder
            ? 'PDF enviado ao Google Drive (pasta "Madereira Desktop" criada automaticamente).'
            : 'PDF também salvo na pasta "Madereira Desktop" do Google Drive.'
        );
      } else if (detail.status === 'skipped-no-session') {
        showToast('PDF gerado localmente. Google Drive desconectado — upload ignorado.');
      } else {
        showToast(`PDF gerado. Falha ao enviar ao Drive: ${detail.message || 'erro desconhecido'}.`);
      }
    };
    window.addEventListener('drive-pdf-autoupload', handler);
    return () => window.removeEventListener('drive-pdf-autoupload', handler);
  }, []);

  // PRODUTOS HANDLERS
  const { handleAddProduto, handleUpdateProduto, handleDeleteProduto } = useProdutoHandlers({
    database,
    mutateDatabase,
    showToast,
  });

  // DYNAMIC COMPUTED METRICS
  const computedMetrics = useMemo(() => {
    return computeDashboardMetrics(database);
  }, [
    database.Cargas,
    database.Depositos_Klabin,
    database.Vendas,
    database.Motoristas,
    database.appSettings?.freightRatePerTon,
  ]);

  const klabinBalance = computedMetrics.saldoLiquidoKlabin;

  // Navigation Handler
  const handleSelectTable = (table: TableType) => {
    let targetMainModule: TableType = table;
    if (table === 'Depositos_Klabin' || table === 'Cargas') {
      targetMainModule = 'Klabin';
    }

    if (table === 'Depositos_Klabin') {
      setActiveTable('Klabin');
      setKlabinSubTab('DEPOSITOS');
    } else if (table === 'Cargas') {
      setActiveTable('Klabin');
      setKlabinSubTab('CARGAS');
    } else {
      setActiveTable(table);
    }
    setSearchTerm('');

    try {
      const validModules: TableType[] = ['Dashboard', 'Klabin', 'Clientes_Produtos', 'Motoristas', 'Configuracoes'];
      if (validModules.includes(targetMainModule)) {
        localStorage.setItem('app_last_active_table', targetMainModule);
      }
    } catch {
      // Ignore storage error
    }
  };

  // Add & Edit Handlers
  const handleAddRecord = (targetTable?: TableType) => {
    const entityType = targetTable || (activeTable === 'Klabin' ? (klabinSubTab === 'DEPOSITOS' ? 'Depositos_Klabin' : 'Cargas') : activeTable);
    setModalTableType(entityType);
    setRecordToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditRecord = (record: any, targetTable?: TableType) => {
    const entityType = targetTable || (activeTable === 'Klabin' ? (klabinSubTab === 'DEPOSITOS' ? 'Depositos_Klabin' : 'Cargas') : activeTable);
    setModalTableType(entityType);
    setRecordToEdit(record);
    setIsModalOpen(true);
  };

  // CARGAS & DEPOSITOS HANDLERS
  const {
    handleUpdateCargaRecord,
    handleUpdateDepositoRecord,
    handleDeleteCarga,
    handleDeleteDeposito,
    handleConfirmDelete,
    confirmDeleteTarget,
    cancelDelete,
    handleSaveCargaOrDeposito,
  } = useCargaDepositoHandlers({
    database,
    mutateDatabase,
    showToast,
    isDateLocked,
  });

  // Generic RecordModal dispatcher — delegates the upsert to whichever domain hook
  // owns the target collection. Only Cargas/Depositos_Klabin are reachable today.
  const handleSaveRecord = (savedRecord: any): boolean => {
    if (activeTable === 'Dashboard') return false;
    return handleSaveCargaOrDeposito(modalTableType, savedRecord);
  };

  // MOTORISTAS HANDLERS
  const { handleAddMotorista, handleUpdateMotorista, handleDeleteDriver } = useMotoristaHandlers({
    database,
    mutateDatabase,
    showToast,
  });

  // FRETE HANDLERS (keyed by driver, but write Cargas/Vendas)
  const { handlePayFreightForDriver, handleRevertFreightForDriver, handleToggleSingleFreight } =
    useFreightHandlers({
      database,
      mutateDatabase,
      showToast,
      isDateLocked,
    });

  // CLIENTES & VENDAS HANDLERS
  const {
    handleAddClient,
    handleUpdateClient,
    handleDeleteClient,
    handleAddVenda,
    handleUpdateVenda,
    handleDeleteVenda,
    handleToggleVendaStatus,
  } = useClienteVendaHandlers({
    database,
    mutateDatabase,
    showToast,
    isDateLocked,
  });

  // Authoritative Restore Backup (invoked from Configuracoes auto-backups)
  const handleRestoreBackup = async (
    importedData: any,
    backupInfo?: { filename?: string; timestamp?: string; skipConfirm?: boolean }
  ) => {
    const result = validateAndSanitizeBackupJSON(importedData);
    if (!result.isValid || !result.sanitizedDb) {
      showToast(`Erro na validação do backup: ${result.errorMessage || 'Formato de arquivo inválido.'}`);
      return;
    }

    if (!backupInfo?.skipConfirm) {
      const dateStr = backupInfo?.timestamp
        ? new Date(backupInfo.timestamp).toLocaleString('pt-BR')
        : (backupInfo?.filename || 'no arquivo selecionado');

      const confirmed = window.confirm(
        `Restaurar este backup substituirá os dados atuais pelo estado salvo em ${dateStr}.\n\nDeseja continuar?`
      );
      if (!confirmed) return;
    }

    // Save a safety backup of current state BEFORE applying restore
    createAutoBackup(database, { force: true });

    const cleanDb = result.sanitizedDb;

    // Apply local state without triggering additional auto-backup
    saveDatabase(cleanDb, { createBackup: false });
    setDatabase(cleanDb);

    // Authoritatively sync with Firestore (deleting remote orphaned docs, updating existing)
    const syncRes = await restoreFirestoreAuthoritatively(cleanDb);
    if (syncRes.success) {
      showToast('Backup restaurado com sucesso.');
    } else {
      showToast('Os dados foram restaurados localmente, mas ocorreu uma falha ao sincronizar com o Firebase.');
    }
  };

  // Export CSV for active table
  const handleExportCSV = () => {
    if (activeTable === 'Dashboard') return;

    exportActiveTable(activeTable, klabinSubTab, database, computedMetrics);
    showToast(`Arquivo CSV exportado com sucesso.`);
  };

  const handleUpdateCustomLogo = (logoBase64: string | undefined) => {
    setDatabase((prev) => ({
      ...prev,
      customLogo: logoBase64,
    }));
    syncFirestoreSettings({ customLogo: logoBase64 || null });
    if (logoBase64) {
      showToast('Logo personalizado da empresa salvo.');
    } else {
      showToast('Logo padrão restaurado.');
    }
  };

  const handleUpdateAppSettings = (newSettingsPartial: Partial<AppSettings>) => {
    mutateDatabase((prev) => {
      const merged = mergeAppSettings(prev.appSettings, newSettingsPartial);
      return {
        ...prev,
        appSettings: merged,
      };
    });

    const updatedAppSettings = mergeAppSettings(database.appSettings, newSettingsPartial);

    syncFirestoreSettings({
      appSettings: updatedAppSettings,
    });
  };

  return (
    <div className="mac-window min-h-screen bg-[var(--graphite-bg)] text-[var(--graphite-text-primary)] font-sans flex antialiased">
      {/* Left Sidebar Navigation - 5 Modules Only */}
      <Sidebar
        activeTable={activeTable}
        onSelectTable={handleSelectTable}
        counts={{
          Cargas: database.Cargas.length,
          Depositos_Klabin: database.Depositos_Klabin.length,
          Motoristas: (database.Motoristas || []).length,
          Resumo: computedMetrics.resumoRecords.length,
          Caixa: computedMetrics.caixaRecords.length,
          Clientes: database.Clientes?.length || 0,
          Vendas: database.Vendas?.length || 0,
          Produtos: database.Produtos?.length || 0,
        }}
        customLogo={database.customLogo}
        onUpdateCustomLogo={handleUpdateCustomLogo}
        companyName={database.appSettings?.company?.name || database.appSettings?.companyName}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          activeTable={activeTable}
          onExportCSV={handleExportCSV}
          klabinBalance={klabinBalance}
          customLogo={database.customLogo}
          companyName={database.appSettings?.company?.name || database.appSettings?.companyName}
        />

        {/* View Screens */}
        <main className="p-6 max-w-7xl w-full mx-auto flex-1">
          {activeTable === 'Dashboard' && (
            <DashboardOverview
              database={database}
              onNavigate={handleSelectTable}
              lockedMonths={lockedMonths}
              onToggleLockMonth={handleToggleLockMonth}
            />
          )}

          {(activeTable === 'Klabin' || activeTable === 'Cargas' || activeTable === 'Depositos_Klabin') && (
            <KlabinDashboard
              cargasRecords={database.Cargas}
              depositosRecords={database.Depositos_Klabin}
              searchTerm={searchTerm}
              activeSubTab={klabinSubTab}
              onSubTabChange={setKlabinSubTab}
              onEditCarga={(record) => handleEditRecord(record, 'Cargas')}
              onDeleteCarga={handleDeleteCarga}
              onAddCarga={() => handleAddRecord('Cargas')}
              onUpdateCargaRecord={handleUpdateCargaRecord}
              onEditDeposito={(record) => handleEditRecord(record, 'Depositos_Klabin')}
              onDeleteDeposito={handleDeleteDeposito}
              onAddDeposito={() => handleAddRecord('Depositos_Klabin')}
              onUpdateDepositoRecord={handleUpdateDepositoRecord}
              produtos={database.Produtos || []}
              lockedMonths={lockedMonths}
              motoristas={database.Motoristas || []}
              freightRatePerTon={database.appSettings?.freightRatePerTon || 15}
              initialSubTab={klabinSubTab}
              appSettings={database.appSettings}
              customLogo={database.customLogo}
            />
          )}

          {(activeTable === 'Clientes_Produtos' || activeTable === 'Gestao_Clientes' || activeTable === 'Vendas' || activeTable === 'Produtos') && (
            <ClientesProdutosDashboard
              clientes={database.Clientes || []}
              vendas={database.Vendas || []}
              produtos={database.Produtos || []}
              motoristas={database.Motoristas || []}
              freightRatePerTon={database.appSettings?.freightRatePerTon || 15}
              defaultSaleFreightPayable={database.appSettings?.freight?.defaultSaleFreightPayable ?? false}
              searchTerm={searchTerm}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
              onAddVenda={handleAddVenda}
              onUpdateVenda={handleUpdateVenda}
              onDeleteVenda={handleDeleteVenda}
              onToggleVendaStatus={handleToggleVendaStatus}
              onAddProduto={handleAddProduto}
              onUpdateProduto={handleUpdateProduto}
              onDeleteProduto={handleDeleteProduto}
              lockedMonths={lockedMonths}
              initialSubTab={activeTable === 'Produtos' ? 'PRODUTOS' : 'CLIENTES_VENDAS'}
              appSettings={database.appSettings}
              customLogo={database.customLogo}
            />
          )}

          {activeTable === 'Motoristas' && (
            <TableMotoristas
              cargas={database.Cargas}
              vendas={database.Vendas || []}
              motoristas={database.Motoristas || []}
              freightRatePerTon={database.appSettings?.freightRatePerTon || 15}
              searchTerm={searchTerm}
              onPayFreight={handlePayFreightForDriver}
              onRevertFreight={handleRevertFreightForDriver}
              onToggleSingleFreight={handleToggleSingleFreight}
              onAddMotorista={handleAddMotorista}
              onUpdateMotorista={handleUpdateMotorista}
              onDeleteMotorista={handleDeleteDriver}
              lockedMonths={lockedMonths}
              appSettings={database.appSettings}
              customLogo={database.customLogo}
            />
          )}

          {activeTable === 'Configuracoes' && (
            <ConfiguracoesAjustes
              appSettings={database.appSettings}
              customLogo={database.customLogo}
              klabinBalance={klabinBalance}
              motoristas={database.Motoristas || []}
              database={database}
              onUpdateAppSettings={handleUpdateAppSettings}
              onUpdateCustomLogo={handleUpdateCustomLogo}
              onToggleLockMonth={handleToggleLockMonth}
              freightRatePerTon={database.appSettings?.freightRatePerTon || 15}
              onRestoreBackup={handleRestoreBackup}
            />
          )}

          {activeTable === 'Resumo' && (
            <TableResumo
              records={computedMetrics.resumoRecords}
              searchTerm={searchTerm}
            />
          )}

          {activeTable === 'Caixa' && (
            <TableCaixa
              records={computedMetrics.caixaRecords}
              searchTerm={searchTerm}
            />
          )}
        </main>
      </div>

      {/* Record Creation / Edit Modal */}
      <RecordModal
        isOpen={isModalOpen}
        tableType={modalTableType}
        recordToEdit={recordToEdit}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRecord}
        produtos={database.Produtos || []}
        clientes={database.Clientes || []}
        motoristas={database.Motoristas || []}
        freightRatePerTon={database.appSettings?.freightRatePerTon || 15}
        defaultDeductFromBalance={database.appSettings?.klabin?.defaultDeductFromBalance ?? true}
        defaultCargoFreightPayable={database.appSettings?.freight?.defaultCargoFreightPayable ?? true}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDeleteTarget !== null}
        title={confirmDeleteTarget?.table === 'Depositos_Klabin' ? 'Excluir Depósito Klabin' : 'Excluir Carga'}
        message={
          confirmDeleteTarget?.table === 'Depositos_Klabin'
            ? 'Tem certeza de que deseja remover este depósito da Klabin? Esta ação não poderá ser desfeita e será sincronizada.'
            : 'Tem certeza de que deseja remover este registro de carga da base de dados? Esta ação não poderá ser desfeita e será sincronizada.'
        }
        onClose={cancelDelete}
        onConfirm={handleConfirmDelete}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#16191f] text-slate-100 text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-[var(--graphite-border-base)] flex items-center space-x-2.5">
          <div className="w-2 h-2 rounded-full bg-[var(--graphite-accent-blue)] animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
