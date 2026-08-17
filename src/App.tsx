import React, { useState, useEffect, useMemo } from 'react';
import { TableType, KlabinDatabase, CargaRecord, DepositoKlabinRecord, ResumoRecord, CaixaRecord, ProductDefault, ClientRecord, VendaRecord, ProdutoRecord, MotoristaRecord } from './types';
import { loadDatabase, saveDatabase, resetDatabaseToDefault, exportDatabaseJSON, exportTableCSV, validateAndSanitizeBackupJSON } from './utils/storage';
import { subscribeToFirestore, syncDatabaseToFirestore, seedFirestoreIfEmpty, deleteFirestoreRecord } from './utils/firebaseSync';
import { generateId } from './utils/idGenerator';
import { normalizeIsoDate, normalizeIsoTimestamp } from './utils/formatters';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TableCargas } from './components/TableCargas';
import { TableDepositos } from './components/TableDepositos';
import { TableMotoristas } from './components/TableMotoristas';
import { TableResumo } from './components/TableResumo';
import { TableCaixa } from './components/TableCaixa';
import { DashboardOverview } from './components/DashboardOverview';
import { ConfiguracoesAjustes } from './components/ConfiguracoesAjustes';
import { GestaoClientesDashboard } from './components/GestaoClientesDashboard';
import { ClientesProdutosDashboard } from './components/ClientesProdutosDashboard';
import { KlabinDashboard } from './components/KlabinDashboard';
import { TableVendas } from './components/TableVendas';
import { TableProdutos } from './components/TableProdutos';
import { INITIAL_PRODUCT_DEFAULTS } from './data/productDefaults';
import { RecordModal } from './components/RecordModal';
import { ConfirmModal } from './components/ConfirmModal';
import { AIAutoFillModal } from './components/AIAutoFillModal';

export default function App() {
  const [database, setDatabase] = useState<KlabinDatabase>(() => loadDatabase());
  const [activeTable, setActiveTable] = useState<TableType>('Klabin');
  const [klabinSubTab, setKlabinSubTab] = useState<'CARGAS' | 'DEPOSITOS'>('CARGAS');
  const [clientesProdutosSubTab, setClientesProdutosSubTab] = useState<'CLIENTES_VENDAS' | 'PRODUTOS'>('CLIENTES_VENDAS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAIFillOpen, setIsAIFillOpen] = useState<boolean>(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Theme state: default dark mode
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('sol_nascente_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sol_nascente_theme', theme);
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Locked months state for Fechamento de Ciclo
  const [lockedMonths, setLockedMonths] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('klabin_locked_months');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('klabin_locked_months', JSON.stringify(lockedMonths));
    } catch (e) {
      console.error(e);
    }
  }, [lockedMonths]);

  const handleToggleLockMonth = (monthStr: string) => {
    setLockedMonths((prev) => {
      const isLocked = prev.includes(monthStr);
      if (isLocked) {
        showToast(`Competência ${monthStr} desbloqueada para edições.`);
        return prev.filter((m) => m !== monthStr);
      } else {
        showToast(`Competência ${monthStr} trancada no Fechamento de Ciclo.`);
        return [...prev, monthStr];
      }
    });
  };

  const isDateLocked = (dateStr?: string): boolean => {
    if (!dateStr || dateStr.length < 7) return false;
    const monthKey = dateStr.slice(0, 7);
    return lockedMonths.includes(monthKey);
  };

  const [productCatalog, setProductCatalog] = useState<ProductDefault[]>(() => {
    try {
      const saved = localStorage.getItem('klabin_product_catalog');
      return saved ? JSON.parse(saved) : INITIAL_PRODUCT_DEFAULTS;
    } catch {
      return INITIAL_PRODUCT_DEFAULTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('klabin_product_catalog', JSON.stringify(productCatalog));
    } catch (e) {
      console.error(e);
    }
  }, [productCatalog]);

  // Firebase Realtime Sync and Initial Seeding
  useEffect(() => {
    // Seed Firestore if empty
    seedFirestoreIfEmpty(database);

    // Subscribe to Firestore real-time updates
    const unsubscribe = subscribeToFirestore((remoteDb) => {
      if (
        remoteDb.Cargas.length > 0 ||
        remoteDb.Depositos_Klabin.length > 0 ||
        (remoteDb.Clientes && remoteDb.Clientes.length > 0) ||
        (remoteDb.Vendas && remoteDb.Vendas.length > 0) ||
        (remoteDb.Produtos && remoteDb.Produtos.length > 0) ||
        (remoteDb.Motoristas && remoteDb.Motoristas.length > 0)
      ) {
        setDatabase(remoteDb);
      }
    });

    return () => unsubscribe();
  }, []);

  // Save to LocalStorage and sync to Firebase whenever database state changes
  useEffect(() => {
    saveDatabase(database);
    syncDatabaseToFirestore(database);
  }, [database]);

  // Real-time inline update handlers for Data Grids
  const handleUpdateCargaRecord = (updatedCarga: CargaRecord) => {
    if (isDateLocked(updatedCarga.date)) {
      showToast('Operação bloqueada: o mês deste lançamento está trancado no Fechamento de Ciclo.');
      return;
    }
    setDatabase((prev) => ({
      ...prev,
      Cargas: prev.Cargas.map((c) => (c.id === updatedCarga.id ? updatedCarga : c)),
    }));
  };

  const handleUpdateDepositoRecord = (updatedDeposito: DepositoKlabinRecord) => {
    if (isDateLocked(updatedDeposito.date)) {
      showToast('Operação bloqueada: o mês deste depósito está trancado no Fechamento de Ciclo.');
      return;
    }
    setDatabase((prev) => ({
      ...prev,
      Depositos_Klabin: prev.Depositos_Klabin.map((d) => (d.id === updatedDeposito.id ? updatedDeposito : d)),
    }));
  };

  // CLIENT & VENDA HANDLERS (ISOLATED - DOES NOT TOUCH KLABIN BALANCE OR FREIGHT)
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
    setDatabase((prev) => ({
      ...prev,
      Clientes: [...(prev.Clientes || []), newClient],
    }));
    showToast(`Cliente ${newClient.name} cadastrado com sucesso.`);
  };

  const handleUpdateClient = (updatedClient: ClientRecord) => {
    setDatabase((prev) => ({
      ...prev,
      Clientes: (prev.Clientes || []).map((c) => (c.id === updatedClient.id ? updatedClient : c)),
    }));
    showToast(`Cliente ${updatedClient.name} atualizado.`);
  };

  const handleDeleteClient = (clientId: string) => {
    deleteFirestoreRecord('clientes', clientId);
    setDatabase((prev) => ({
      ...prev,
      Clientes: (prev.Clientes || []).filter((c) => c.id !== clientId),
    }));
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
    setDatabase((prev) => ({
      ...prev,
      Vendas: [...(prev.Vendas || []), newVenda],
    }));
    showToast(`Venda lançada para ${newVenda.clientName}.`);
  };

  const handleUpdateVenda = (updatedVenda: VendaRecord) => {
    if (isDateLocked(updatedVenda.date)) {
      showToast('Operação bloqueada: esta venda pertence a um mês trancado no Fechamento de Ciclo.');
      return;
    }
    setDatabase((prev) => ({
      ...prev,
      Vendas: (prev.Vendas || []).map((v) => (v.id === updatedVenda.id ? updatedVenda : v)),
    }));
    showToast('Venda atualizada.');
  };

  const handleDeleteVenda = (vendaId: string) => {
    const existingVenda = (database.Vendas || []).find((v) => v.id === vendaId);
    if (existingVenda && isDateLocked(existingVenda.date)) {
      showToast('Operação bloqueada: não é possível excluir venda em mês trancado no Fechamento de Ciclo.');
      return;
    }
    deleteFirestoreRecord('vendas', vendaId);
    setDatabase((prev) => ({
      ...prev,
      Vendas: (prev.Vendas || []).filter((v) => v.id !== vendaId),
    }));
    showToast('Lançamento de venda removido.');
  };

  const handleToggleVendaStatus = (vendaId: string) => {
    const existingVenda = (database.Vendas || []).find((v) => v.id === vendaId);
    if (existingVenda && isDateLocked(existingVenda.date)) {
      showToast('Operação bloqueada: não é possível alterar status de venda em mês trancado.');
      return;
    }
    setDatabase((prev) => {
      const updatedVendas = (prev.Vendas || []).map((v) => {
        if (v.id === vendaId) {
          const newStatus = v.status === 'PAID' ? 'PENDING' : 'PAID';
          return {
            ...v,
            status: newStatus as 'PENDING' | 'PAID',
            paidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
          };
        }
        return v;
      });
      return {
        ...prev,
        Vendas: updatedVendas,
      };
    });
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
    setDatabase((prev) => ({
      ...prev,
      Produtos: [...(prev.Produtos || []), newProd],
    }));
    showToast(`Produto ${newProd.name} cadastrado com sucesso.`);
  };

  const handleUpdateProduto = (updatedProd: ProdutoRecord) => {
    setDatabase((prev) => ({
      ...prev,
      Produtos: (prev.Produtos || []).map((p) => (p.id === updatedProd.id ? updatedProd : p)),
    }));
    showToast(`Produto ${updatedProd.name} atualizado.`);
  };

  const handleDeleteProduto = (prodId: string) => {
    deleteFirestoreRecord('produtos', prodId);
    setDatabase((prev) => ({
      ...prev,
      Produtos: (prev.Produtos || []).filter((p) => p.id !== prodId),
    }));
    showToast('Produto removido do catálogo.');
  };

  // Show transient notification toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // DYNAMIC COMPUTED METRICS (100% Single Source of Truth derived from Cargas & Depositos_Klabin)
  const computedMetrics = useMemo(() => {
    // 1. Total Volume (Toneladas)
    const totalVolumeTons = database.Cargas.reduce(
      (acc, c) => acc + (Number(c.quantityTons) || 0),
      0
    );

    // 2. Total Compras (R$)
    const totalComprasVal = database.Cargas.reduce(
      (acc, c) => acc + (Number(c.totalValue) || 0),
      0
    );

    // 3. Total Abatido (R$) where deductFromBalance === 'YES'
    const totalAbatido = database.Cargas
      .filter((c) => c.deductFromBalance === 'YES' || (c.deductFromBalance as any) === true)
      .reduce((acc, c) => acc + (Number(c.totalValue) || 0), 0);

    // 4. Total Depósitos (R$)
    const totalDepositos = database.Depositos_Klabin.reduce(
      (acc, d) => acc + (Number(d.value) || 0),
      0
    );

    // 5. Saldo Líquido Klabin (R$): (Total Depósitos) - (Total Abatido)
    const saldoLiquidoKlabin = totalDepositos - totalAbatido;

    // Freight calculations
    const freightRatePerTon = database.appSettings?.freightRatePerTon || 15;

    const cargasComFrete = database.Cargas.filter(
      (c) => c.freightPayable !== 'NO' && (c.freightPayable as any) !== false
    );

    const vendasComFrete = (database.Vendas || []).filter(
      (v) => v.freightPayable !== 'NO' && (v.freightPayable as any) !== false && (v.driverId || v.driverPlate)
    );

    const totalFreteCargasVal = cargasComFrete.reduce((acc, c) => {
      const cost = c.freightCost !== undefined && c.freightCost !== null
        ? Number(c.freightCost)
        : (Number(c.quantityTons) || 0) * freightRatePerTon;
      return acc + (isNaN(cost) ? 0 : cost);
    }, 0);

    const totalFreteVendasVal = vendasComFrete.reduce((acc, v) => {
      const cost = v.freightCost !== undefined && v.freightCost !== null
        ? Number(v.freightCost)
        : (Number(v.quantity) || 0) * freightRatePerTon;
      return acc + (isNaN(cost) ? 0 : cost);
    }, 0);

    const totalFreteVal = totalFreteCargasVal + totalFreteVendasVal;

    const totalFreteTons = cargasComFrete.reduce(
      (acc, c) => acc + (Number(c.quantityTons) || 0),
      0
    ) + vendasComFrete.reduce(
      (acc, v) => acc + (Number(v.quantity) || 0),
      0
    );

    const avgFretePerTon = totalFreteTons > 0 ? totalFreteVal / totalFreteTons : freightRatePerTon;

    // Dynamic ResumoRecords array for TableResumo view
    const resumoRecords: ResumoRecord[] = [
      { id: 'res-dyn-1', metricName: 'Total Volume Cargas (Toneladas)', metricValue: Number(totalVolumeTons.toFixed(2)) },
      { id: 'res-dyn-2', metricName: 'Valor Total Compras de Cargas (R$)', metricValue: Number(totalComprasVal.toFixed(2)) },
      { id: 'res-dyn-3', metricName: 'Total Abatido do Saldo Klabin (R$)', metricValue: Number(totalAbatido.toFixed(2)) },
      { id: 'res-dyn-4', metricName: 'Total Depósitos Recebidos Klabin (R$)', metricValue: Number(totalDepositos.toFixed(2)) },
      { id: 'res-dyn-5', metricName: 'Saldo Líquido Disponível Klabin (R$)', metricValue: Number(saldoLiquidoKlabin.toFixed(2)) },
      { id: 'res-dyn-6', metricName: 'Custo Total de Fretes (R$)', metricValue: Number(totalFreteVal.toFixed(2)) },
      { id: 'res-dyn-7', metricName: 'Custo Médio de Frete / Tonelada (R$)', metricValue: Number(avgFretePerTon.toFixed(2)) },
    ];

    // Dynamic CaixaRecords array for TableCaixa view
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
  }, [database.Cargas, database.Depositos_Klabin]);

  const klabinBalance = computedMetrics.saldoLiquidoKlabin;

  // Navigation Handler
  const handleSelectTable = (table: TableType) => {
    if (table === 'Cargas') {
      setActiveTable('Klabin');
      setKlabinSubTab('CARGAS');
    } else if (table === 'Depositos_Klabin') {
      setActiveTable('Klabin');
      setKlabinSubTab('DEPOSITOS');
    } else if (table === 'Gestao_Clientes' || table === 'Vendas') {
      setActiveTable('Clientes_Produtos');
      setClientesProdutosSubTab('CLIENTES_VENDAS');
    } else if (table === 'Produtos') {
      setActiveTable('Clientes_Produtos');
      setClientesProdutosSubTab('PRODUTOS');
    } else {
      setActiveTable(table);
    }
    setSearchTerm('');
  };

  // Add & Edit Handlers
  const handleAddRecord = () => {
    setRecordToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditRecord = (record: any) => {
    setRecordToEdit(record);
    setIsModalOpen(true);
  };

  const handleSaveRecord = (savedRecord: any) => {
    if (activeTable === 'Dashboard') return;

    if (savedRecord && savedRecord.date && isDateLocked(savedRecord.date)) {
      showToast('Operação bloqueada: não é possível salvar lançamentos em mês trancado no Fechamento de Ciclo.');
      return;
    }

    const targetTableKey =
      activeTable === 'Klabin'
        ? (klabinSubTab === 'CARGAS' ? 'Cargas' : 'Depositos_Klabin')
        : activeTable === 'Clientes_Produtos'
        ? (clientesProdutosSubTab === 'CLIENTES_VENDAS' ? 'Clientes' : 'Produtos')
        : activeTable === 'Motoristas'
        ? 'Cargas'
        : activeTable;

    setDatabase((prev) => {
      const currentList = [...((prev as any)[targetTableKey] || [])];
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

    showToast(`Registro salvo com sucesso em ${targetTableKey}.`);
  };

  // Delete Handlers
  const handleDeleteRequest = (id: string) => {
    const targetTableKey =
      activeTable === 'Klabin'
        ? (klabinSubTab === 'CARGAS' ? 'Cargas' : 'Depositos_Klabin')
        : activeTable === 'Clientes_Produtos'
        ? (clientesProdutosSubTab === 'CLIENTES_VENDAS' ? 'Clientes' : 'Produtos')
        : activeTable === 'Motoristas'
        ? 'Cargas'
        : activeTable;
    const list = (database as any)[targetTableKey] || [];
    const item = list?.find((i: any) => i.id === id);
    if (item && item.date && isDateLocked(item.date)) {
      showToast('Operação bloqueada: o registro pertence a um mês trancado no Fechamento de Ciclo.');
      return;
    }
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteId || activeTable === 'Dashboard') return;

    const targetTableKey =
      activeTable === 'Klabin'
        ? (klabinSubTab === 'CARGAS' ? 'Cargas' : 'Depositos_Klabin')
        : activeTable === 'Clientes_Produtos'
        ? (clientesProdutosSubTab === 'CLIENTES_VENDAS' ? 'Clientes' : 'Produtos')
        : activeTable === 'Motoristas'
        ? 'Cargas'
        : activeTable;

    const firestoreCollectionMap: Record<string, string> = {
      Cargas: 'cargas',
      Depositos_Klabin: 'depositos',
      Clientes: 'clientes',
      Vendas: 'vendas',
      Produtos: 'produtos',
      Motoristas: 'motoristas',
    };

    const fsColl = firestoreCollectionMap[targetTableKey];
    if (fsColl) {
      deleteFirestoreRecord(fsColl, confirmDeleteId);
    }

    setDatabase((prev) => ({
      ...prev,
      [targetTableKey]: ((prev as any)[targetTableKey] || []).filter((item: any) => item.id !== confirmDeleteId),
    }));

    showToast(`Registro excluído de ${targetTableKey}.`);
    setConfirmDeleteId(null);
  };

  // MOTORISTAS HANDLERS
  const handleAddMotorista = (motorista: MotoristaRecord) => {
    setDatabase((prev) => ({
      ...prev,
      Motoristas: [...(prev.Motoristas || []), motorista],
    }));
    showToast(`Motorista ${motorista.name} cadastrado com sucesso.`);
  };

  const handleUpdateMotorista = (motorista: MotoristaRecord) => {
    setDatabase((prev) => ({
      ...prev,
      Motoristas: (prev.Motoristas || []).map((m) => (m.id === motorista.id ? motorista : m)),
    }));
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
      setDatabase((prev) => ({
        ...prev,
        Motoristas: (prev.Motoristas || []).map((m) =>
          m.id === id ? { ...m, status: 'INACTIVE' as const } : m
        ),
      }));
      showToast(`Motorista "${driver.name}" possui lançamentos vinculados e foi inativado (Soft Delete).`);
    } else {
      // Hard Delete: remove permanently from database
      setDatabase((prev) => ({
        ...prev,
        Motoristas: (prev.Motoristas || []).filter((m) => m.id !== id),
      }));
      showToast(`Motorista "${driver.name}" foi excluído permanentemente.`);
    }
  };

  // Pay all pending freights for a given motorista/plate
  const handlePayFreightForDriver = (driverKey: string, transactionKey?: string) => {
    setDatabase((prev) => {
      const matchedMotorista = (prev.Motoristas || []).find(
        (m) => `${m.name} / ${m.licensePlate}` === driverKey || m.id === driverKey || m.licensePlate === driverKey
      );
      const targetDriverId = matchedMotorista?.id;

      const isRecordMatch = (r: { driverId?: string; motoristaId?: string; driverPlate?: string; licensePlate?: string }) => {
        if (targetDriverId && (r.driverId === targetDriverId || r.motoristaId === targetDriverId)) return true;
        const key = (r.driverPlate || r.licensePlate || 'Motorista Não Identificado').trim();
        return key === driverKey;
      };

      return {
        ...prev,
        Cargas: prev.Cargas.map((c) => {
          if (isRecordMatch(c) && c.freightPayable !== 'NO' && c.freightPayable !== false && c.freightStatus !== 'PAID') {
            return {
              ...c,
              freightStatus: 'PAID' as const,
              freightPaidAt: new Date().toLocaleDateString('pt-BR'),
              transactionKey: transactionKey || c.transactionKey,
            };
          }
          return c;
        }),
        Vendas: (prev.Vendas || []).map((v) => {
          if (isRecordMatch(v) && v.freightPayable !== 'NO' && v.freightPayable !== false && v.freightStatus !== 'PAID') {
            return {
              ...v,
              freightStatus: 'PAID' as const,
              freightPaidAt: new Date().toLocaleDateString('pt-BR'),
              transactionKey: transactionKey || v.transactionKey,
            };
          }
          return v;
        }),
      };
    });

    showToast(`Frete quitado com sucesso para ${driverKey}!`);
  };

  // Revert all paid freights for a given motorista/plate back to PENDING
  const handleRevertFreightForDriver = (driverKey: string) => {
    setDatabase((prev) => {
      const matchedMotorista = (prev.Motoristas || []).find(
        (m) => `${m.name} / ${m.licensePlate}` === driverKey || m.id === driverKey || m.licensePlate === driverKey
      );
      const targetDriverId = matchedMotorista?.id;

      const isRecordMatch = (r: { driverId?: string; motoristaId?: string; driverPlate?: string; licensePlate?: string }) => {
        if (targetDriverId && (r.driverId === targetDriverId || r.motoristaId === targetDriverId)) return true;
        const key = (r.driverPlate || r.licensePlate || 'Motorista Não Identificado').trim();
        return key === driverKey;
      };

      return {
        ...prev,
        Cargas: prev.Cargas.map((c) => {
          if (isRecordMatch(c) && c.freightPayable !== 'NO' && c.freightPayable !== false && c.freightStatus === 'PAID') {
            return {
              ...c,
              freightStatus: 'PENDING' as const,
              freightPaidAt: undefined,
            };
          }
          return c;
        }),
        Vendas: (prev.Vendas || []).map((v) => {
          if (isRecordMatch(v) && v.freightPayable !== 'NO' && v.freightPayable !== false && v.freightStatus === 'PAID') {
            return {
              ...v,
              freightStatus: 'PENDING' as const,
              freightPaidAt: undefined,
            };
          }
          return v;
        }),
      };
    });

    showToast(`Pagamento de frete revertido para PENDENTE (${driverKey}).`);
  };

  // Toggle single freight status (PENDING <-> PAID)
  const handleToggleSingleFreight = (recordId: string, transactionKey?: string) => {
    setDatabase((prev) => ({
      ...prev,
      Cargas: prev.Cargas.map((c) => {
        if (c.id === recordId) {
          const newStatus = c.freightStatus === 'PAID' ? 'PENDING' : 'PAID';
          return {
            ...c,
            freightStatus: newStatus as 'PENDING' | 'PAID',
            freightPaidAt: newStatus === 'PAID' ? new Date().toLocaleDateString('pt-BR') : undefined,
            transactionKey: newStatus === 'PAID' ? (transactionKey || c.transactionKey) : undefined,
          };
        }
        return c;
      }),
      Vendas: (prev.Vendas || []).map((v) => {
        if (v.id === recordId) {
          const newStatus = v.freightStatus === 'PAID' ? 'PENDING' : 'PAID';
          return {
            ...v,
            freightStatus: newStatus as 'PENDING' | 'PAID',
            freightPaidAt: newStatus === 'PAID' ? new Date().toLocaleDateString('pt-BR') : undefined,
            transactionKey: newStatus === 'PAID' ? (transactionKey || v.transactionKey) : undefined,
          };
        }
        return v;
      }),
    }));

    showToast('Status do frete atualizado.');
  };

  // Reset to Demo Data
  const handleResetData = () => {
    if (window.confirm('Deseja restaurar os dados originais de exemplo do sistema Klabin?')) {
      const reset = resetDatabaseToDefault();
      setDatabase(reset);
      showToast('Dados restaurados para o padrão de demonstração.');
    }
  };

  // Export Backup JSON
  const handleExportBackup = () => {
    exportDatabaseJSON(database);
    showToast('Download do backup JSON iniciado.');
  };

  // Import Backup JSON
  const handleImportBackup = (importedData: any) => {
    const result = validateAndSanitizeBackupJSON(importedData);
    if (!result.isValid || !result.sanitizedDb) {
      showToast(`Erro na validação do backup: ${result.errorMessage || 'Formato de arquivo inválido.'}`);
      return;
    }

    saveDatabase(result.sanitizedDb);
    setDatabase(result.sanitizedDb);

    if (result.warnings && result.warnings.length > 0) {
      showToast(`Backup JSON importado e higienizado! (${result.warnings.length} aviso(s))`);
    } else {
      showToast('Backup JSON importado e validado com sucesso!');
    }
  };

  // Export CSV for active table
  const handleExportCSV = () => {
    if (activeTable === 'Dashboard') return;

    switch (activeTable) {
      case 'Motoristas':
      case 'Cargas':
        exportTableCSV('Cargas', database.Cargas, [
          { key: 'date', label: 'Data Compra' },
          { key: 'invoiceNumber', label: 'Nº Nota Fiscal' },
          { key: 'supplier', label: 'Fornecedor' },
          { key: 'supplierCnpj', label: 'CNPJ Fornecedor' },
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
      case 'Frete':
        exportTableCSV('Frete', database.Frete, [
          { key: 'referenceDateLine', label: 'Data / Linha Referência' },
          { key: 'quantityTons', label: 'Quantidade (Ton)' },
          { key: 'value', label: 'Valor Frete (R$)' },
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
    }
    showToast(`Arquivo CSV da tabela ${activeTable} gerado com sucesso.`);
  };

  const handleUpdateCustomLogo = (logoBase64: string | undefined) => {
    setDatabase((prev) => ({
      ...prev,
      customLogo: logoBase64,
    }));
    if (logoBase64) {
      showToast('Logo personalizado da Madereira Sol Nascente salvo.');
    } else {
      showToast('Logo restaurado.');
    }
  };

  // AI Auto-Fill Confirmation Handler
  const handleConfirmAIFill = (tableKey: string, data: Record<string, any>) => {
    const currentDate = new Date().toISOString().split('T')[0];

    if (tableKey === 'Cargas') {
      const newCarga: CargaRecord = {
        id: `crg-${Date.now().toString().slice(-4)}`,
        date: data.date || currentDate,
        invoiceNumber: data.invoiceNumber || 'SN-IA',
        supplier: data.supplier || 'Klabin',
        product: data.product || 'Eucalipto',
        quantityTons: typeof data.quantityTons === 'number' ? data.quantityTons : 0,
        valuePerTon: typeof data.valuePerTon === 'number' ? data.valuePerTon : 0,
        totalValue: typeof data.totalValue === 'number' ? data.totalValue : ((Number(data.quantityTons) || 0) * (Number(data.valuePerTon) || 0)),
        licensePlate: data.licensePlate || '',
        driverPlate: data.driverPlate || '',
        freightCost: typeof data.freightCost === 'number' ? data.freightCost : 0,
        freightPayable: true,
        deductFromBalance: true,
        notes: data.notes ? `[Preenchido via IA] ${data.notes}` : '[Preenchido via IA]',
        createdAt: new Date().toISOString(),
      };
      setDatabase((prev) => ({
        ...prev,
        Cargas: [newCarga, ...prev.Cargas],
      }));
      showToast(`Nova Carga preenchida e salva via IA (${newCarga.invoiceNumber})!`);
    } else if (tableKey === 'Depositos_Klabin') {
      const newDeposito: DepositoKlabinRecord = {
        id: `dep-${Date.now().toString().slice(-4)}`,
        date: data.date || currentDate,
        value: typeof data.value === 'number' ? data.value : 0,
        notes: data.notes ? `[Preenchido via IA] ${data.notes}` : '[Preenchido via IA]',
        createdAt: new Date().toISOString(),
      };
      setDatabase((prev) => ({
        ...prev,
        Depositos_Klabin: [newDeposito, ...prev.Depositos_Klabin],
      }));
      showToast(`Novo Depósito Klabin salvo via IA (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(newDeposito.value)})!`);
    } else if (tableKey === 'Clientes') {
      const newCliente: ClientRecord = {
        id: `cli-${Date.now().toString().slice(-4)}`,
        name: data.name || 'Novo Cliente IA',
        contact: data.contact || '',
        notes: data.notes ? `[Preenchido via IA] ${data.notes}` : '[Preenchido via IA]',
      };
      setDatabase((prev) => ({
        ...prev,
        Clientes: [newCliente, ...(prev.Clientes || [])],
      }));
      showToast(`Cliente "${newCliente.name}" cadastrado via IA!`);
    } else if (tableKey === 'Vendas') {
      const newVenda: VendaRecord = {
        id: `vnd-${Date.now().toString().slice(-4)}`,
        date: data.date || currentDate,
        clientName: data.clientName || 'Cliente Indefinido',
        product: data.product || 'Eucalipto',
        quantity: typeof data.quantity === 'number' ? data.quantity : 0,
        unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : 0,
        totalValue: typeof data.totalValue === 'number' ? data.totalValue : ((Number(data.quantity) || 0) * (Number(data.unitPrice) || 0)),
        status: (data.status === 'PAID' || data.status === 'Pago') ? 'PAID' : 'PENDING',
        notes: data.notes ? `[Preenchido via IA] ${data.notes}` : '[Preenchido via IA]',
      };
      setDatabase((prev) => ({
        ...prev,
        Vendas: [newVenda, ...(prev.Vendas || [])],
      }));
      showToast(`Venda salva via IA para ${newVenda.clientName}!`);
    } else if (tableKey === 'Produtos') {
      const newProduto: ProdutoRecord = {
        id: `prd-${Date.now().toString().slice(-4)}`,
        name: data.name || 'Novo Produto IA',
        referencePrice: typeof data.referencePrice === 'number' ? data.referencePrice : 0,
        unitOfMeasure: data.unitOfMeasure || 'ton',
        status: 'ACTIVE',
        description: data.description ? `[IA] ${data.description}` : '[Criado via IA]',
      };
      setDatabase((prev) => ({
        ...prev,
        Produtos: [newProduto, ...(prev.Produtos || [])],
      }));
      showToast(`Produto "${newProduto.name}" cadastrado via IA!`);
    } else if (tableKey === 'Motoristas') {
      const newMotorista: MotoristaRecord = {
        id: `mot-${Date.now().toString().slice(-4)}`,
        name: data.name || 'Motorista IA',
        licensePlate: data.licensePlate || 'AAA-0000',
        trailerPlate: data.trailerPlate || '',
        phone: data.phone || '',
        status: 'ACTIVE',
      };
      setDatabase((prev) => ({
        ...prev,
        Motoristas: [newMotorista, ...(prev.Motoristas || [])],
      }));
      showToast(`Motorista "${newMotorista.name}" cadastrado via IA!`);
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'light' : ''} flex antialiased select-none overflow-hidden transition-colors duration-200`}>
      {/* Graphite Pro Main Window Shell */}
      <div className="flex-1 flex mac-window my-0 md:my-2 md:mx-3 rounded-none md:rounded-[18px] overflow-hidden min-w-0 border border-white/[0.08] shadow-2xl relative">
        {/* Left Sidebar Navigation */}
        <Sidebar
          activeTable={activeTable}
          onSelectTable={handleSelectTable}
          counts={{
            Cargas: database.Cargas.length,
            Depositos_Klabin: database.Depositos_Klabin.length,
            Motoristas: new Set(database.Cargas.map((c) => (c.driverPlate || c.licensePlate || 'Motorista').trim())).size,
            Resumo: computedMetrics.resumoRecords.length,
            Caixa: computedMetrics.caixaRecords.length,
            Clientes: database.Clientes?.length || 0,
            Vendas: database.Vendas?.length || 0,
            Produtos: database.Produtos?.length || 0,
          }}
          customLogo={database.customLogo}
          onUpdateCustomLogo={handleUpdateCustomLogo}
          onResetData={handleResetData}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-transparent">
          <Header
            activeTable={activeTable}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onAddRecord={handleAddRecord}
            onExportCSV={handleExportCSV}
            onOpenAIFill={() => setIsAIFillOpen(true)}
            klabinBalance={klabinBalance}
            customLogo={database.customLogo}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />

          {/* View Screens */}
          <main className="p-6 max-w-7xl w-full mx-auto flex-1">
            {(activeTable === 'Dashboard' || activeTable === 'Resumo') && (
              <DashboardOverview
                database={database}
                resumoRecords={computedMetrics.resumoRecords}
                onNavigate={handleSelectTable}
                lockedMonths={lockedMonths}
                onToggleLockMonth={handleToggleLockMonth}
              />
            )}

            {(activeTable === 'Klabin' || activeTable === 'Cargas' || activeTable === 'Depositos_Klabin') && (
              <KlabinDashboard
                cargas={database.Cargas}
                depositos={database.Depositos_Klabin}
                searchTerm={searchTerm}
                produtos={database.Produtos || []}
                lockedMonths={lockedMonths}
                motoristas={database.Motoristas || []}
                freightRatePerTon={database.appSettings?.freightRatePerTon || 15}
                activeSubTab={klabinSubTab}
                onSubTabChange={setKlabinSubTab}
                onEditCarga={handleEditRecord}
                onDeleteCarga={handleDeleteRequest}
                onAddCarga={handleAddRecord}
                onUpdateCargaRecord={handleUpdateCargaRecord}
                onEditDeposito={handleEditRecord}
                onDeleteDeposito={handleDeleteRequest}
                onAddDeposito={handleAddRecord}
                onUpdateDepositoRecord={handleUpdateDepositoRecord}
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
                onDelete={handleDeleteRequest}
                onAdd={handleAddRecord}
                onPayFreight={handlePayFreightForDriver}
                onRevertFreight={handleRevertFreightForDriver}
                onToggleSingleFreight={handleToggleSingleFreight}
                onAddMotorista={handleAddMotorista}
                onUpdateMotorista={handleUpdateMotorista}
                onDeleteMotorista={handleDeleteDriver}
              />
            )}

            {activeTable === 'Configuracoes' && (
              <ConfiguracoesAjustes
                productCatalog={productCatalog}
                onUpdateProductCatalog={setProductCatalog}
                cargasRecords={database.Cargas}
                onUpdateCargaRecord={handleUpdateCargaRecord}
                onDeleteCargaRecord={handleDeleteRequest}
                onAddCargaRecord={handleAddRecord}
                freightRatePerTon={database.appSettings?.freightRatePerTon || 15}
                onUpdateFreightRatePerTon={(rate) =>
                  setDatabase((prev) => ({
                    ...prev,
                    appSettings: { ...prev.appSettings, freightRatePerTon: rate },
                  }))
                }
                onRestoreBackup={handleImportBackup}
              />
            )}

            {(activeTable === 'Clientes_Produtos' || activeTable === 'Gestao_Clientes' || activeTable === 'Produtos' || activeTable === 'Vendas') && (
              <ClientesProdutosDashboard
                clientes={database.Clientes || []}
                vendas={database.Vendas || []}
                produtos={database.Produtos || []}
                motoristas={database.Motoristas || []}
                freightRatePerTon={database.appSettings?.freightRatePerTon || 15}
                searchTerm={searchTerm}
                activeSubTab={clientesProdutosSubTab}
                onSubTabChange={setClientesProdutosSubTab}
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
              />
            )}
          </main>
        </div>
      </div>

      {/* Record Creation / Edit Modal */}
      <RecordModal
        isOpen={isModalOpen}
        tableType={
          activeTable === 'Klabin'
            ? (klabinSubTab === 'CARGAS' ? 'Cargas' : 'Depositos_Klabin')
            : activeTable === 'Clientes_Produtos'
            ? (clientesProdutosSubTab === 'CLIENTES_VENDAS' ? 'Clientes' : 'Produtos')
            : activeTable
        }
        recordToEdit={recordToEdit}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRecord}
        produtos={database.Produtos || []}
        clientes={database.Clientes || []}
        motoristas={database.Motoristas || []}
        freightRatePerTon={database.appSettings?.freightRatePerTon || 15}
      />

      {/* AI Auto-Fill Modal */}
      <AIAutoFillModal
        isOpen={isAIFillOpen}
        onClose={() => setIsAIFillOpen(false)}
        defaultTableKey={
          activeTable === 'Depositos_Klabin'
            ? 'Depositos_Klabin'
            : activeTable === 'Clientes_Produtos'
            ? (clientesProdutosSubTab === 'PRODUTOS' ? 'Produtos' : 'Clientes')
            : activeTable === 'Gestao_Clientes'
            ? 'Clientes'
            : activeTable === 'Produtos'
            ? 'Produtos'
            : activeTable === 'Motoristas'
            ? 'Motoristas'
            : activeTable === 'Vendas'
            ? 'Vendas'
            : 'Cargas'
        }
        onConfirmFill={handleConfirmAIFill}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Excluir Registro"
        message="Tem certeza de que deseja remover este registro da base de dados Klabin? Esta ação não poderá ser desfeita."
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Graphite Pro Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 mac-hud bg-[#1A1E27]/95 backdrop-blur-xl text-slate-100 text-xs font-medium px-4 py-3 rounded-xl shadow-2xl border border-white/[0.10] flex items-center space-x-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-2 h-2 rounded-full bg-blue-400 shadow-xs shadow-blue-400/50 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
