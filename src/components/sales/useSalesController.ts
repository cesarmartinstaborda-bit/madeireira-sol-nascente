import React, { useMemo, useState } from 'react';
import { AppSettings, ClientRecord, MotoristaRecord, ProdutoRecord, VendaRecord } from '../../types';
import { formatBRLCurrencyInput, isMonthLocked, parseBRLCurrency } from '../../utils/formatters';
import { groupClientSales } from '../../utils/sales/groupClientSales';

export interface GestaoClientesDashboardProps {
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


/** Keeps state and effects mounted for the same lifetime as GestaoClientesDashboard. */
export function useSalesController({
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
}: GestaoClientesDashboardProps) {
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
      setVendaUnitPrice(formatBRLCurrencyInput(venda.unitPrice));
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
        setVendaFreightCost(formatBRLCurrencyInput(venda.freightCost));
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
        setVendaUnitPrice(formatBRLCurrencyInput(first.referencePrice));
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
      setVendaFreightCost(formatBRLCurrencyInput(shouldPayFreight ? freightRatePerTon : 0));
    }
    setShowVendaModal(true);
  };

  const handleVendaProductSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProdId = e.target.value;
    setVendaProductId(newProdId);
    const selectedProd = produtos.find((p) => p.id === newProdId);
    if (selectedProd) {
      setVendaProduct(selectedProd.name);
      setVendaUnitPrice(formatBRLCurrencyInput(selectedProd.referencePrice));
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
      setVendaFreightCost(formatBRLCurrencyInput(qty * freightRatePerTon));
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
    const price = parseBRLCurrency(vendaUnitPrice) || 0;
    const selectedClient = clientes.find((c) => c.id === vendaClientId);
    const cName = selectedClient ? selectedClient.name : 'Cliente Direto';

    const matchedProduct =
      produtos.find((p) => p.id === vendaProductId) ||
      produtos.find((p) => p.name.trim().toLowerCase() === vendaProduct.trim().toLowerCase());

    const matchedDriver =
      motoristas.find((m) => m.id === vendaDriverId) ||
      motoristas.find((m) => `${m.name} / ${m.licensePlate}` === vendaDriverPlate);

    const fCost = vendaFreightPayable === 'YES' ? parseBRLCurrency(vendaFreightCost) || (qty * freightRatePerTon) : 0;

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
    return groupClientSales(vendaStatusFilter === 'PENDING' ? pendingVendasAll : paidVendasAll, vendaSearchTerm, clientes);
  }, [vendaStatusFilter, pendingVendasAll, paidVendasAll, vendaSearchTerm, clientes]);


  return {
    appSettings,
    customLogo,
    totalVendaSum,
    totalPaidVendas,
    totalPendingVendas,
    setActiveSubTab,
    activeSubTab,
    vendas,
    clientes,
    setVendaStatusFilter,
    vendaStatusFilter,
    pendingVendasAll,
    paidVendasAll,
    vendaSearchTerm,
    setVendaSearchTerm,
    openVendaModal,
    groupedClientVendas,
    collapsedGroups,
    setCollapsedGroups,
    pdfNotification,
    setPdfNotification,
    toggleGroupCollapse,
    isLocked,
    handleMarkAsPaid,
    setVendaToRevert,
    onDeleteVenda,
    openClientModal,
    onDeleteClient,
    vendaToRevert,
    handleConfirmRevert,
    showClientModal,
    editingClient,
    handleSaveClientModal,
    clientName,
    setClientName,
    clientContact,
    setClientContact,
    clientNotes,
    setClientNotes,
    setShowClientModal,
    showVendaModal,
    editingVenda,
    handleSaveVendaModal,
    vendaDate,
    setVendaDate,
    vendaClientId,
    setVendaClientId,
    produtos,
    vendaProductId,
    handleVendaProductSelectChange,
    vendaQuantity,
    handleVendaQuantityChange,
    vendaUnitPrice,
    setVendaUnitPrice,
    vendaFreightPayable,
    setVendaFreightPayable,
    setVendaFreightCost,
    freightRatePerTon,
    motoristas,
    vendaDriverId,
    vendaDriverPlate,
    setVendaDriverPlate,
    handleVendaDriverSelectChange,
    vendaFreightCost,
    vendaNotes,
    setVendaNotes,
    setShowVendaModal,
  };
}
