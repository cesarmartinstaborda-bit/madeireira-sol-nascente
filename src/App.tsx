import React, { useState, useMemo } from 'react';
import {
  TableType,
  KlabinDatabase,
  ResumoRecord,
  CaixaRecord,
  AppSettings,
} from './types';
import {
  saveDatabase,
  exportTableCSV,
  validateAndSanitizeBackupJSON,
  createAutoBackup,
} from './utils/storage';
import {
  upsertFirestoreRecord,
  syncFirestoreSettings,
  restoreFirestoreAuthoritatively,
} from './utils/firebaseSync';
import { useKlabinDatabase } from './hooks/useKlabinDatabase';
import { useProdutoHandlers } from './hooks/useProdutoHandlers';
import { useMotoristaHandlers } from './hooks/useMotoristaHandlers';
import { useFreightHandlers } from './hooks/useFreightHandlers';
import { useCargaDepositoHandlers } from './hooks/useCargaDepositoHandlers';
import { useClienteVendaHandlers } from './hooks/useClienteVendaHandlers';
import { isMonthLocked, formatMonthYearBR } from './utils/formatters';
import { getFreightRecords, getPendingFreightTotal, getPaidFreightTotal, getTotalFreight } from './utils/freightUtils';
import { calcKlabinBalance } from './utils/klabinBalance';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TableMotoristas } from './components/TableMotoristas';
import { TableResumo } from './components/TableResumo';
import { TableCaixa } from './components/TableCaixa';
import { DashboardOverview } from './components/DashboardOverview';
import { ConfiguracoesAjustes } from './components/ConfiguracoesAjustes';
import { KlabinDashboard } from './components/KlabinDashboard';
import { ClientesProdutosDashboard } from './components/ClientesProdutosDashboard';
import { RecordModal } from './components/RecordModal';
import { ConfirmModal } from './components/ConfirmModal';

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

  // PRODUTOS HANDLERS
  const { handleAddProduto, handleUpdateProduto, handleDeleteProduto } = useProdutoHandlers({
    database,
    mutateDatabase,
    showToast,
  });

  // DYNAMIC COMPUTED METRICS
  const computedMetrics = useMemo(() => {
    const totalVolumeTons = database.Cargas.reduce(
      (acc, c) => acc + (Number(c.quantityTons) || 0),
      0
    );

    const totalComprasVal = database.Cargas.reduce(
      (acc, c) => acc + (Number(c.totalValue) || 0),
      0
    );

    const { totalDepositos, totalAbatido, saldo: saldoLiquidoKlabin } = calcKlabinBalance({
      cargas: database.Cargas,
      depositos: database.Depositos_Klabin,
    });
    const freightRatePerTon = database.appSettings?.freightRatePerTon || 15;

    const allFreightRecords = getFreightRecords(database);
    const totalFreteVal = getTotalFreight(database);

    const totalFreteTons = allFreightRecords.reduce(
      (acc, r) => acc + (Number(r.tons) || 0),
      0
    );

    const avgFretePerTon = totalFreteTons > 0 ? totalFreteVal / totalFreteTons : freightRatePerTon;

    const resumoRecords: ResumoRecord[] = [
      { id: 'res-dyn-1', metricName: 'Total Volume Cargas (Toneladas)', metricValue: Number(totalVolumeTons.toFixed(2)) },
      { id: 'res-dyn-2', metricName: 'Valor Total Compras de Cargas (R$)', metricValue: Number(totalComprasVal.toFixed(2)) },
      { id: 'res-dyn-3', metricName: 'Total Abatido do Saldo Klabin (R$)', metricValue: Number(totalAbatido.toFixed(2)) },
      { id: 'res-dyn-4', metricName: 'Total Depósitos Recebidos Klabin (R$)', metricValue: Number(totalDepositos.toFixed(2)) },
      { id: 'res-dyn-5', metricName: 'Saldo Líquido Disponível Klabin (R$)', metricValue: Number(saldoLiquidoKlabin.toFixed(2)) },
      { id: 'res-dyn-6', metricName: 'Custo Total de Fretes (R$)', metricValue: Number(totalFreteVal.toFixed(2)) },
      { id: 'res-dyn-7', metricName: 'Custo Médio de Frete / Tonelada (R$)', metricValue: Number(avgFretePerTon.toFixed(2)) },
    ];

    const caixaRecords: CaixaRecord[] = [
      {
        id: 'cx-dyn-1',
        balanceControlKlabin: 'Adiantamento Depósitos Klabin (Entrada de Caixa)',
        value: Number(totalDepositos.toFixed(2)),
      },
      {
        id: 'cx-dyn-2',
        balanceControlKlabin: 'Abatimento Saldo Cargas Fornecidas Klabin',
        value: -Number(totalAbatido.toFixed(2)),
      },
      {
        id: 'cx-dyn-3',
        balanceControlKlabin: 'Saldo Atualizado de Caixa Operacional Klabin',
        value: Number(saldoLiquidoKlabin.toFixed(2)),
      },
    ];

    return {
      totalVolumeTons,
      totalComprasVal,
      totalAbatido,
      totalDepositos,
      saldoLiquidoKlabin,
      totalFreteVal,
      totalFreteTons,
      avgFretePerTon,
      resumoRecords,
      caixaRecords,
    };
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

  const handleSaveRecord = (savedRecord: any): boolean => {
    if (activeTable === 'Dashboard') return false;

    if (savedRecord && savedRecord.date && isDateLocked(savedRecord.date)) {
      showToast('Operação bloqueada: não é possível salvar lançamentos em mês trancado no Fechamento de Ciclo.');
      return false;
    }

    let targetTableKey: keyof KlabinDatabase = 'Cargas';
    let firestoreCollection: string = 'cargas';

    if (modalTableType === 'Depositos_Klabin') {
      targetTableKey = 'Depositos_Klabin';
      firestoreCollection = 'depositos';
    } else if (modalTableType === 'Cargas') {
      targetTableKey = 'Cargas';
      firestoreCollection = 'cargas';
    } else if (modalTableType === 'Gestao_Clientes' || modalTableType === 'Vendas' || modalTableType === 'Clientes_Produtos') {
      targetTableKey = 'Vendas';
      firestoreCollection = 'vendas';
    } else if (modalTableType === 'Produtos') {
      targetTableKey = 'Produtos';
      firestoreCollection = 'produtos';
    } else if (modalTableType === 'Motoristas') {
      targetTableKey = 'Motoristas';
      firestoreCollection = 'motoristas';
    }

    mutateDatabase((prev) => {
      const currentList = [...((prev[targetTableKey] as any[]) || [])];
      const existingIndex = currentList.findIndex((item) => item.id === savedRecord.id);

      if (existingIndex >= 0) {
        currentList[existingIndex] = savedRecord;
      } else {
        currentList.push(savedRecord);
      }

      return {
        ...prev,
        [targetTableKey]: currentList,
      };
    });

    upsertFirestoreRecord(firestoreCollection, savedRecord);

    const entityLabel = targetTableKey === 'Depositos_Klabin' ? 'Depósito Klabin' : targetTableKey === 'Cargas' ? 'Carga' : 'Registro';
    showToast(`${entityLabel} salvo com sucesso.`);
    return true;
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
  } = useCargaDepositoHandlers({
    database,
    mutateDatabase,
    showToast,
    isDateLocked,
  });

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
    createAutoBackup(database);

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

    switch (activeTable) {
      case 'Klabin':
        if (klabinSubTab === 'DEPOSITOS') {
          exportTableCSV('Depositos_Klabin', database.Depositos_Klabin, [
            { key: 'date', label: 'Data Depósito' },
            { key: 'value', label: 'Valor Depósito (R$)' },
            { key: 'notes', label: 'Observações / Comprovante' },
          ]);
        } else {
          exportTableCSV('Cargas', database.Cargas, [
            { key: 'date', label: 'Data Compra' },
            { key: 'supplier', label: 'Fornecedor' },
            { key: 'product', label: 'Produto' },
            { key: 'quantityTons', label: 'Quantidade (Ton)' },
            { key: 'valuePerTon', label: 'Valor/Ton (R$)' },
            { key: 'totalValue', label: 'Valor Total (R$)' },
            { key: 'driverPlate', label: 'Motorista / Placa' },
            { key: 'freightPayable', label: 'Frete a Pagar?' },
            { key: 'freightCost', label: 'Custo Frete (R$)' },
            { key: 'deductFromBalance', label: 'Abater do Saldo?' },
            { key: 'notes', label: 'Observações' },
          ]);
        }
        break;
      case 'Cargas':
        exportTableCSV('Cargas', database.Cargas, [
          { key: 'date', label: 'Data Compra' },
          { key: 'supplier', label: 'Fornecedor' },
          { key: 'product', label: 'Produto' },
          { key: 'quantityTons', label: 'Quantidade (Ton)' },
          { key: 'valuePerTon', label: 'Valor/Ton (R$)' },
          { key: 'totalValue', label: 'Valor Total (R$)' },
          { key: 'driverPlate', label: 'Motorista / Placa' },
          { key: 'freightPayable', label: 'Frete a Pagar?' },
          { key: 'freightCost', label: 'Custo Frete (R$)' },
          { key: 'deductFromBalance', label: 'Abater do Saldo?' },
          { key: 'notes', label: 'Observações' },
        ]);
        break;
      case 'Depositos_Klabin':
        exportTableCSV('Depositos_Klabin', database.Depositos_Klabin, [
          { key: 'date', label: 'Data Depósito' },
          { key: 'value', label: 'Valor Depósito (R$)' },
          { key: 'notes', label: 'Observações / Comprovante' },
        ]);
        break;
      case 'Motoristas':
        exportTableCSV('Motoristas', database.Motoristas || [], [
          { key: 'name', label: 'Nome Motorista' },
          { key: 'licensePlate', label: 'Placa Veículo' },
          { key: 'trailerPlate', label: 'Placa Reboque' },
          { key: 'phone', label: 'Telefone' },
          { key: 'pixKey', label: 'Chave PIX' },
          { key: 'status', label: 'Status' },
        ]);
        break;
      case 'Clientes_Produtos':
      case 'Gestao_Clientes':
      case 'Vendas':
        exportTableCSV('Vendas', database.Vendas || [], [
          { key: 'date', label: 'Data Venda' },
          { key: 'clientName', label: 'Nome Cliente' },
          { key: 'product', label: 'Produto' },
          { key: 'quantity', label: 'Quantidade' },
          { key: 'unitPrice', label: 'Preço Unitário (R$)' },
          { key: 'totalValue', label: 'Valor Total (R$)' },
          { key: 'status', label: 'Status' },
          { key: 'notes', label: 'Observações' },
        ]);
        break;
      case 'Produtos':
        exportTableCSV('Produtos', database.Produtos || [], [
          { key: 'name', label: 'Nome Produto' },
          { key: 'unitOfMeasure', label: 'Unidade de Medida' },
          { key: 'referencePrice', label: 'Preço de Referência' },
          { key: 'status', label: 'Status' },
        ]);
        break;
      case 'Resumo':
        exportTableCSV('Resumo', computedMetrics.resumoRecords, [
          { key: 'metricName', label: 'Nome da Métrica' },
          { key: 'metricValue', label: 'Valor da Métrica' },
        ]);
        break;
      case 'Caixa':
        exportTableCSV('Caixa', computedMetrics.caixaRecords, [
          { key: 'balanceControlKlabin', label: 'Controle de Saldo Klabin' },
          { key: 'value', label: 'Valor (R$)' },
        ]);
        break;
    }
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
      const merged: AppSettings = {
        freightRatePerTon: newSettingsPartial.freightRatePerTon !== undefined
          ? newSettingsPartial.freightRatePerTon
          : (prev.appSettings?.freightRatePerTon || 15),
        company: {
          name: 'Madeireira Sol Nascente',
          ...(prev.appSettings?.company || {}),
          ...(newSettingsPartial.company || {}),
        },
        klabin: {
          defaultDeductFromBalance: true,
          ...(prev.appSettings?.klabin || {}),
          ...(newSettingsPartial.klabin || {}),
        },
        freight: {
          defaultCargoFreightPayable: true,
          defaultSaleFreightPayable: false,
          ...(prev.appSettings?.freight || {}),
          ...(newSettingsPartial.freight || {}),
        },
        cycles: {
          lockedMonths: [],
          ...(prev.appSettings?.cycles || {}),
          ...(newSettingsPartial.cycles || {}),
        },
        companyName:
          newSettingsPartial.company?.name ||
          newSettingsPartial.companyName ||
          prev.appSettings?.company?.name ||
          prev.appSettings?.companyName ||
          'Madeireira Sol Nascente',
      };
      return {
        ...prev,
        appSettings: merged,
      };
    });

    const updatedAppSettings: AppSettings = {
      freightRatePerTon: newSettingsPartial.freightRatePerTon !== undefined
        ? newSettingsPartial.freightRatePerTon
        : (database.appSettings?.freightRatePerTon || 15),
      company: {
        name: 'Madeireira Sol Nascente',
        ...(database.appSettings?.company || {}),
        ...(newSettingsPartial.company || {}),
      },
      klabin: {
        defaultDeductFromBalance: true,
        ...(database.appSettings?.klabin || {}),
        ...(newSettingsPartial.klabin || {}),
      },
      freight: {
        defaultCargoFreightPayable: true,
        defaultSaleFreightPayable: false,
        ...(database.appSettings?.freight || {}),
        ...(newSettingsPartial.freight || {}),
      },
      cycles: {
        lockedMonths: [],
        ...(database.appSettings?.cycles || {}),
        ...(newSettingsPartial.cycles || {}),
      },
      companyName:
        newSettingsPartial.company?.name ||
        newSettingsPartial.companyName ||
        database.appSettings?.company?.name ||
        database.appSettings?.companyName ||
        'Madeireira Sol Nascente',
    };

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
              onEdit={handleEditRecord}
              onDelete={handleDeleteCarga}
              onAdd={handleAddRecord}
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
