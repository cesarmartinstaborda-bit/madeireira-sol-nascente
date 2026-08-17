import React, { useState } from 'react';
import { VendaRecord, ClientRecord, ProdutoRecord, UNIT_OF_MEASURE_OPTIONS } from '../types';
import { formatBRL, formatNumber } from '../utils/formatters';
import { PdfPreviewModal } from './PdfPreviewModal';
import { ShoppingBag, Clock, CheckCircle2, RotateCcw, Trash2, Plus, Sparkles, DollarSign, FileText, ChevronRight, Sliders } from 'lucide-react';

interface TableVendasProps {
  records: VendaRecord[];
  clientes: ClientRecord[];
  searchTerm: string;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onUpdateRecord: (record: VendaRecord) => void;
  onToggleStatus: (id: string) => void;
  produtos?: ProdutoRecord[];
}

export const TableVendas: React.FC<TableVendasProps> = ({
  records,
  clientes,
  searchTerm,
  onDelete,
  onAdd,
  onUpdateRecord,
  onToggleStatus,
  produtos = [],
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const [pdfModalState, setPdfModalState] = useState<{
    isOpen: boolean;
    client: ClientRecord | { name: string; contact?: string; notes?: string };
    vendas: VendaRecord[];
  }>({
    isOpen: false,
    client: { name: '' },
    vendas: [],
  });

  const handleGenerateClientPdf = () => {
    let targetClientName = clientFilter !== 'ALL' ? clientFilter : (uniqueClients[0] || 'Cliente Geral');
    const matchedClientObj = clientes.find((c) => c.name.toLowerCase().trim() === targetClientName.toLowerCase().trim());
    const clientSales = records.filter(
      (r) => r.clientName.toLowerCase().trim() === targetClientName.toLowerCase().trim()
    );

    setPdfModalState({
      isOpen: true,
      client: matchedClientObj || { name: targetClientName, contact: 'Não informado' },
      vendas: clientSales.length > 0 ? clientSales : records,
    });
  };

  // Unique clients
  const uniqueClients = Array.from(
    new Set([...clientes.map((c) => c.name), ...records.map((r) => r.clientName).filter(Boolean)])
  );

  // Dynamic products list pulled directly from the new Produtos table
  const activeProducts = produtos.filter((p) => p.status === 'ACTIVE');
  const productOptions = Array.from(
    new Set([
      ...activeProducts.map((p) => p.name),
      ...produtos.map((p) => p.name),
      ...records.map((r) => r.product).filter(Boolean),
    ])
  );

  // Filter records
  const filtered = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      r.clientName.toLowerCase().includes(term) ||
      r.product.toLowerCase().includes(term) ||
      (r.notes && r.notes.toLowerCase().includes(term)) ||
      r.date.includes(term);

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesClient = clientFilter === 'ALL' || r.clientName === clientFilter;

    return matchesSearch && matchesStatus && matchesClient;
  });

  // Calculate totals
  const totalValue = filtered.reduce((acc, r) => acc + (Number(r.totalValue) || 0), 0);
  const totalPending = filtered
    .filter((r) => r.status === 'PENDING')
    .reduce((acc, r) => acc + (Number(r.totalValue) || 0), 0);
  const totalPaid = filtered
    .filter((r) => r.status === 'PAID')
    .reduce((acc, r) => acc + (Number(r.totalValue) || 0), 0);
  const totalQty = filtered.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);

  // Sorting descending by date
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Product selection handler
  const handleProductChange = (item: VendaRecord, newProduct: string) => {
    const foundProd = produtos.find((p) => p.name === newProduct);
    const referencePrice = foundProd ? Number(foundProd.referencePrice) : item.unitPrice;
    const defaultUnit = foundProd ? (foundProd.unitOfMeasure || 'ton') : (item.unitOfMeasure || 'ton');
    const qty = Number(item.quantity) || 0;
    const newTotal = Number((qty * referencePrice).toFixed(2));
    onUpdateRecord({
      ...item,
      product: newProduct,
      unitOfMeasure: defaultUnit,
      unitPrice: referencePrice,
      totalValue: newTotal,
    });
  };

  // Inline editing handlers
  const handleQtyChange = (item: VendaRecord, newQty: number) => {
    const unitPrice = Number(item.unitPrice) || 0;
    const newTotal = Number((newQty * unitPrice).toFixed(2));
    onUpdateRecord({
      ...item,
      quantity: newQty,
      totalValue: newTotal,
    });
  };

  const handlePriceChange = (item: VendaRecord, newPrice: number) => {
    const qty = Number(item.quantity) || 0;
    const newTotal = Number((qty * newPrice).toFixed(2));
    onUpdateRecord({
      ...item,
      unitPrice: newPrice,
      totalValue: newTotal,
    });
  };

  const handleClientNameChange = (item: VendaRecord, newClientName: string) => {
    const matchedClient = clientes.find((c) => c.name === newClientName);
    onUpdateRecord({
      ...item,
      clientName: newClientName,
      clientId: matchedClient ? matchedClient.id : item.clientId,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total em Vendas</p>
            <p className="text-xl font-bold text-slate-100 mt-1 font-mono">{formatBRL(totalValue)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{formatNumber(totalQty)} toneladas/unidades</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <ShoppingBag className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pendente A Receber</p>
            <p className="text-xl font-bold text-amber-300 mt-1 font-mono">{formatBRL(totalPending)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Status PENDENTE</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <Clock className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Quitado</p>
            <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">{formatBRL(totalPaid)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Confirmados em conta</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Média por Venda</p>
            <p className="text-xl font-bold text-slate-100 mt-1 font-mono">
              {filtered.length > 0 ? formatBRL(totalValue / filtered.length) : 'R$ 0,00'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{filtered.length} lançamentos</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* Info Banner & Action Buttons */}
      <div className="glass-card p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong>Data Grid Editável:</strong> Edite diretamente qualquer campo ou altere a quitação com um clique.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateClientPdf}
            className="mac-button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            title="Gerar PDF Relatório A4"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>PDF</span>
          </button>

          <button
            onClick={onAdd}
            className="mac-button-primary px-3.5 py-1.5 font-bold text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Lançar Venda</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-400 text-[11px]">Status:</span>
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
                PENDENTE
              </button>
              <button
                onClick={() => setStatusFilter('PAID')}
                className={`mac-segmented-item ${statusFilter === 'PAID' ? 'mac-segmented-item-active' : ''}`}
              >
                PAGO
              </button>
            </div>
          </div>

          {/* Client Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-400 text-[11px]">Cliente:</span>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="mac-input py-1 px-2.5 font-medium text-slate-200"
            >
              <option value="ALL">Todos os Clientes</option>
              {uniqueClients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-slate-400 font-medium">
          Exibindo <span className="text-slate-100 font-bold font-mono">{filtered.length}</span> registros de vendas
        </div>
      </div>

      {/* Main Data Grid */}
      <div className="mac-table-container">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">Nenhuma venda encontrada</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Ajuste seus filtros de busca ou lance uma nova venda no botão acima.
            </p>
            <button
              onClick={onAdd}
              className="mt-4 mac-button-primary px-4 py-2 font-semibold text-xs"
            >
              Lançar Primeira Venda
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-2 w-8 text-center"></th>
                  <th className="py-2.5 px-3 w-32">Data Venda</th>
                  <th className="py-2.5 px-3 w-48">Cliente</th>
                  <th className="py-2.5 px-3 w-36">Produto</th>
                  <th className="py-2.5 px-3 text-right w-28">Quantidade</th>
                  <th className="py-2.5 px-3 text-right w-32">Total (R$)</th>
                  <th className="py-2.5 px-3 text-center w-28">Status</th>
                  <th className="py-2.5 px-3 text-center w-40">Quitação / Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sorted.map((item) => {
                  const isPaid = item.status === 'PAID';
                  const isExpanded = !!expandedRows[item.id];

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`mac-table-row ${isExpanded ? 'bg-white/[0.04]' : ''}`}>
                        {/* Expand Toggle */}
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => toggleRow(item.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors"
                            title={isExpanded ? 'Ocultar detalhes' : 'Ver e editar detalhes'}
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90 text-blue-400' : ''}`} />
                          </button>
                        </td>

                        {/* Date */}
                        <td className="py-2 px-2">
                          <input
                            type="date"
                            value={item.date || ''}
                            onChange={(e) => onUpdateRecord({ ...item, date: e.target.value })}
                            className="mac-input w-full font-mono text-slate-200 text-xs py-0.5 px-1.5"
                          />
                        </td>

                        {/* Client Select / Input */}
                        <td className="py-2 px-2">
                          <select
                            value={item.clientName}
                            onChange={(e) => handleClientNameChange(item, e.target.value)}
                            className="mac-input w-full font-semibold text-slate-100 text-xs py-0.5 px-1.5"
                          >
                            {uniqueClients.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Product */}
                        <td className="py-2 px-2">
                          <select
                            value={item.product || 'Eucalipto'}
                            onChange={(e) => handleProductChange(item, e.target.value)}
                            className="mac-input w-full font-medium text-slate-200 text-xs py-0.5 px-1.5"
                          >
                            {productOptions.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity ?? 0}
                            onChange={(e) => handleQtyChange(item, Number(e.target.value))}
                            className="mac-input w-full font-mono text-right font-semibold text-slate-200 text-xs py-0.5 px-1.5"
                          />
                        </td>

                        {/* Total Value */}
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={item.totalValue ?? 0}
                            onChange={(e) =>
                              onUpdateRecord({ ...item, totalValue: Number(e.target.value) })
                            }
                            className="mac-input w-full font-mono text-right font-bold text-slate-100 text-xs py-0.5 px-1.5"
                          />
                        </td>

                        {/* Status */}
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              isPaid
                                ? 'badge-emerald'
                                : 'badge-amber'
                            }`}
                          >
                            {isPaid ? 'PAGO' : 'PENDENTE'}
                          </span>
                        </td>

                        {/* Quitação Action Buttons */}
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => toggleRow(item.id)}
                              className={`p-1 rounded-lg transition-colors text-xs font-semibold flex items-center gap-0.5 ${
                                isExpanded ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.08]'
                              }`}
                              title="Expandir detalhes"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                            {!isPaid ? (
                              <button
                                onClick={() => onToggleStatus(item.id)}
                                className="mac-button-primary px-2.5 py-1 text-[10px] font-bold flex items-center gap-1"
                                title="Pagar / Receber esta venda"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Receber</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onToggleStatus(item.id)}
                                className="mac-button-secondary px-2 py-1 text-slate-300 hover:text-amber-300 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1"
                                title="Desfazer e voltar para pendente"
                              >
                                <RotateCcw className="w-3 h-3 text-slate-400" />
                                <span>Desfazer</span>
                              </button>
                            )}

                            <button
                              onClick={() => onDelete(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                              title="Excluir lançamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Details Sub-Row */}
                      {isExpanded && (
                        <tr className="bg-black/30">
                          <td colSpan={8} className="p-3 border-b border-white/[0.08]">
                            <div className="bg-[#1A1E27] p-4 rounded-xl border border-white/[0.08] space-y-3 shadow-inner">
                              <div className="flex items-center justify-between pb-2 border-b border-white/[0.07] text-xs">
                                <span className="font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                                  <Sliders className="w-4 h-4 text-blue-400" />
                                  Detalhes de Venda — {item.clientName || 'Cliente'}
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">Venda ID: {item.id}</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                {/* Unidade de Medida */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Unidade de Medida</label>
                                  <select
                                    value={item.unitOfMeasure || 'ton'}
                                    onChange={(e) => onUpdateRecord({ ...item, unitOfMeasure: e.target.value })}
                                    className="mac-input w-full font-semibold text-slate-100 py-1"
                                  >
                                    {UNIT_OF_MEASURE_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.value} ({opt.label})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Preço Unitário */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Preço Unitário (R$)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.unitPrice ?? 0}
                                    onChange={(e) => handlePriceChange(item, Number(e.target.value))}
                                    className="mac-input w-full font-mono font-bold text-amber-300 bg-amber-500/10 border-amber-500/20 py-1"
                                  />
                                </div>

                                {/* Status de Quitação */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Status de Quitação</label>
                                  <button
                                    onClick={() => onToggleStatus(item.id)}
                                    className={`w-full py-1 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 ${
                                      isPaid
                                        ? 'badge-emerald'
                                        : 'badge-amber'
                                    }`}
                                  >
                                    {isPaid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5 text-amber-400" />}
                                    <span>{isPaid ? 'QUITADO (PAGO)' : 'PENDENTE (A RECEBER)'}</span>
                                  </button>
                                </div>

                                {/* Observações */}
                                <div className="sm:col-span-3">
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Observações da Venda</label>
                                  <input
                                    type="text"
                                    value={item.notes || ''}
                                    onChange={(e) => onUpdateRecord({ ...item, notes: e.target.value })}
                                    placeholder="Observações adicionais..."
                                    className="mac-input w-full text-slate-200 py-1"
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
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
