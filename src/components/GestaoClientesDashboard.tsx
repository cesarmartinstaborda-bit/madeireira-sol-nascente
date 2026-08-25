import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ClientRecord, VendaRecord, ProdutoRecord, MotoristaRecord, AppSettings } from '../types';
import { formatCurrency, formatNumber, formatDateBR, isMonthLocked } from '../utils/formatters';
import {
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  ShoppingBag,
  Phone,
  Lock,
  DollarSign,
  Truck,
  CheckCircle2,
  RotateCcw,
  Search,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Users,
  ChevronsUpDown,
  FileText,
} from 'lucide-react';
import { generateId } from '../utils/idGenerator';
import { generateClientPendingPdf } from '../utils/pdfGenerator';

interface GestaoClientesDashboardProps {
  clientes: ClientRecord[];
  vendas: VendaRecord[];
  produtos: ProdutoRecord[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
  defaultSaleFreightPayable?: boolean;
  onAddClient: (clientData: Partial<ClientRecord>) => void;
  onUpdateClient: (client: ClientRecord) => void;
  onDeleteClient: (clientId: string) => void;
  onAddVenda: (vendaData: Partial<VendaRecord>) => void;
  onUpdateVenda: (venda: VendaRecord) => void;
  onDeleteVenda: (vendaId: string) => void;
  onToggleVendaStatus: (vendaId: string) => void;
  lockedMonths?: string[];
  appSettings?: AppSettings;
  customLogo?: string;
}

export const GestaoClientesDashboard: React.FC<GestaoClientesDashboardProps> = ({
  clientes,
  vendas,
  produtos,
  motoristas = [],
  freightRatePerTon = 15,
  defaultSaleFreightPayable = false,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onAddVenda,
  onUpdateVenda,
  onDeleteVenda,
  onToggleVendaStatus,
  lockedMonths = [],
  appSettings,
  customLogo,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'CLIENTS' | 'SALES'>('SALES');
  const [vendaStatusFilter, setVendaStatusFilter] = useState<'PENDING' | 'PAID'>('PENDING');
  const [pdfNotification, setPdfNotification] = useState<string | null>(null);
  const [vendaSearchTerm, setVendaSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Confirmation modal state for reverting paid sale back to pending
  const [vendaToRevert, setVendaToRevert] = useState<VendaRecord | null>(null);

  // Modal states for Client
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  // Modal states for Venda
  const [showVendaModal, setShowVendaModal] = useState(false);
  const [editingVenda, setEditingVenda] = useState<VendaRecord | null>(null);
  const [vendaDate, setVendaDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [vendaClientId, setVendaClientId] = useState('');
  const [vendaProductId, setVendaProductId] = useState('');
  const [vendaProduct, setVendaProduct] = useState('');
  const [vendaQuantity, setVendaQuantity] = useState('1');
  const [vendaUnitPrice, setVendaUnitPrice] = useState('');
  const [vendaNotes, setVendaNotes] = useState('');

  // Frete fields for Venda
  const [vendaFreightPayable, setVendaFreightPayable] = useState<'YES' | 'NO'>('NO');
  const [vendaDriverId, setVendaDriverId] = useState('');
  const [vendaDriverPlate, setVendaDriverPlate] = useState('');
  const [vendaFreightCost, setVendaFreightCost] = useState('');

  const isLocked = (dateStr?: string) => {
    return isMonthLocked(dateStr, lockedMonths);
  };

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const openClientModal = (client?: ClientRecord) => {
    if (client) {
      setEditingClient(client);
      setClientName(client.name);
      setClientContact(client.contact);
      setClientNotes(client.notes);
    } else {
      setEditingClient(null);
      setClientName('');
      setClientContact('');
      setClientNotes('');
    }
    setShowClientModal(true);
  };

  const handleSaveClientModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    if (editingClient) {
      onUpdateClient({
        ...editingClient,
        name: clientName.trim(),
        contact: clientContact.trim(),
        notes: clientNotes.trim(),
      });
    } else {
      onAddClient({
        name: clientName.trim(),
        contact: clientContact.trim(),
        notes: clientNotes.trim(),
      });
    }
    setShowClientModal(false);
  };

  const openVendaModal = (venda?: VendaRecord) => {
    if (venda) {
      setEditingVenda(venda);
      setVendaDate(venda.date);
      setVendaClientId(venda.clientId);
      const editProdName = venda.product || '';
      setVendaProduct(editProdName);

      const matchedProd =
        produtos.find((p) => p.id === venda.productId) ||
        produtos.find((p) => p.name.trim().toLowerCase() === editProdName.trim().toLowerCase());

      setVendaProductId(matchedProd?.id || venda.productId || '');
      const q = String(venda.quantity);
      setVendaQuantity(q);
      // Preservar preço histórico da venda
      setVendaUnitPrice(String(venda.unitPrice));
      setVendaNotes(venda.notes);

      // Frete resolution
      const hasFreight = venda.freightPayable === 'YES' || (venda.freightPayable as any) === true;
      setVendaFreightPayable(hasFreight ? 'YES' : 'NO');

      const dId = venda.driverId || venda.motoristaId || '';
      const matchedDriver =
        motoristas.find((m) => m.id === dId) ||
        motoristas.find((m) => venda.licensePlate && m.licensePlate === venda.licensePlate) ||
        motoristas.find((m) => venda.driverPlate && venda.driverPlate.includes(m.licensePlate));

      setVendaDriverId(matchedDriver?.id || dId || '');
      setVendaDriverPlate(venda.driverPlate || (matchedDriver ? `${matchedDriver.name} / ${matchedDriver.licensePlate}` : ''));

      if (venda.freightCost !== undefined && venda.freightCost !== null) {
        setVendaFreightCost(String(venda.freightCost));
      } else {
        const qtyNum = parseFloat(q) || 0;
        setVendaFreightCost(String(qtyNum * freightRatePerTon));
      }
    } else {
      setEditingVenda(null);
      setVendaDate(new Date().toISOString().split('T')[0]);
      setVendaClientId(clientes[0]?.id || '');

      const activeProdutos = produtos.filter((p) => p.status === 'ACTIVE' || !p.status);
      if (activeProdutos.length > 0) {
        const first = activeProdutos[0];
        setVendaProductId(first.id);
        setVendaProduct(first.name);
        setVendaUnitPrice(String(first.referencePrice));
      } else {
        setVendaProductId('');
        setVendaProduct('');
        setVendaUnitPrice('');
      }

      setVendaQuantity('1');
      setVendaNotes('');
      const shouldPayFreight = Boolean(defaultSaleFreightPayable);
      setVendaFreightPayable(shouldPayFreight ? 'YES' : 'NO');
      setVendaDriverId('');
      setVendaDriverPlate('');
      setVendaFreightCost(shouldPayFreight ? String(1 * freightRatePerTon) : '0');
    }
    setShowVendaModal(true);
  };

  const handleVendaProductSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProdId = e.target.value;
    setVendaProductId(newProdId);
    const selectedProd = produtos.find((p) => p.id === newProdId);
    if (selectedProd) {
      setVendaProduct(selectedProd.name);
      setVendaUnitPrice(String(selectedProd.referencePrice));
    } else {
      setVendaProduct('');
      setVendaUnitPrice('');
    }
  };

  const handleVendaDriverSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const driverId = e.target.value;
    setVendaDriverId(driverId);
    const matched = motoristas.find((m) => m.id === driverId);
    if (matched) {
      setVendaDriverPlate(`${matched.name} / ${matched.licensePlate}`);
    } else {
      setVendaDriverPlate('');
    }
  };

  const handleVendaQuantityChange = (val: string) => {
    setVendaQuantity(val);
    const qty = parseFloat(val) || 0;
    if (vendaFreightPayable === 'YES') {
      setVendaFreightCost(String(qty * freightRatePerTon));
    }
  };

  const handleSaveVendaModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked(vendaDate)) {
      alert('O ciclo mensal deste período está fechado. Reabra o ciclo em Configurações para realizar lançamentos nessa data.');
      return;
    }
    if (!vendaProduct.trim() && !vendaProductId) {
      alert('Selecione um produto cadastrado.');
      return;
    }

    const qty = parseFloat(vendaQuantity) || 1;
    const price = parseFloat(vendaUnitPrice) || 0;
    const selectedClient = clientes.find((c) => c.id === vendaClientId);
    const cName = selectedClient ? selectedClient.name : 'Cliente Direto';

    const matchedProduct =
      produtos.find((p) => p.id === vendaProductId) ||
      produtos.find((p) => p.name.trim().toLowerCase() === vendaProduct.trim().toLowerCase());

    const matchedDriver =
      motoristas.find((m) => m.id === vendaDriverId) ||
      motoristas.find((m) => `${m.name} / ${m.licensePlate}` === vendaDriverPlate);

    const fCost = vendaFreightPayable === 'YES' ? parseFloat(vendaFreightCost) || (qty * freightRatePerTon) : 0;

    const vendaPayload: Partial<VendaRecord> = {
      date: vendaDate,
      clientId: vendaClientId,
      clientName: cName,
      product: (vendaProduct || matchedProduct?.name || '').trim(),
      productId: vendaProductId || matchedProduct?.id || undefined,
      unitOfMeasure: matchedProduct?.unitOfMeasure || 'ton',
      quantity: qty,
      unitPrice: price,
      totalValue: qty * price,
      notes: vendaNotes,
      freightPayable: vendaFreightPayable,
      freightCost: fCost,
      freightStatus: editingVenda?.freightStatus || 'PENDING',
      freightPaidAt: editingVenda?.freightPaidAt,
      transactionKey: editingVenda?.transactionKey,
      driverId: vendaFreightPayable === 'YES' ? (matchedDriver?.id || vendaDriverId || undefined) : undefined,
      motoristaId: vendaFreightPayable === 'YES' ? (matchedDriver?.id || vendaDriverId || undefined) : undefined,
      driverPlate: vendaFreightPayable === 'YES' ? (vendaDriverPlate || (matchedDriver ? `${matchedDriver.name} / ${matchedDriver.licensePlate}` : '')).trim() : undefined,
      licensePlate: vendaFreightPayable === 'YES' ? (matchedDriver?.licensePlate || undefined) : undefined,
    };

    if (editingVenda) {
      onUpdateVenda({
        ...editingVenda,
        ...vendaPayload,
      } as VendaRecord);
    } else {
      onAddVenda(vendaPayload);
    }
    setShowVendaModal(false);
  };

  // Quitar venda (Pending -> Paid)
  const handleMarkAsPaid = (venda: VendaRecord) => {
    if (isLocked(venda.date)) {
      alert('Operação bloqueada: o registro pertence a um mês trancado no Fechamento de Ciclo.');
      return;
    }
    onToggleVendaStatus(venda.id);
  };

  // Reverter venda (Paid -> Pending)
  const handleConfirmRevert = () => {
    if (!vendaToRevert) return;
    if (isLocked(vendaToRevert.date)) {
      alert('Operação bloqueada: o registro pertence a um mês trancado no Fechamento de Ciclo.');
      setVendaToRevert(null);
      return;
    }
    onToggleVendaStatus(vendaToRevert.id);
    setVendaToRevert(null);
  };

  // Metrics: Consider all sales regardless of active subtab
  const totalVendaSum = vendas.reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
  const totalPaidVendas = vendas
    .filter((v) => v.status === 'PAID')
    .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
  const totalPendingVendas = vendas
    .filter((v) => v.status !== 'PAID')
    .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);

  // Filtered sales lists by status
  const pendingVendasAll = useMemo(() => {
    return vendas.filter((v) => v.status !== 'PAID');
  }, [vendas]);

  const paidVendasAll = useMemo(() => {
    return vendas.filter((v) => v.status === 'PAID');
  }, [vendas]);

  // Group sales by Client for the active subtab
  const groupedClientVendas = useMemo(() => {
    const baseList = vendaStatusFilter === 'PENDING' ? pendingVendasAll : paidVendasAll;
    const term = vendaSearchTerm.trim().toLowerCase();

    // Filter by search term if provided
    const filteredSales = term
      ? baseList.filter((v) => {
          const matchClient = (v.clientName || '').toLowerCase().includes(term);
          const matchProduct = (v.product || '').toLowerCase().includes(term);
          const matchDate = (v.date || '').includes(term);
          const matchNotes = (v.notes || '').toLowerCase().includes(term);
          const matchDriver = (v.driverPlate || '').toLowerCase().includes(term);
          return matchClient || matchProduct || matchDate || matchNotes || matchDriver;
        })
      : baseList;

    // Grouping map by client
    const groupsMap = new Map<
      string,
      {
        key: string;
        clientId: string;
        clientName: string;
        clientContact?: string;
        sales: VendaRecord[];
        totalQuantity: number;
        totalValue: number;
      }
    >();

    filteredSales.forEach((venda) => {
      // Find client record if exists to get authoritative name and contact
      const clientObj = clientes.find(
        (c) =>
          (venda.clientId && c.id === venda.clientId) ||
          (venda.clientName && c.name.trim().toLowerCase() === venda.clientName.trim().toLowerCase())
      );

      // Primary key: clientId, fallback to normalized client name
      const groupKey =
        venda.clientId?.trim() ||
        clientObj?.id ||
        `name_${(venda.clientName || '').trim().toLowerCase()}` ||
        'sem_cliente';
      const displayName = clientObj?.name || venda.clientName || 'Cliente Direto';

      let group = groupsMap.get(groupKey);
      if (!group) {
        group = {
          key: groupKey,
          clientId: venda.clientId || clientObj?.id || '',
          clientName: displayName,
          clientContact: clientObj?.contact,
          sales: [],
          totalQuantity: 0,
          totalValue: 0,
        };
        groupsMap.set(groupKey, group);
      }

      group.sales.push(venda);
      group.totalQuantity += Number(venda.quantity) || 0;
      group.totalValue += Number(venda.totalValue) || 0;
    });

    const groupsArray = Array.from(groupsMap.values());

    // Sort sales inside each group by date descending
    groupsArray.forEach((g) => {
      g.sales.sort((a, b) => {
        const dateCmp = (b.date || '').localeCompare(a.date || '');
        if (dateCmp !== 0) return dateCmp;
        return (b.id || '').localeCompare(a.id || '');
      });
    });

    // Sort client groups:
    // In PENDING: by highest pending total value first, then client name
    // In PAID: by highest paid total value first, then client name
    groupsArray.sort((a, b) => {
      if (b.totalValue !== a.totalValue) {
        return b.totalValue - a.totalValue;
      }
      return a.clientName.localeCompare(b.clientName);
    });

    return groupsArray;
  }, [vendaStatusFilter, pendingVendasAll, paidVendasAll, vendaSearchTerm, clientes]);

  return (
    <div className="space-y-4">
      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-[#232832] text-purple-400 rounded-xl border border-[var(--graphite-border-subtle)]">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
              Faturamento Total Vendas
            </span>
            <span className="text-lg font-bold text-white font-mono">{formatCurrency(totalVendaSum)}</span>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-[#232832] text-emerald-400 rounded-xl border border-[var(--graphite-border-subtle)]">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
              Vendas Recebidas / Quitadas
            </span>
            <span className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(totalPaidVendas)}</span>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-[#232832] text-amber-400 rounded-xl border border-[var(--graphite-border-subtle)]">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
              A Receber (Pendentes)
            </span>
            <span className="text-lg font-bold text-amber-400 font-mono">{formatCurrency(totalPendingVendas)}</span>
          </div>
        </div>
      </div>

      {/* Primary Module Tabs */}
      <div className="flex border-b border-[var(--graphite-border-subtle)] bg-[var(--graphite-surface-1)] rounded-t-2xl px-4 pt-3 space-x-2">
        <button
          onClick={() => setActiveSubTab('SALES')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeSubTab === 'SALES'
              ? 'border-[var(--graphite-accent-blue)] text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Lançamento de Vendas Diretas ({vendas.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('CLIENTS')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeSubTab === 'CLIENTS'
              ? 'border-[var(--graphite-accent-blue)] text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Cadastro de Clientes ({clientes.length})</span>
        </button>
      </div>

      {/* SUBTAB: SALES (LANÇAMENTO DE VENDAS DIRETAS ORGANIZADO POR CLIENTE) */}
      {activeSubTab === 'SALES' && (
        <div className="glass-card-static overflow-hidden">
          {/* Header with Sub-Tabs & Actions */}
          <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="mac-segmented-control">
                <button
                  type="button"
                  onClick={() => setVendaStatusFilter('PENDING')}
                  className={`mac-segmented-item ${
                    vendaStatusFilter === 'PENDING' ? 'mac-segmented-item-active text-amber-300' : 'text-slate-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Pendentes ({pendingVendasAll.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVendaStatusFilter('PAID')}
                  className={`mac-segmented-item ${
                    vendaStatusFilter === 'PAID' ? 'mac-segmented-item-active text-emerald-300' : 'text-slate-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Quitadas ({paidVendasAll.length})</span>
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={vendaSearchTerm}
                  onChange={(e) => setVendaSearchTerm(e.target.value)}
                  placeholder={vendaStatusFilter === 'PENDING' ? 'Buscar em pendentes...' : 'Buscar em quitadas...'}
                  className="pl-8 pr-3 py-1.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--graphite-accent-blue)] w-48 sm:w-60"
                />
              </div>

              <button
                onClick={() => openVendaModal()}
                className="mac-button-primary whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Venda</span>
              </button>
            </div>
          </div>

          {/* Grouped Client List */}
          <div className="p-4 space-y-3.5">
            {groupedClientVendas.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-medium bg-[#12151a]/50 rounded-2xl border border-[var(--graphite-border-subtle)]">
                {vendaSearchTerm
                  ? 'Nenhuma venda encontrada para esta pesquisa.'
                  : vendaStatusFilter === 'PENDING'
                  ? 'Nenhuma venda pendente.'
                  : 'Nenhuma venda quitada.'}
              </div>
            ) : (
              <>
                {/* Discrete Client Count Header & Toggle All */}
                <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-1">
                  <span className="flex items-center space-x-1.5 font-medium">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {groupedClientVendas.length}{' '}
                      {groupedClientVendas.length === 1 ? 'cliente' : 'clientes'}{' '}
                      {vendaStatusFilter === 'PENDING' ? 'com valores a receber' : 'com vendas quitadas'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const allCollapsed = groupedClientVendas.every((g) => collapsedGroups[g.key]);
                      const newMap: Record<string, boolean> = {};
                      groupedClientVendas.forEach((g) => {
                        newMap[g.key] = !allCollapsed;
                      });
                      setCollapsedGroups(newMap);
                    }}
                    className="text-[11px] text-slate-400 hover:text-white transition-colors flex items-center space-x-1 font-medium cursor-pointer"
                  >
                    <ChevronsUpDown className="w-3 h-3" />
                    <span>
                      {groupedClientVendas.every((g) => collapsedGroups[g.key])
                        ? 'Expandir Todos'
                        : 'Recolher Todos'}
                    </span>
                  </button>
                </div>

            {pdfNotification && (
              <div className="p-3 bg-blue-950/80 border border-blue-800 text-blue-200 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{pdfNotification}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfNotification(null)}
                  className="text-slate-400 hover:text-white text-xs ml-4"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Individual Client Accordion Groups */}
                {groupedClientVendas.map((group) => {
                  const isCollapsed = Boolean(collapsedGroups[group.key]);
                  return (
                    <div
                      key={group.key}
                      className="rounded-2xl border border-[var(--graphite-border-base)] bg-[var(--graphite-surface-2)] overflow-hidden shadow-sm transition-all"
                    >
                      {/* Group Header (Clickable Accordion) */}
                      <div
                        onClick={() => toggleGroupCollapse(group.key)}
                        className="p-3.5 bg-[var(--graphite-surface-1)] hover:bg-[#1a1f28] cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors select-none"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-1 rounded-md text-slate-400 hover:text-white bg-[#12151a] border border-[var(--graphite-border-subtle)]">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-white">{group.clientName}</span>
                            {group.clientContact && (
                              <span className="hidden md:inline-flex items-center space-x-1 text-[11px] text-slate-400 px-2 py-0.5 rounded-md bg-[#12151a] border border-[var(--graphite-border-subtle)]">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{group.clientContact}</span>
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                              vendaStatusFilter === 'PENDING'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                            }`}
                          >
                            {group.sales.length}{' '}
                            {group.sales.length === 1
                              ? vendaStatusFilter === 'PENDING'
                                ? 'venda pendente'
                                : 'venda quitada'
                              : vendaStatusFilter === 'PENDING'
                              ? 'vendas pendentes'
                              : 'vendas quitadas'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-xs self-end sm:self-auto">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {vendaStatusFilter === 'PENDING' ? 'Total a Receber:' : 'Total Quitado:'}
                            </span>
                            <span
                              className={`font-extrabold text-sm font-mono ${
                                vendaStatusFilter === 'PENDING' ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              {formatCurrency(group.totalValue)}
                            </span>
                          </div>

                          {vendaStatusFilter === 'PENDING' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const success = generateClientPendingPdf({
                                  client: { id: group.clientId, name: group.clientName },
                                  vendas,
                                  appSettings,
                                  customLogo,
                                });
                                if (!success) {
                                  setPdfNotification('Este cliente não possui valores pendentes.');
                                  setTimeout(() => setPdfNotification(null), 3500);
                                }
                              }}
                              className="mac-button-secondary py-1 px-2.5 text-xs flex items-center space-x-1.5"
                              title="Gerar demonstrativo em PDF para este cliente"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-400" />
                              <span>Gerar PDF</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Group Sales Table (when expanded) */}
                      {!isCollapsed && (
                        <div className="overflow-x-auto border-t border-[var(--graphite-border-subtle)]">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="mac-table-header">
                                <th className="py-2.5 px-3">Data</th>
                                <th className="py-2.5 px-3">Produto</th>
                                <th className="py-2.5 px-3 text-right">Qtd</th>
                                <th className="py-2.5 px-3 text-right">Preço Un.</th>
                                <th className="py-2.5 px-3 text-right">Valor Total</th>
                                <th className="py-2.5 px-3 text-center">Frete</th>
                                {vendaStatusFilter === 'PAID' && (
                                  <th className="py-2.5 px-3 text-center">Quitado Em</th>
                                )}
                                <th className="py-2.5 px-3 text-center">Status / Cobrança</th>
                                <th className="py-2.5 px-3 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300 bg-[#12151a]/40">
                              {group.sales.map((v) => {
                                const locked = isLocked(v.date);
                                const hasFreight = v.freightPayable === 'YES' || (v.freightPayable as any) === true;
                                return (
                                  <tr key={v.id} className="mac-table-row">
                                    <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                                      <div className="flex items-center space-x-1">
                                        {locked && <Lock className="w-3 h-3 text-amber-400" title="Mês Trancado" />}
                                        <span>{formatDateBR(v.date)}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-200 font-medium">{v.product}</td>
                                    <td className="py-2.5 px-3 text-right font-bold text-slate-200 font-mono">
                                      {formatNumber(v.quantity, 2)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                                      {formatCurrency(v.unitPrice)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-extrabold text-emerald-400 font-mono">
                                      {formatCurrency(v.totalValue)}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      {hasFreight ? (
                                        <div className="inline-flex flex-col items-center">
                                          <span
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                              v.freightStatus === 'PAID'
                                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                                : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                            }`}
                                          >
                                            {formatCurrency(v.freightCost || 0)} ({v.freightStatus === 'PAID' ? 'Pago' : 'Pend.'})
                                          </span>
                                          {v.driverPlate && (
                                            <span className="text-[9px] text-slate-400 truncate max-w-[110px]" title={v.driverPlate}>
                                              {v.driverPlate}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-500 font-medium">Sem frete</span>
                                      )}
                                    </td>
                                    {vendaStatusFilter === 'PAID' && (
                                      <td className="py-2.5 px-3 text-center text-slate-400 whitespace-nowrap font-mono text-[11px]">
                                        {v.paidAt ? formatDateBR(v.paidAt.split('T')[0]) : '-'}
                                      </td>
                                    )}
                                    <td className="py-2.5 px-3 text-center">
                                      {vendaStatusFilter === 'PENDING' ? (
                                        <button
                                          disabled={locked}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkAsPaid(v);
                                          }}
                                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all bg-amber-950/80 hover:bg-emerald-900 text-amber-300 hover:text-emerald-200 border border-amber-800 hover:border-emerald-700 flex items-center space-x-1 mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
                                          title={locked ? 'Período trancado' : 'Clique para marcar como PAGO / QUITADO'}
                                        >
                                          <CheckCircle2 className="w-3 h-3 text-amber-400" />
                                          <span>PENDENTE (Quitar)</span>
                                        </button>
                                      ) : (
                                        <div className="inline-flex items-center space-x-1.5">
                                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                                            PAGO
                                          </span>
                                          <button
                                            disabled={locked}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setVendaToRevert(v);
                                            }}
                                            className="px-2 py-0.5 rounded-md text-[10px] font-bold transition-all bg-[#232832] hover:bg-amber-950/60 text-slate-300 hover:text-amber-300 border border-[var(--graphite-border-subtle)] hover:border-amber-800 flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                            title={locked ? 'Período trancado' : 'Reverter esta venda para Pendente'}
                                          >
                                            <RotateCcw className="w-3 h-3 text-amber-400" />
                                            <span>Reverter</span>
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <div className="flex items-center justify-center space-x-1">
                                        <button
                                          disabled={locked}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openVendaModal(v);
                                          }}
                                          className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                          title="Editar venda"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          disabled={locked}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Excluir este lançamento de venda?')) {
                                              onDeleteVenda(v.id);
                                            }
                                          }}
                                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                          title="Excluir venda"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: CLIENTS */}
      {activeSubTab === 'CLIENTS' && (
        <div className="glass-card-static overflow-hidden">
          <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span>Clientes Cadastrados</span>
            </h2>
            <button
              onClick={() => openClientModal()}
              className="mac-button-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Cliente</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-3">Nome / Razão Social</th>
                  <th className="py-2.5 px-3">Contato / Telefone</th>
                  <th className="py-2.5 px-3">Observações</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 font-medium">
                      Nenhum cliente cadastrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map((c) => (
                    <tr key={c.id} className="mac-table-row">
                      <td className="py-2.5 px-3 font-semibold text-white">{c.name}</td>
                      <td className="py-2.5 px-3 text-slate-300">{c.contact || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-400">{c.notes || '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => openClientModal(c)}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all"
                            title="Editar cliente"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteClient(c.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all"
                            title="Excluir cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reverting Sale to Pending */}
      {vendaToRevert && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#181c23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--graphite-border-base)]">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-amber-950/80 border border-amber-700 rounded-xl text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Reverter venda para pendente?</h3>
                <p className="text-xs text-slate-400">Ela voltará a aparecer na lista de cobranças.</p>
              </div>
            </div>

            <div className="p-3 bg-[var(--graphite-surface-2)] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1 mb-4 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Cliente:</span>
                <span className="font-bold text-white">{vendaToRevert.clientName}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Produto:</span>
                <span className="text-slate-200">{vendaToRevert.product}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Valor:</span>
                <span className="font-bold text-emerald-400 font-mono">{formatCurrency(vendaToRevert.totalValue)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setVendaToRevert(null)}
                className="mac-button-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all shadow-md flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reverter para pendente</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Client Modal */}
      {showClientModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#181c23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="text-base font-bold text-white mb-4">
              {editingClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
            </h3>
            <form onSubmit={handleSaveClientModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome / Razão Social *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Madeireira Vale do Sol"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Contato / Telefone</label>
                <input
                  type="text"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  placeholder="Ex: (42) 99911-2233"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Anotações sobre faturamento ou prazos"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-[var(--graphite-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="mac-button-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mac-button-primary"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Venda Modal */}
      {showVendaModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#181c23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="text-base font-bold text-white mb-4">
              {editingVenda ? 'Editar Lançamento de Venda' : 'Lançar Nova Venda'}
            </h3>
            <form onSubmit={handleSaveVendaModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Data da Venda *</label>
                <input
                  type="date"
                  required
                  value={vendaDate}
                  onChange={(e) => setVendaDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cliente *</label>
                <select
                  value={vendaClientId}
                  onChange={(e) => setVendaClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                >
                  {clientes.length === 0 && <option value="">Nenhum cliente cadastrado</option>}
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Produto Vendido *</label>
                {(() => {
                  const activeVendaProducts = produtos.filter((p) => p.status === 'ACTIVE' || !p.status);
                  const displayVendaProducts = [...activeVendaProducts];
                  if (editingVenda && vendaProductId) {
                    const cur = produtos.find((p) => p.id === vendaProductId);
                    if (cur && cur.status === 'INACTIVE' && !displayVendaProducts.some((p) => p.id === cur.id)) {
                      displayVendaProducts.push(cur);
                    }
                  }

                  if (displayVendaProducts.length === 0) {
                    return (
                      <div className="p-2.5 bg-amber-950/50 border border-amber-800 rounded-xl text-amber-300 text-xs font-medium">
                        Nenhum produto ativo cadastrado no catálogo.
                      </div>
                    );
                  }

                  return (
                    <select
                      required
                      value={vendaProductId}
                      onChange={handleVendaProductSelectChange}
                      className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-medium"
                    >
                      {!vendaProductId && <option value="">Selecione um produto...</option>}
                      {displayVendaProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.status === 'INACTIVE' ? '(INATIVO)' : ''} — R$ {p.referencePrice}/{p.unitOfMeasure || 'ton'}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quantidade *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={vendaQuantity}
                    onChange={(e) => handleVendaQuantityChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Preço Unitário (R$) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={vendaUnitPrice}
                    onChange={(e) => setVendaUnitPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold font-mono"
                  />
                </div>
              </div>

              {/* Total Calculated Preview */}
              <div className="p-3 bg-[var(--graphite-surface-2)] border border-[var(--graphite-border-subtle)] rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">Total da Venda (Qtd × Preço):</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {formatCurrency((parseFloat(vendaQuantity) || 0) * (parseFloat(vendaUnitPrice) || 0))}
                </span>
              </div>

              {/* Frete Configuration */}
              <div className="p-3 bg-[var(--graphite-surface-2)] border border-[var(--graphite-border-subtle)] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-white font-bold flex items-center space-x-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Frete desta Venda</span>
                  </label>
                  <select
                    value={vendaFreightPayable}
                    onChange={(e) => {
                      const val = e.target.value as 'YES' | 'NO';
                      setVendaFreightPayable(val);
                      if (val === 'YES') {
                        const qtyNum = parseFloat(vendaQuantity) || 0;
                        setVendaFreightCost(String(qtyNum * freightRatePerTon));
                      }
                    }}
                    className="px-2.5 py-1 text-xs bg-[#12151a] border border-[var(--graphite-border-base)] text-white rounded-lg font-semibold focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  >
                    <option value="NO">NÃO (Sem Frete)</option>
                    <option value="YES">SIM (Frete a Pagar)</option>
                  </select>
                </div>

                {vendaFreightPayable === 'YES' && (
                  <div className="space-y-2 pt-1 border-t border-[var(--graphite-border-subtle)]">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Motorista do Transporte</label>
                      {(() => {
                        const activeDrivers = motoristas.filter((m) => m.status === 'ACTIVE' || !m.status);
                        const displayDrivers = [...activeDrivers];
                        if (editingVenda && vendaDriverId) {
                          const cur = motoristas.find((m) => m.id === vendaDriverId);
                          if (cur && cur.status === 'INACTIVE' && !displayDrivers.some((p) => p.id === cur.id)) {
                            displayDrivers.push(cur);
                          }
                        }

                        if (displayDrivers.length === 0) {
                          return (
                            <input
                              type="text"
                              value={vendaDriverPlate}
                              onChange={(e) => setVendaDriverPlate(e.target.value)}
                              placeholder="Ex: João Silva / ABC-1234"
                              className="w-full px-3 py-1.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                            />
                          );
                        }

                        return (
                          <div className="space-y-1">
                            <select
                              value={vendaDriverId}
                              onChange={handleVendaDriverSelectChange}
                              className="w-full px-3 py-1.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                            >
                              <option value="">Selecione um motorista...</option>
                              {displayDrivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name} — Placa: {d.licensePlate} {d.status === 'INACTIVE' ? '(INATIVO)' : ''}
                                </option>
                              ))}
                            </select>
                            {!vendaDriverId && (
                              <input
                                type="text"
                                value={vendaDriverPlate}
                                onChange={(e) => setVendaDriverPlate(e.target.value)}
                                placeholder="Ou digite Motorista / Placa avulsa..."
                                className="w-full px-3 py-1 bg-[#12151a] border border-[var(--graphite-border-subtle)] rounded-xl text-slate-300 text-xs"
                              />
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Custo Frete a Pagar (R$)</label>
                      <input
                        type="number"
                        step="1"
                        value={vendaFreightCost}
                        onChange={(e) => setVendaFreightCost(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold text-blue-400 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={vendaNotes}
                  onChange={(e) => setVendaNotes(e.target.value)}
                  placeholder="Observações do pedido"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-[var(--graphite-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowVendaModal(false)}
                  className="mac-button-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mac-button-primary"
                >
                  Salvar Venda
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

