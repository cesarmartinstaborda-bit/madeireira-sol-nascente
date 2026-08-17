import React, { useState } from 'react';
import { ClientRecord, VendaRecord, ProdutoRecord, UNIT_OF_MEASURE_OPTIONS, UnitOfMeasure } from '../types';
import { formatBRL, formatNumber, formatDate } from '../utils/formatters';
import { PdfPreviewModal } from './PdfPreviewModal';
import {
  Users,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  RotateCcw,
  Plus,
  Search,
  Phone,
  FileText,
  UserPlus,
  Trash2,
  Edit3,
  TrendingUp,
  AlertCircle,
  Tag,
  Check,
  Lock,
} from 'lucide-react';

interface GestaoClientesDashboardProps {
  clientes: ClientRecord[];
  vendas: VendaRecord[];
  produtos?: ProdutoRecord[];
  onAddClient: (client: Partial<ClientRecord>) => void;
  onUpdateClient: (client: ClientRecord) => void;
  onDeleteClient: (id: string) => void;
  onAddVenda: (venda: Partial<VendaRecord>) => void;
  onUpdateVenda: (venda: VendaRecord) => void;
  onDeleteVenda: (id: string) => void;
  onToggleVendaStatus: (id: string, transactionKey?: string) => void;
  lockedMonths?: string[];
}

export const GestaoClientesDashboard: React.FC<GestaoClientesDashboardProps> = ({
  clientes,
  vendas,
  produtos = [],

  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onAddVenda,
  onUpdateVenda,
  onDeleteVenda,
  onToggleVendaStatus,
  lockedMonths = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [pdfModalState, setPdfModalState] = useState<{
    isOpen: boolean;
    client: ClientRecord | { name: string; contact?: string; notes?: string };
    vendas: VendaRecord[];
  }>({
    isOpen: false,
    client: { name: '' },
    vendas: [],
  });
  
  // Forms state
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [showAddVendaForm, setShowAddVendaForm] = useState(false);
  const [selectedClientIdForVenda, setSelectedClientIdForVenda] = useState<string>('');

  // Active products from the dynamic database
  const activeProducts = produtos.filter((p) => p.status === 'ACTIVE');
  const initialProdName = activeProducts[0]?.name || produtos[0]?.name || 'Eucalipto';
  const initialProdRefPrice = activeProducts[0]?.referencePrice ?? produtos[0]?.referencePrice ?? 250;
  const initialProdUnit = activeProducts[0]?.unitOfMeasure ?? produtos[0]?.unitOfMeasure ?? 'ton';

  // New Client Form Inputs
  const [newClientName, setNewClientName] = useState('');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');

  // New Venda Form Inputs
  const [newVendaDate, setNewVendaDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newVendaClientId, setNewVendaClientId] = useState('');
  const [newVendaProduct, setNewVendaProduct] = useState(initialProdName);
  const [newVendaQty, setNewVendaQty] = useState<number>(10);
  const [newVendaUnit, setNewVendaUnit] = useState<UnitOfMeasure | string>(initialProdUnit);
  const [newVendaUnitPrice, setNewVendaUnitPrice] = useState<number>(initialProdRefPrice);
  const [newVendaNotes, setNewVendaNotes] = useState('');

  const [isSubmittingClient, setIsSubmittingClient] = useState(false);
  const [clientFormError, setClientFormError] = useState('');
  const [isSubmittingVenda, setIsSubmittingVenda] = useState(false);
  const [vendaFormError, setVendaFormError] = useState('');

  // Handle product selection change in the New Venda Form
  const handleVendaProductSelect = (selectedProdName: string) => {
    setNewVendaProduct(selectedProdName);
    const matchedProd = produtos.find((p) => p.name === selectedProdName);
    if (matchedProd) {
      setNewVendaUnitPrice(matchedProd.referencePrice);
      if (matchedProd.unitOfMeasure) {
        setNewVendaUnit(matchedProd.unitOfMeasure);
      }
    }
  };

  // Global KPIs across all sales
  const totalGrossSales = vendas.reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
  const totalReceivablesPending = vendas
    .filter((v) => v.status === 'PENDING')
    .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
  const totalReceivedPaid = vendas
    .filter((v) => v.status === 'PAID')
    .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);

  // All client names combined
  const clientMap = new Map<string, ClientRecord>();
  clientes.forEach((c) => clientMap.set(c.id, c));

  // Build a grouped list of client profiles
  const clientProfiles = Array.from(clientMap.values()).map((client) => {
    const clientVendas = vendas.filter(
      (v) => v.clientId === client.id || v.clientName.toLowerCase().trim() === client.name.toLowerCase().trim()
    );
    const grossSales = clientVendas.reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
    const receivables = clientVendas
      .filter((v) => v.status === 'PENDING')
      .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
    const received = clientVendas
      .filter((v) => v.status === 'PAID')
      .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);

    return {
      client,
      vendas: clientVendas,
      grossSales,
      receivables,
      received,
      pendingCount: clientVendas.filter((v) => v.status === 'PENDING').length,
    };
  });

  // Handle orphan sales
  const knownClientIds = new Set(clientes.map((c) => c.id));
  const knownClientNames = new Set(clientes.map((c) => c.name.toLowerCase().trim()));

  const orphanVendas = vendas.filter(
    (v) => !knownClientIds.has(v.clientId) && !knownClientNames.has(v.clientName.toLowerCase().trim())
  );

  if (orphanVendas.length > 0) {
    const orphanGroups = new Map<string, VendaRecord[]>();
    orphanVendas.forEach((v) => {
      const name = v.clientName || 'Cliente Geral';
      if (!orphanGroups.has(name)) orphanGroups.set(name, []);
      orphanGroups.get(name)!.push(v);
    });

    orphanGroups.forEach((vList, name) => {
      const grossSales = vList.reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
      const receivables = vList
        .filter((v) => v.status === 'PENDING')
        .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
      const received = vList
        .filter((v) => v.status === 'PAID')
        .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);

      clientProfiles.push({
        client: {
          id: `orphan-${name}`,
          name: name,
          contact: 'Não cadastrado',
          notes: 'Vendas avulsas registradas diretamente',
          createdAt: new Date().toISOString(),
        },
        vendas: vList,
        grossSales,
        receivables,
        received,
        pendingCount: vList.filter((v) => v.status === 'PENDING').length,
      });
    });
  }

  // Filter profiles
  const filteredProfiles = clientProfiles.filter(({ client, vendas: clientVendas, receivables, grossSales }) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      client.name.toLowerCase().includes(term) ||
      (client.contact && client.contact.toLowerCase().includes(term)) ||
      clientVendas.some(
        (v) =>
          v.product.toLowerCase().includes(term) ||
          (v.notes && v.notes.toLowerCase().includes(term))
      );

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING' && receivables > 0) ||
      (statusFilter === 'PAID' && receivables === 0 && grossSales > 0);

    return matchesSearch && matchesStatus;
  });

  // Handle Add Client Submit
  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingClient) return;

    if (!newClientName.trim()) {
      setClientFormError('Nome do cliente é obrigatório.');
      return;
    }

    setIsSubmittingClient(true);
    setClientFormError('');
    try {
      onAddClient({
        name: newClientName.trim(),
        contact: newClientContact.trim(),
        notes: newClientNotes.trim(),
        createdAt: new Date().toISOString(),
      });

      setNewClientName('');
      setNewClientContact('');
      setNewClientNotes('');
      setShowAddClientForm(false);
    } finally {
      setTimeout(() => setIsSubmittingClient(false), 500);
    }
  };

  // Handle Add Venda Submit
  const handleCreateVenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingVenda) return;

    const targetClientId = selectedClientIdForVenda || newVendaClientId || (clientes[0]?.id || '');
    const clientObj = clientes.find((c) => c.id === targetClientId);
    const clientName = clientObj ? clientObj.name : 'Cliente Geral';

    const qty = Number(newVendaQty) || 0;
    const price = Number(newVendaUnitPrice) || 0;

    if (!targetClientId) {
      setVendaFormError('Selecione ou cadastre um cliente válido.');
      return;
    }
    if (qty <= 0) {
      setVendaFormError('A quantidade da venda deve ser maior que zero.');
      return;
    }
    if (price <= 0) {
      setVendaFormError('O preço unitário deve ser maior que zero.');
      return;
    }

    setIsSubmittingVenda(true);
    setVendaFormError('');
    try {
      const total = Number((qty * price).toFixed(2));
      const matchedProd = produtos.find((p) => p.name === newVendaProduct);

      onAddVenda({
        date: newVendaDate,
        clientId: targetClientId,
        clientName: clientName,
        productId: matchedProd?.id,
        product: newVendaProduct,
        quantity: qty,
        unitOfMeasure: newVendaUnit,
        unitPrice: price,
        totalValue: total,
        status: 'PENDING',
        notes: newVendaNotes.trim() || 'Venda registrada',
        createdAt: new Date().toISOString(),
      });

      setNewVendaNotes('');
      setShowAddVendaForm(false);
    } finally {
      setTimeout(() => setIsSubmittingVenda(false), 500);
    }
  };

  const openNewVendaModalForClient = (clientId: string) => {
    setSelectedClientIdForVenda(clientId);
    setNewVendaClientId(clientId);
    setShowAddVendaForm(true);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Module Overview Header */}
      <div className="glass-card-static p-4 rounded-2xl border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-100">Gestão de Clientes & Contas a Receber</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddClientForm(!showAddClientForm)}
            className="mac-button-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 font-semibold"
          >
            <UserPlus className="w-4 h-4 text-slate-400" />
            <span>+ Novo Cliente</span>
          </button>

          <button
            onClick={() => {
              setSelectedClientIdForVenda(clientes[0]?.id || '');
              setNewVendaClientId(clientes[0]?.id || '');
              setShowAddVendaForm(!showAddVendaForm);
            }}
            className="mac-button-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>+ Registrar Venda</span>
          </button>
        </div>
      </div>

      {/* Collapse Form: Add Client */}
      {showAddClientForm && (
        <form onSubmit={handleCreateClient} className="glass-card p-5 rounded-2xl space-y-4 shadow-xl border border-white/[0.10] text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-400" /> Cadastrar Novo Cliente
            </h3>
            <button
              type="button"
              onClick={() => {
                setClientFormError('');
                setShowAddClientForm(false);
              }}
              className="text-slate-400 hover:text-slate-100 font-bold p-1 rounded-lg hover:bg-white/[0.08] transition-colors"
            >
              ✕
            </button>
          </div>

          {clientFormError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{clientFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Nome do Cliente / Empresa *</label>
              <input
                type="text"
                required
                placeholder="Ex: Serraria Paraná Ltda"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="mac-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Contato / Telefone / E-mail</label>
              <input
                type="text"
                placeholder="(42) 99999-0000 / contato@empresa.com"
                value={newClientContact}
                onChange={(e) => setNewClientContact(e.target.value)}
                className="mac-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Observações / Tipo de Madeira</label>
              <input
                type="text"
                placeholder="Detalhes comerciais do cliente..."
                value={newClientNotes}
                onChange={(e) => setNewClientNotes(e.target.value)}
                className="mac-input w-full text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={() => setShowAddClientForm(false)}
              className="mac-button-secondary text-xs px-3.5 py-1.5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmittingClient}
              className="mac-button-primary text-xs px-4 py-1.5"
            >
              {isSubmittingClient ? 'Salvando...' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      )}

      {/* Collapse Form: Add Venda */}
      {showAddVendaForm && (
        <form onSubmit={handleCreateVenda} className="glass-card p-5 rounded-2xl space-y-4 shadow-xl border border-white/[0.10] text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-400" /> Registrar Nova Venda (Contas a Receber)
            </h3>
            <button
              type="button"
              onClick={() => {
                setVendaFormError('');
                setShowAddVendaForm(false);
              }}
              className="text-slate-400 hover:text-slate-100 font-bold p-1 rounded-lg hover:bg-white/[0.08] transition-colors"
            >
              ✕
            </button>
          </div>

          {vendaFormError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{vendaFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Data da Venda *</label>
              <input
                type="date"
                required
                value={newVendaDate}
                onChange={(e) => setNewVendaDate(e.target.value)}
                className="mac-input w-full text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Cliente *</label>
              <select
                value={selectedClientIdForVenda || newVendaClientId}
                onChange={(e) => {
                  setSelectedClientIdForVenda(e.target.value);
                  setNewVendaClientId(e.target.value);
                }}
                className="mac-input w-full text-xs font-semibold"
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Produto *</label>
              <select
                value={newVendaProduct}
                onChange={(e) => handleVendaProductSelect(e.target.value)}
                className="mac-input w-full text-xs font-semibold"
              >
                {(produtos.length > 0 ? produtos : [{ id: 'p1', name: 'Eucalipto', referencePrice: 250, status: 'ACTIVE' }]).map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} {p.status === 'INACTIVE' ? '(Inativo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Quantidade *</label>
              <input
                type="number"
                step="0.01"
                required
                value={newVendaQty}
                onChange={(e) => setNewVendaQty(Number(e.target.value))}
                className="mac-input w-full text-xs font-mono font-bold text-right"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Unidade *</label>
              <select
                value={newVendaUnit}
                onChange={(e) => setNewVendaUnit(e.target.value)}
                className="mac-input w-full text-xs font-semibold"
              >
                {UNIT_OF_MEASURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Preço Unit. (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={newVendaUnitPrice}
                onChange={(e) => setNewVendaUnitPrice(Number(e.target.value))}
                className="mac-input w-full text-xs font-mono font-bold text-right"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Total Calculado</label>
              <div className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2 font-mono font-extrabold text-slate-100 text-right text-xs">
                {formatBRL((Number(newVendaQty) || 0) * (Number(newVendaUnitPrice) || 0))}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Observações / Condição de Pagamento</label>
            <input
              type="text"
              placeholder="Ex: Fatura 30 dias / PIX / Cheque..."
              value={newVendaNotes}
              onChange={(e) => setNewVendaNotes(e.target.value)}
              className="mac-input w-full text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={() => setShowAddVendaForm(false)}
              className="mac-button-secondary text-xs px-3.5 py-1.5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmittingVenda}
              className="mac-button-primary text-xs px-4 py-1.5"
            >
              {isSubmittingVenda ? 'Lançando...' : 'Lançar Venda'}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente, produto ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mac-input pl-8 py-1.5 text-xs w-full"
            />
          </div>

          {/* Status Filter */}
          <div className="mac-segmented-control">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`mac-segmented-item ${statusFilter === 'ALL' ? 'mac-segmented-item-active' : ''}`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`mac-segmented-item ${statusFilter === 'PENDING' ? 'mac-segmented-item-active' : ''}`}
            >
              Com Pendências
            </button>
            <button
              onClick={() => setStatusFilter('PAID')}
              className={`mac-segmented-item ${statusFilter === 'PAID' ? 'mac-segmented-item-active' : ''}`}
            >
              Quitados
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Exibindo <span className="font-bold text-slate-100 font-mono">{filteredProfiles.length}</span> clientes agrupados
        </div>
      </div>

      {/* CLIENT GROUPED CARDS SECTION */}
      <div className="space-y-4">
        {filteredProfiles.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Users className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">Nenhum cliente encontrado</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Cadastre seu primeiro cliente ou lance uma venda para iniciar a gestão do faturamento.
            </p>
            <button
              onClick={() => setShowAddClientForm(true)}
              className="mt-4 mac-button-primary text-xs px-4 py-2"
            >
              + Cadastrar Cliente
            </button>
          </div>
        ) : (
          filteredProfiles.map(({ client, vendas: clientVendas, grossSales, receivables, received, pendingCount }) => {
            const hasPending = receivables > 0;

            return (
              <div
                key={client.id}
                className={`glass-card overflow-hidden transition-all ${
                  hasPending ? 'border-amber-500/25' : ''
                }`}
              >
                {/* Client Profile Header Bar */}
                <div
                  className={`p-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] ${
                    hasPending ? 'bg-amber-500/[0.02]' : 'bg-white/[0.01]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs bg-blue-600/15 text-blue-400 border border-blue-500/25">
                        {client.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-slate-100">{client.name}</h3>
                          {hasPending ? (
                            <span className="badge-amber flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-400" />
                              {pendingCount} Pendência(s)
                            </span>
                          ) : (
                            <span className="badge-emerald flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              100% Quitado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {client.contact || 'Sem contato'}
                          </span>
                          {client.notes && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <FileText className="w-3 h-3" />
                              {client.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Badges for this Client */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <div className="bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.07] text-right">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">Vendas Totais</p>
                      <p className="font-extrabold text-slate-100 font-mono">{formatBRL(grossSales)}</p>
                    </div>

                    <div className="bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.07] text-right">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">A Receber</p>
                      <p className={`font-extrabold font-mono ${hasPending ? 'text-amber-300' : 'text-slate-300'}`}>{formatBRL(receivables)}</p>
                    </div>

                    <div className="bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.07] text-right">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">Quitado</p>
                      <p className="font-extrabold text-emerald-400 font-mono">{formatBRL(received)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 border-l pl-2.5 border-white/[0.07]">
                      <button
                        onClick={() =>
                          setPdfModalState({
                            isOpen: true,
                            client,
                            vendas: clientVendas,
                          })
                        }
                        className="mac-button-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 font-semibold"
                        title="Gerar PDF Relatório A4"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>PDF</span>
                      </button>

                      <button
                        onClick={() => openNewVendaModalForClient(client.id)}
                        className="mac-button-secondary text-xs px-3 py-1.5 flex items-center gap-1 font-semibold"
                        title="Adicionar venda para este cliente"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-400" />
                        <span>Nova Venda</span>
                      </button>

                      {!client.id.startsWith('orphan-') && (
                        <button
                          onClick={() => onDeleteClient(client.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Excluir cliente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Individual Vendas Table for this Client */}
                <div className="p-3">
                  {clientVendas.length === 0 ? (
                    <div className="py-5 text-center text-xs text-slate-500 italic">
                      Nenhuma venda cadastrada para este cliente ainda.
                    </div>
                  ) : (
                    <div className="mac-table-container">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="mac-table-header">
                            <th className="py-2.5 px-3 w-32">Data Venda</th>
                            <th className="py-2.5 px-3 w-36">Produto</th>
                            <th className="py-2.5 px-3 text-right w-28">Quantidade</th>
                            <th className="py-2.5 px-3 text-right w-32">Preço Unit.</th>
                            <th className="py-2.5 px-3 text-right w-36">Total</th>
                            <th className="py-2.5 px-3 text-center w-32">Status</th>
                            <th className="py-2.5 px-3">Observações</th>
                            <th className="py-2.5 px-3 text-center w-40">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {clientVendas.map((venda) => {
                            const isPaid = venda.status === 'PAID';
                            const monthKey = venda.date ? venda.date.slice(0, 7) : '';
                            const isLocked = lockedMonths.includes(monthKey);

                            return (
                              <tr key={venda.id} className={`mac-table-row ${isLocked ? 'bg-amber-500/[0.04]' : ''}`}>
                                {/* Date */}
                                <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    {isLocked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Mês Trancado (Fechamento de Ciclo)" />}
                                    <span>{formatDate(venda.date)}</span>
                                  </div>
                                </td>

                                {/* Product */}
                                <td className="py-2.5 px-3 font-semibold text-slate-100">
                                  <div className="flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5 text-blue-400" />
                                    <span>{venda.product}</span>
                                  </div>
                                </td>

                                {/* Quantity */}
                                <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                                  {formatNumber(venda.quantity)} {venda.unitOfMeasure || 'ton'}
                                </td>

                                {/* Unit Price */}
                                <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                                  {formatBRL(venda.unitPrice)}
                                </td>

                                {/* Total Value */}
                                <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-100">
                                  {formatBRL(venda.totalValue)}
                                </td>

                                {/* Status Badge */}
                                <td className="py-2.5 px-3 text-center">
                                  {isPaid ? (
                                    <div className="flex flex-col items-center">
                                      <span className="badge-emerald inline-flex items-center gap-1">
                                        <Check className="w-3 h-3 text-emerald-400" /> PAGO
                                      </span>
                                      {venda.transactionKey && (
                                        <span className="text-[9px] font-mono text-emerald-400 font-bold mt-0.5" title="Comprovante de Pagamento">
                                          🔑 {venda.transactionKey}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="badge-amber inline-flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-amber-400" /> PENDENTE
                                    </span>
                                  )}
                                </td>

                                {/* Notes */}
                                <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-[200px]">
                                  {venda.notes || '-'}
                                </td>

                                {/* Action Buttons */}
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center space-x-1.5">
                                    {isLocked ? (
                                      <span className="badge-amber flex items-center gap-1" title="Lançamento em mês trancado (Fechamento de Ciclo)">
                                        <Lock className="w-3 h-3" /> Trancado
                                      </span>
                                    ) : (
                                      <>
                                        {!isPaid ? (
                                          <button
                                            onClick={() => onToggleVendaStatus(venda.id)}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shadow-xs transition-all active:scale-95 flex items-center gap-1"
                                            title="Marcar este lançamento como PAGO / RECEBIDO"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Receber</span>
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => onToggleVendaStatus(venda.id)}
                                            className="mac-button-secondary px-2.5 py-1 text-slate-300 hover:text-amber-300 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1"
                                            title="Reverter status para PENDENTE (Desfazer quitação)"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Desfazer</span>
                                          </button>
                                        )}

                                        <button
                                          onClick={() => onDeleteVenda(venda.id)}
                                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                          title="Excluir lançamento de venda"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
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
              </div>
            );
          })
        )}
      </div>

      {/* PDF Preview & Extrato de Cobrança Modal */}
      <PdfPreviewModal
        isOpen={pdfModalState.isOpen}
        onClose={() => setPdfModalState((p) => ({ ...p, isOpen: false }))}
        client={pdfModalState.client}
        vendas={pdfModalState.vendas}
      />
    </div>
  );
};
