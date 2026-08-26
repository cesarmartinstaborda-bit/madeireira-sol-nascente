import React, { useState, useEffect, useMemo } from 'react';
import {
  TableType,
  KlabinDatabase,
  CargaRecord,
  DepositoKlabinRecord,
  ResumoRecord,
  CaixaRecord,
  ClientRecord,
  VendaRecord,
  ProdutoRecord,
  MotoristaRecord,
  AppSettings,
} from './types';
import {
  loadDatabase,
  saveDatabase,
  exportTableCSV,
  validateAndSanitizeBackupJSON,
  sanitizeDatabase,
  createAutoBackup,
} from './utils/storage';
import {
  subscribeToFirestore,
  deleteFirestoreRecord,
  upsertFirestoreRecord,
  syncFirestoreSettings,
  checkAndSeedFirestoreIfEmpty,
  restoreFirestoreAuthoritatively,
} from './utils/firebaseSync';
import { generateId } from './utils/idGenerator';
import { normalizeIsoDate, isMonthLocked, formatMonthYearBR } from './utils/formatters';
import { getFreightRecords, getPendingFreightTotal, getPaidFreightTotal, getTotalFreight } from './utils/freightUtils';
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
  const [database, setDatabase] = useState<KlabinDatabase>(() => loadDatabase());
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
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: string; table: string } | null>(null);
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

  // Persist locally whenever state changes (without triggering auto-backup on mount/reload/snapshots)
  useEffect(() => {
    saveDatabase(database, { createBackup: false });
  }, [database]);

  // Helper for applying user mutations with immediate auto-backup trigger
  const mutateDatabase = (updater: (prev: KlabinDatabase) => KlabinDatabase) => {
    setDatabase((prev) => {
      const next = sanitizeDatabase(updater(prev));
      saveDatabase(next, { createBackup: true });
      return next;
    });
  };

  // Real-time Firestore sync with authoritative collections
  useEffect(() => {
    checkAndSeedFirestoreIfEmpty(database).catch((err) => {
      console.warn('[Firestore] Inicialização:', err);
    });

    const unsubscribe = subscribeToFirestore((collectionKey, data) => {
      setDatabase((prev) => {
        if (collectionKey === 'Settings') {
          const updated = {
            ...prev,
            appSettings: data.appSettings !== undefined ? data.appSettings : prev.appSettings,
            customLogo: data.customLogo !== undefined ? data.customLogo : prev.customLogo,
          };
          return sanitizeDatabase(updated);
        }

        const updated = {
          ...prev,
          [collectionKey]: data,
        };
        return sanitizeDatabase(updated);
      });
    });

    return () => unsubscribe();
  }, []);

  // Real-time inline update handlers for Data Grids
  const handleUpdateCargaRecord = (updatedCarga: CargaRecord) => {
    if (isDateLocked(updatedCarga.date)) {
      showToast('Operação bloqueada: o mês deste lançamento está trancado no Fechamento de Ciclo.');
      return;
    }
    mutateDatabase((prev) => ({
      ...prev,
      Cargas: prev.Cargas.map((c) => (c.id === updatedCarga.id ? updatedCarga : c)),
    }));
    upsertFirestoreRecord('cargas', updatedCarga);
  };

  const handleUpdateDepositoRecord = (updatedDeposito: DepositoKlabinRecord) => {
    if (isDateLocked(updatedDeposito.date)) {
      showToast('Operação bloqueada: o mês deste depósito está trancado no Fechamento de Ciclo.');
      return;
    }
    mutateDatabase((prev) => ({
      ...prev,
      Depositos_Klabin: prev.Depositos_Klabin.map((d) => (d.id === updatedDeposito.id ? updatedDeposito : d)),
    }));
    upsertFirestoreRecord('depositos', updatedDeposito);
  };

  // CLIENT & VENDA HANDLERS
  const handleAddClient = (clientData: Partial<ClientRecord>) => {
    const trimmedName = (clientData.name || '').trim();
    if (!trimmedName) {
      showToast('Erro de validação: O nome do cliente não pode ser vazio.');
      return;
    }

    const newClient: ClientRecord = {
      id: generateId('cli'),
      name: trimmedName,
      contact: (clientData.contact || '').trim() || 'Não informado',
      notes: (clientData.notes || '').trim(),
      createdAt: new Date().toISOString(),
    };
    mutateDatabase((prev) => ({
      ...prev,
      Clientes: [...(prev.Clientes || []), newClient],
    }));
    upsertFirestoreRecord('clientes', newClient);
    showToast(`Cliente ${newClient.name} cadastrado com sucesso.`);
  };

  const handleUpdateClient = (updatedClient: ClientRecord) => {
    mutateDatabase((prev) => ({
      ...prev,
      Clientes: (prev.Clientes || []).map((c) => (c.id === updatedClient.id ? updatedClient : c)),
    }));
    upsertFirestoreRecord('clientes', updatedClient);
    showToast(`Cliente ${updatedClient.name} atualizado.`);
  };

  const handleDeleteClient = (clientId: string) => {
    mutateDatabase((prev) => ({
      ...prev,
      Clientes: (prev.Clientes || []).filter((c) => c.id !== clientId),
    }));
    deleteFirestoreRecord('clientes', clientId);
    showToast('Cliente removido.');
  };

  const handleAddVenda = (vendaData: Partial<VendaRecord>) => {
    const vDate = normalizeIsoDate(vendaData.date);
    if (isDateLocked(vDate)) {
      showToast('Operação bloqueada: o mês selecionado está trancado no Fechamento de Ciclo.');
      return;
    }
    const clientName = (vendaData.clientName || '').trim();
    if (!clientName) {
      showToast('Erro de validação: Informe um cliente para a venda.');
      return;
    }
    const product = (vendaData.product || '').trim();
    if (!product) {
      showToast('Erro de validação: Informe um produto para a venda.');
      return;
    }

    const newVenda: VendaRecord = {
      id: generateId('vnd'),
      date: vDate,
      clientId: vendaData.clientId || 'cli-general',
      clientName,
      product,
      quantity: Number(vendaData.quantity) || 1,
      unitPrice: Number(vendaData.unitPrice) || 0,
      totalValue: Number(vendaData.totalValue) || (Number(vendaData.quantity) || 1) * (Number(vendaData.unitPrice) || 0),
      status: vendaData.status || 'PENDING',
      notes: (vendaData.notes || '').trim(),
      createdAt: new Date().toISOString(),
    };
    mutateDatabase((prev) => ({
      ...prev,
      Vendas: [...(prev.Vendas || []), newVenda],
    }));
    upsertFirestoreRecord('vendas', newVenda);
    showToast(`Venda lançada para ${newVenda.clientName}.`);
  };

  const handleUpdateVenda = (updatedVenda: VendaRecord) => {
    if (isDateLocked(updatedVenda.date)) {
      showToast('Operação bloqueada: esta venda pertence a um mês trancado no Fechamento de Ciclo.');
      return;
    }
    mutateDatabase((prev) => ({
      ...prev,
      Vendas: (prev.Vendas || []).map((v) => (v.id === updatedVenda.id ? updatedVenda : v)),
    }));
    upsertFirestoreRecord('vendas', updatedVenda);
    showToast('Venda atualizada.');
  };

  const handleDeleteVenda = (vendaId: string) => {
    const existingVenda = (database.Vendas || []).find((v) => v.id === vendaId);
    if (existingVenda && isDateLocked(existingVenda.date)) {
      showToast('Operação bloqueada: não é possível excluir venda em mês trancado no Fechamento de Ciclo.');
      return;
    }
    mutateDatabase((prev) => ({
      ...prev,
      Vendas: (prev.Vendas || []).filter((v) => v.id !== vendaId),
    }));
    deleteFirestoreRecord('vendas', vendaId);
    showToast('Lançamento de venda removido.');
  };

  const handleToggleVendaStatus = (vendaId: string) => {
    const existingVenda = (database.Vendas || []).find((v) => v.id === vendaId);
    if (existingVenda && isDateLocked(existingVenda.date)) {
      showToast('Operação bloqueada: não é possível alterar status de venda em mês trancado.');
      return;
    }
    let updatedRecord: VendaRecord | null = null;
    mutateDatabase((prev) => {
      const updatedVendas = (prev.Vendas || []).map((v) => {
        if (v.id === vendaId) {
          const newStatus = v.status === 'PAID' ? 'PENDING' : 'PAID';
          updatedRecord = {
            ...v,
            status: newStatus as 'PENDING' | 'PAID',
            paidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
          };
          return updatedRecord;
        }
        return v;
      });
      return {
        ...prev,
        Vendas: updatedVendas,
      };
    });
    if (updatedRecord) {
      upsertFirestoreRecord('vendas', updatedRecord);
    }
    showToast('Status de quitação da venda alterado.');
  };

  // PRODUTOS HANDLERS
  const handleAddProduto = (prodData: Partial<ProdutoRecord>) => {
    const name = (prodData.name || '').trim();
    if (!name) {
      showToast('Erro de validação: Nome do produto é obrigatório.');
      return;
    }
    const newProd: ProdutoRecord = {
      id: generateId('p'),
      name,
      unitOfMeasure: prodData.unitOfMeasure || 'ton',
      referencePrice: Number(prodData.referencePrice) || 250,
      status: prodData.status || 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    mutateDatabase((prev) => ({
      ...prev,
      Produtos: [...(prev.Produtos || []), newProd],
    }));
    upsertFirestoreRecord('produtos', newProd);
    showToast(`Produto ${newProd.name} cadastrado com sucesso.`);
  };

  const handleUpdateProduto = (updatedProd: ProdutoRecord) => {
    mutateDatabase((prev) => ({
      ...prev,
      Produtos: (prev.Produtos || []).map((p) => (p.id === updatedProd.id ? updatedProd : p)),
    }));
    upsertFirestoreRecord('produtos', updatedProd);
    showToast(`Produto ${updatedProd.name} atualizado.`);
  };

  const handleDeleteProduto = (prodId: string) => {
    const targetProd = (database.Produtos || []).find((p) => p.id === prodId);
    if (!targetProd) return;

    const prodNameLower = targetProd.name.trim().toLowerCase();
    const hasCargas = (database.Cargas || []).some(
      (c) => c.productId === prodId || (c.product && c.product.trim().toLowerCase() === prodNameLower)
    );
    const hasVendas = (database.Vendas || []).some(
      (v) => v.productId === prodId || (v.product && v.product.trim().toLowerCase() === prodNameLower)
    );

    if (hasCargas || hasVendas) {
      const inactivated: ProdutoRecord = {
        ...targetProd,
        status: 'INACTIVE',
      };
      mutateDatabase((prev) => ({
        ...prev,
        Produtos: (prev.Produtos || []).map((p) => (p.id === prodId ? inactivated : p)),
      }));
      upsertFirestoreRecord('produtos', inactivated);
      showToast(`Produto ${targetProd.name} possui histórico e foi desativado (INATIVO) para preservar os registros.`);
    } else {
      mutateDatabase((prev) => ({
        ...prev,
        Produtos: (prev.Produtos || []).filter((p) => p.id !== prodId),
      }));
      deleteFirestoreRecord('produtos', prodId);
      showToast(`Produto ${targetProd.name} removido do catálogo.`);
    }
  };

  // Show transient notification toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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

    const totalAbatido = database.Cargas
      .filter((c) => c.deductFromBalance === 'YES' || (c.deductFromBalance as any) === true)
      .reduce((acc, c) => acc + (Number(c.totalValue) || 0), 0);

    const totalDepositos = database.Depositos_Klabin.reduce(
      (acc, d) => acc + (Number(d.value) || 0),
      0
    );

    const saldoLiquidoKlabin = totalDepositos - totalAbatido;
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

  // Delete Handlers with Firestore sync
  const handleDeleteCarga = (id: string) => {
    const item = database.Cargas.find((c) => c.id === id);
    if (item && item.date && isDateLocked(item.date)) {
      showToast('Operação bloqueada: o registro pertence a um mês trancado no Fechamento de Ciclo.');
      return;
    }
    setConfirmDeleteTarget({ id, table: 'Cargas' });
  };

  const handleDeleteDeposito = (id: string) => {
    const item = database.Depositos_Klabin.find((d) => d.id === id);
    if (item && item.date && isDateLocked(item.date)) {
      showToast('Operação bloqueada: o registro pertence a um mês trancado no Fechamento de Ciclo.');
      return;
    }
    setConfirmDeleteTarget({ id, table: 'Depositos_Klabin' });
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteTarget) return;
    const { id, table } = confirmDeleteTarget;

    if (table === 'Cargas') {
      mutateDatabase((prev) => ({
        ...prev,
        Cargas: prev.Cargas.filter((c) => c.id !== id),
      }));
      deleteFirestoreRecord('cargas', id);
      showToast('Carga excluída com sucesso.');
    } else if (table === 'Depositos_Klabin') {
      mutateDatabase((prev) => ({
        ...prev,
        Depositos_Klabin: prev.Depositos_Klabin.filter((d) => d.id !== id),
      }));
      deleteFirestoreRecord('depositos', id);
      showToast('Depósito excluído com sucesso.');
    }

    setConfirmDeleteTarget(null);
  };

  // MOTORISTAS HANDLERS
  const handleAddMotorista = (motorista: MotoristaRecord) => {
    mutateDatabase((prev) => ({
      ...prev,
      Motoristas: [...(prev.Motoristas || []), motorista],
    }));
    upsertFirestoreRecord('motoristas', motorista);
    showToast(`Motorista ${motorista.name} cadastrado com sucesso.`);
  };

  const handleUpdateMotorista = (motorista: MotoristaRecord) => {
    mutateDatabase((prev) => ({
      ...prev,
      Motoristas: (prev.Motoristas || []).map((m) => (m.id === motorista.id ? motorista : m)),
    }));
    upsertFirestoreRecord('motoristas', motorista);
    showToast(`Cadastro do motorista ${motorista.name} atualizado.`);
  };

  const handleDeleteDriver = (id: string) => {
    const driver = (database.Motoristas || []).find((m) => m.id === id);
    if (!driver) return;

    // Relational safety check: Check if driver has linked historical data in Cargas or Vendas
    const driverPlateFormatted = `${driver.name} / ${driver.licensePlate}`;
    const hasInCargas = (database.Cargas || []).some(
      (c) =>
        c.motoristaId === driver.id ||
        c.driverId === driver.id ||
        c.driverPlate === driver.id ||
        (c.driverPlate && c.driverPlate.trim() === driverPlateFormatted) ||
        (c.licensePlate && c.licensePlate.trim() === driver.licensePlate) ||
        (c.driverPlate && c.driverPlate.trim() === driver.name) ||
        (c.driverPlate && c.driverPlate.trim() === driver.licensePlate)
    );

    const hasInVendas = (database.Vendas || []).some(
      (v) =>
        v.motoristaId === driver.id ||
        v.driverId === driver.id ||
        v.driverPlate === driver.id ||
        (v.driverPlate && v.driverPlate.trim() === driverPlateFormatted) ||
        (v.licensePlate && v.licensePlate.trim() === driver.licensePlate) ||
        (v.driverPlate && v.driverPlate.trim() === driver.name) ||
        (v.driverPlate && v.driverPlate.trim() === driver.licensePlate)
    );

    const hasLinkedRecords = hasInCargas || hasInVendas;

    if (hasLinkedRecords) {
      // Soft Delete: update status to 'INACTIVE' to preserve relational history
      const inactived = { ...driver, status: 'INACTIVE' as const };
      mutateDatabase((prev) => ({
        ...prev,
        Motoristas: (prev.Motoristas || []).map((m) =>
          m.id === id ? inactived : m
        ),
      }));
      upsertFirestoreRecord('motoristas', inactived);
      showToast(`Motorista "${driver.name}" possui lançamentos vinculados e foi inativado (Soft Delete).`);
    } else {
      // Hard Delete: remove permanently from database and Firestore
      mutateDatabase((prev) => ({
        ...prev,
        Motoristas: (prev.Motoristas || []).filter((m) => m.id !== id),
      }));
      deleteFirestoreRecord('motoristas', id);
      showToast(`Motorista "${driver.name}" foi excluído permanentemente.`);
    }
  };

  // Pay all pending freights for a given motorista/plate (respecting locked months)
  const handlePayFreightForDriver = (driverKeyOrId: string, transactionKey?: string) => {
    const updatedCargasToSync: CargaRecord[] = [];
    const updatedVendasToSync: VendaRecord[] = [];
    let skippedLockedCount = 0;
    let paidCount = 0;

    const matchedMotorista = (database.Motoristas || []).find(
      (m) => m.id === driverKeyOrId || `${m.name} / ${m.licensePlate}` === driverKeyOrId || m.licensePlate === driverKeyOrId
    );
    const targetDriverId = matchedMotorista?.id || driverKeyOrId;
    const targetDriverName = matchedMotorista?.name || driverKeyOrId;

    mutateDatabase((prev) => {
      const isRecordMatch = (r: { driverId?: string; motoristaId?: string; driverPlate?: string; licensePlate?: string }) => {
        if (targetDriverId && (r.driverId === targetDriverId || r.motoristaId === targetDriverId)) return true;
        const key = (r.driverPlate || r.licensePlate || 'Motorista Não Identificado').trim();
        return key === driverKeyOrId || (matchedMotorista && (key.includes(matchedMotorista.licensePlate) || key.includes(matchedMotorista.name)));
      };

      const newCargas = prev.Cargas.map((c) => {
        if (isRecordMatch(c) && c.freightPayable !== 'NO' && (c.freightPayable as any) !== false && c.freightStatus !== 'PAID') {
          if (c.date && isDateLocked(c.date)) {
            skippedLockedCount++;
            return c;
          }
          paidCount++;
          const updated = {
            ...c,
            freightStatus: 'PAID' as const,
            freightPaidAt: new Date().toISOString(),
            transactionKey: transactionKey || c.transactionKey,
          };
          updatedCargasToSync.push(updated);
          return updated;
        }
        return c;
      });

      const newVendas = (prev.Vendas || []).map((v) => {
        if (isRecordMatch(v) && v.freightPayable !== 'NO' && (v.freightPayable as any) !== false && v.freightStatus !== 'PAID') {
          if (v.date && isDateLocked(v.date)) {
            skippedLockedCount++;
            return v;
          }
          paidCount++;
          const updated = {
            ...v,
            freightStatus: 'PAID' as const,
            freightPaidAt: new Date().toISOString(),
            transactionKey: transactionKey || v.transactionKey,
          };
          updatedVendasToSync.push(updated);
          return updated;
        }
        return v;
      });

      return {
        ...prev,
        Cargas: newCargas,
        Vendas: newVendas,
      };
    });

    updatedCargasToSync.forEach((c) => upsertFirestoreRecord('cargas', c));
    updatedVendasToSync.forEach((v) => upsertFirestoreRecord('vendas', v));

    if (paidCount > 0 && skippedLockedCount > 0) {
      showToast(`Fretes quitados para ${targetDriverName} (${skippedLockedCount} registro(s) em meses trancados foram preservados).`);
    } else if (paidCount > 0) {
      showToast(`Fretes quitados com sucesso para ${targetDriverName}!`);
    } else if (skippedLockedCount > 0) {
      showToast(`Todos os fretes pendentes pertencem a meses trancados no Fechamento de Ciclo.`);
    } else {
      showToast(`Nenhum frete pendente para quitar.`);
    }
  };

  // Revert all paid freights for a given motorista/plate back to PENDING (respecting locked months)
  const handleRevertFreightForDriver = (driverKeyOrId: string) => {
    const revertedCargasToSync: CargaRecord[] = [];
    const revertedVendasToSync: VendaRecord[] = [];
    let skippedLockedCount = 0;
    let revertedCount = 0;

    const matchedMotorista = (database.Motoristas || []).find(
      (m) => m.id === driverKeyOrId || `${m.name} / ${m.licensePlate}` === driverKeyOrId || m.licensePlate === driverKeyOrId
    );
    const targetDriverId = matchedMotorista?.id || driverKeyOrId;
    const targetDriverName = matchedMotorista?.name || driverKeyOrId;

    mutateDatabase((prev) => {
      const isRecordMatch = (r: { driverId?: string; motoristaId?: string; driverPlate?: string; licensePlate?: string }) => {
        if (targetDriverId && (r.driverId === targetDriverId || r.motoristaId === targetDriverId)) return true;
        const key = (r.driverPlate || r.licensePlate || 'Motorista Não Identificado').trim();
        return key === driverKeyOrId || (matchedMotorista && (key.includes(matchedMotorista.licensePlate) || key.includes(matchedMotorista.name)));
      };

      const newCargas = prev.Cargas.map((c) => {
        if (isRecordMatch(c) && c.freightPayable !== 'NO' && (c.freightPayable as any) !== false && c.freightStatus === 'PAID') {
          if (c.date && isDateLocked(c.date)) {
            skippedLockedCount++;
            return c;
          }
          revertedCount++;
          const updated = {
            ...c,
            freightStatus: 'PENDING' as const,
            freightPaidAt: undefined,
          };
          revertedCargasToSync.push(updated);
          return updated;
        }
        return c;
      });

      const newVendas = (prev.Vendas || []).map((v) => {
        if (isRecordMatch(v) && v.freightPayable !== 'NO' && (v.freightPayable as any) !== false && v.freightStatus === 'PAID') {
          if (v.date && isDateLocked(v.date)) {
            skippedLockedCount++;
            return v;
          }
          revertedCount++;
          const updated = {
            ...v,
            freightStatus: 'PENDING' as const,
            freightPaidAt: undefined,
          };
          revertedVendasToSync.push(updated);
          return updated;
        }
        return v;
      });

      return {
        ...prev,
        Cargas: newCargas,
        Vendas: newVendas,
      };
    });

    revertedCargasToSync.forEach((c) => upsertFirestoreRecord('cargas', c));
    revertedVendasToSync.forEach((v) => upsertFirestoreRecord('vendas', v));

    if (revertedCount > 0 && skippedLockedCount > 0) {
      showToast(`Quitação revertida para ${targetDriverName} (${skippedLockedCount} registro(s) em meses trancados foram preservados).`);
    } else if (revertedCount > 0) {
      showToast(`Pagamento de frete revertido para PENDENTE (${targetDriverName}).`);
    } else if (skippedLockedCount > 0) {
      showToast(`Todos os fretes pagos pertencem a meses trancados no Fechamento de Ciclo.`);
    }
  };

  // Toggle single freight status with entity type safety (PENDING <-> PAID)
  const handleToggleSingleFreight = (type: 'CARGA' | 'VENDA', recordId: string, transactionKey?: string) => {
    let updatedSingleCarga: CargaRecord | null = null;
    let updatedSingleVenda: VendaRecord | null = null;

    if (type === 'CARGA') {
      const carga = database.Cargas.find((c) => c.id === recordId);
      if (carga && carga.date && isDateLocked(carga.date)) {
        showToast('Operação bloqueada: o frete desta carga pertence a um mês trancado no Fechamento de Ciclo.');
        return;
      }

      mutateDatabase((prev) => ({
        ...prev,
        Cargas: prev.Cargas.map((c) => {
          if (c.id === recordId) {
            const newStatus = c.freightStatus === 'PAID' ? 'PENDING' : 'PAID';
            updatedSingleCarga = {
              ...c,
              freightStatus: newStatus as 'PENDING' | 'PAID',
              freightPaidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
              transactionKey: newStatus === 'PAID' ? (transactionKey || c.transactionKey) : undefined,
            };
            return updatedSingleCarga;
          }
          return c;
        }),
      }));

      if (updatedSingleCarga) upsertFirestoreRecord('cargas', updatedSingleCarga);
      showToast('Status do frete da carga atualizado.');
    } else if (type === 'VENDA') {
      const venda = (database.Vendas || []).find((v) => v.id === recordId);
      if (venda && venda.date && isDateLocked(venda.date)) {
        showToast('Operação bloqueada: o frete desta venda pertence a um mês trancado no Fechamento de Ciclo.');
        return;
      }

      mutateDatabase((prev) => ({
        ...prev,
        Vendas: (prev.Vendas || []).map((v) => {
          if (v.id === recordId) {
            const newStatus = v.freightStatus === 'PAID' ? 'PENDING' : 'PAID';
            updatedSingleVenda = {
              ...v,
              freightStatus: newStatus as 'PENDING' | 'PAID',
              freightPaidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
              transactionKey: newStatus === 'PAID' ? (transactionKey || v.transactionKey) : undefined,
            };
            return updatedSingleVenda;
          }
          return v;
        }),
      }));

      if (updatedSingleVenda) upsertFirestoreRecord('vendas', updatedSingleVenda);
      showToast('Status do frete da venda atualizado.');
    }
  };

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
        onClose={() => setConfirmDeleteTarget(null)}
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
