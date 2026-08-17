import React, { useState } from 'react';
import { CargaRecord, MotoristaRecord, ProdutoRecord, UNIT_OF_MEASURE_OPTIONS } from '../types';
import { formatBRL, formatNumber } from '../utils/formatters';
import { Truck, Scale, DollarSign, CheckCircle2, Trash2, Edit3, Lock, ChevronRight, Clock, Sliders } from 'lucide-react';
import { Pagination } from './Pagination';

interface TableCargasProps {
  records: CargaRecord[];
  searchTerm: string;
  onEdit?: (record: CargaRecord) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onUpdateRecord: (record: CargaRecord) => void;
  produtos?: ProdutoRecord[];
  lockedMonths?: string[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
}

export const TableCargas: React.FC<TableCargasProps> = ({
  records,
  searchTerm,
  onEdit,
  onDelete,
  onAdd,
  onUpdateRecord,
  produtos = [],
  lockedMonths = [],
  motoristas = [],
  freightRatePerTon = 15,
}) => {
  const [deductFilter, setDeductFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
      r.invoiceNumber.toLowerCase().includes(term) ||
      r.supplier.toLowerCase().includes(term) ||
      (r.supplierCnpj && r.supplierCnpj.toLowerCase().includes(term)) ||
      r.product.toLowerCase().includes(term) ||
      (r.driverPlate && r.driverPlate.toLowerCase().includes(term)) ||
      (r.licensePlate && r.licensePlate.toLowerCase().includes(term)) ||
      (r.notes && r.notes.toLowerCase().includes(term));

    const matchesDeduct =
      deductFilter === 'ALL' ||
      (deductFilter === 'YES' && (r.deductFromBalance === true || r.deductFromBalance === 'YES')) ||
      (deductFilter === 'NO' && (r.deductFromBalance === false || r.deductFromBalance === 'NO'));
    const matchesProduct = productFilter === 'ALL' || r.product === productFilter;

    return matchesSearch && matchesDeduct && matchesProduct;
  });

  // Calculate summary stats
  const totalQty = filtered.reduce((acc, r) => acc + (Number(r.quantityTons) || 0), 0);
  const totalValue = filtered.reduce((acc, r) => acc + (Number(r.totalValue) || 0), 0);
  const totalFreightCost = filtered
    .filter((r) => r.freightPayable !== false && r.freightPayable !== 'NO')
    .reduce((acc, r) => acc + (r.freightCost !== undefined ? Number(r.freightCost) : (Number(r.quantityTons) || 0) * 15), 0);
  const totalDeducted = filtered
    .filter((r) => r.deductFromBalance === true || r.deductFromBalance === 'YES')
    .reduce((acc, r) => acc + (Number(r.totalValue) || 0), 0);

  // Sort descending by date
  const sortedFiltered = [...filtered].sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    return dateB.localeCompare(dateA);
  });

  const totalPages = Math.ceil(sortedFiltered.length / pageSize) || 1;
  const paginatedRecords = sortedFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Field change handlers for Data Grid inline editing
  const handleProductChange = (item: CargaRecord, newProduct: string) => {
    const foundProd = produtos.find((p) => p.name === newProduct);
    const referencePrice = foundProd ? Number(foundProd.referencePrice) : item.valuePerTon;
    const defaultUnit = foundProd ? (foundProd.unitOfMeasure || 'ton') : (item.unitOfMeasure || 'ton');
    const qty = Number(item.quantityTons) || 0;
    const newTotal = Number((qty * referencePrice).toFixed(2));
    onUpdateRecord({
      ...item,
      product: newProduct,
      unitOfMeasure: defaultUnit,
      valuePerTon: referencePrice,
      totalValue: newTotal,
    });
  };

  const handleQtyChange = (item: CargaRecord, newQty: number) => {
    const price = Number(item.valuePerTon) || 0;
    const newTotal = Number((newQty * price).toFixed(2));
    const isPayable = item.freightPayable !== false && item.freightPayable !== 'NO';
    const newFreight = isPayable ? Number((newQty * 15).toFixed(2)) : 0;
    onUpdateRecord({
      ...item,
      quantityTons: newQty,
      totalValue: newTotal,
      freightCost: newFreight,
    });
  };

  const handlePricePerTonChange = (item: CargaRecord, newPrice: number) => {
    const qty = Number(item.quantityTons) || 0;
    const newTotal = Number((qty * newPrice).toFixed(2));
    onUpdateRecord({
      ...item,
      valuePerTon: newPrice,
      totalValue: newTotal,
    });
  };

  const handleTotalValueChange = (item: CargaRecord, newTotal: number) => {
    const qty = Number(item.quantityTons) || 0;
    const newPrice = qty > 0 ? Number((newTotal / qty).toFixed(2)) : item.valuePerTon;
    onUpdateRecord({
      ...item,
      totalValue: newTotal,
      valuePerTon: newPrice,
    });
  };

  const handleFreightPayableChange = (item: CargaRecord, isPayable: boolean) => {
    const qty = Number(item.quantityTons) || 0;
    const newFreight = isPayable ? Number((qty * 15).toFixed(2)) : 0;
    onUpdateRecord({
      ...item,
      freightPayable: isPayable,
      freightCost: newFreight,
    });
  };

  const handleFreightCostChange = (item: CargaRecord, newFreight: number) => {
    onUpdateRecord({
      ...item,
      freightCost: newFreight,
    });
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Volume Total</p>
            <p className="text-xl font-bold text-slate-100 mt-1 font-mono">{formatNumber(totalQty)} t</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{filtered.length} cargas registradas</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Scale className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Valor Total Cargas</p>
            <p className="text-xl font-bold text-slate-100 mt-1 font-mono">{formatBRL(totalValue)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Preço médio por tonelada</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Fretes (R$ 15,00/ton)</p>
            <p className="text-xl font-bold text-amber-300 mt-1 font-mono">{formatBRL(totalFreightCost)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Passivo operacional de fretes</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Truck className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Abatido do Saldo</p>
            <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">{formatBRL(totalDeducted)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Cargas com "SIM" para abatimento</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* Action and Filters Bar */}
      <div className="glass-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onAdd}
            className="mac-button-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <span>+ Nova Carga</span>
          </button>

          {/* Deduct Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="font-semibold text-slate-400 text-[11px]">Abater do Saldo:</span>
            <div className="mac-segmented-control">
              <button
                onClick={() => setDeductFilter('ALL')}
                className={`mac-segmented-item ${deductFilter === 'ALL' ? 'mac-segmented-item-active' : ''}`}
              >
                Todos
              </button>
              <button
                onClick={() => setDeductFilter('YES')}
                className={`mac-segmented-item ${deductFilter === 'YES' ? 'mac-segmented-item-active' : ''}`}
              >
                SIM
              </button>
              <button
                onClick={() => setDeductFilter('NO')}
                className={`mac-segmented-item ${deductFilter === 'NO' ? 'mac-segmented-item-active' : ''}`}
              >
                NÃO
              </button>
            </div>
          </div>

          {/* Product Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="font-semibold text-slate-400 text-[11px]">Produto:</span>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="mac-input py-1 px-2.5 text-xs font-medium text-slate-200"
            >
              <option value="ALL">Todos os Produtos ({records.length})</option>
              {productOptions.map((prod) => (
                <option key={prod} value={prod}>
                  {prod}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Exibindo <span className="text-slate-100 font-bold">{filtered.length}</span> de{' '}
          <span className="font-semibold text-slate-300">{records.length}</span> registros
        </div>
      </div>

      {/* Data Grid Table View */}
      <div className="mac-table-container">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">Nenhuma carga encontrada</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Tente redefinir seus filtros de pesquisa ou adicione uma nova carga no botão acima.
            </p>
            <button
              onClick={onAdd}
              className="mt-4 mac-button-primary px-4 py-2 text-xs font-semibold"
            >
              Adicionar Primeira Carga
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-2 w-8 text-center"></th>
                  <th className="py-2.5 px-3 w-32">Data Compra</th>
                  <th className="py-2.5 px-3 w-28">Nº NF</th>
                  <th className="py-2.5 px-3 w-36">Produto</th>
                  <th className="py-2.5 px-3 text-right w-28">Quantidade</th>
                  <th className="py-2.5 px-3 text-right w-36">Valor Total (R$)</th>
                  <th className="py-2.5 px-3 w-40">Motorista</th>
                  <th className="py-2.5 px-3 text-center w-48">Status do Frete</th>
                  <th className="py-2.5 px-3 text-center w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedRecords.map((item) => {
                  const isPayable = item.freightPayable !== 'NO' && (item.freightPayable as any) !== false;
                  const calcFreight = item.freightCost !== undefined ? item.freightCost : (isPayable ? (Number(item.quantityTons) || 0) * freightRatePerTon : 0);
                  const isPaid = item.freightStatus === 'PAID';
                  const monthKey = item.date ? item.date.slice(0, 7) : '';
                  const isLocked = lockedMonths.includes(monthKey);
                  const isExpanded = !!expandedRows[item.id];

                  // Driver lookup
                  const driverIdToFind = item.motoristaId || item.driverId;
                  const matchedDriver = motoristas.find(
                    (m) =>
                      m.id === driverIdToFind ||
                      m.licensePlate === item.licensePlate ||
                      m.name === item.driverPlate
                  );

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`mac-table-row ${isLocked ? 'bg-amber-500/[0.04]' : ''} ${isExpanded ? 'bg-white/[0.04]' : ''}`}>
                        {/* Expand Toggle */}
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => toggleRow(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors"
                            title={isExpanded ? 'Ocultar detalhes' : 'Ver e editar detalhes'}
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90 text-blue-400' : ''}`} />
                          </button>
                        </td>

                        {/* Date */}
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            {isLocked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Mês Trancado (Fechamento de Ciclo)" />}
                            <input
                              type="date"
                              disabled={isLocked}
                              value={item.date || ''}
                              onChange={(e) => onUpdateRecord({ ...item, date: e.target.value })}
                              className={`w-full mac-input py-0.5 px-1.5 font-mono text-xs text-slate-200 ${
                                isLocked ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 cursor-not-allowed font-bold' : ''
                              }`}
                            />
                          </div>
                        </td>

                        {/* Invoice Number */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={item.invoiceNumber || ''}
                            onChange={(e) => onUpdateRecord({ ...item, invoiceNumber: e.target.value })}
                            placeholder="NF nº"
                            className="w-full mac-input py-0.5 px-1.5 font-mono text-slate-100 text-xs font-semibold"
                          />
                        </td>

                        {/* Product Select */}
                        <td className="py-2 px-2">
                          <select
                            disabled={isLocked}
                            value={item.product || 'Eucalipto'}
                            onChange={(e) => handleProductChange(item, e.target.value)}
                            className="w-full mac-input py-0.5 px-1.5 text-slate-100 text-xs font-medium"
                          >
                            {productOptions.map((prod) => (
                              <option key={prod} value={prod}>
                                {prod}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            disabled={isLocked}
                            value={item.quantityTons ?? 0}
                            onChange={(e) => handleQtyChange(item, Number(e.target.value))}
                            className="w-full mac-input py-0.5 px-1.5 font-mono text-right font-semibold text-slate-200 text-xs"
                          />
                        </td>

                        {/* Total Value */}
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={item.totalValue ?? 0}
                            onChange={(e) => handleTotalValueChange(item, Number(e.target.value))}
                            className="w-full mac-input py-0.5 px-1.5 font-mono text-right font-semibold text-slate-100 text-xs"
                          />
                        </td>

                        {/* Motorista Display */}
                        <td className="py-2 px-2">
                          <div className="truncate font-semibold text-slate-200 text-xs" title={matchedDriver ? `${matchedDriver.name} (${matchedDriver.licensePlate})` : 'Frete por conta do fornecedor'}>
                            {matchedDriver ? (
                              <span className="flex items-center gap-1 text-slate-200 font-semibold">
                                <Truck className="w-3 h-3 text-blue-400 shrink-0" />
                                <span className="truncate">{matchedDriver.name}</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 font-normal italic">Fornecedor</span>
                            )}
                          </div>
                        </td>

                        {/* Unified Freight Status Badge */}
                        <td className="py-2 px-2 text-center">
                          {!isPayable ? (
                            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded badge-neutral">
                              Sem Frete
                            </span>
                          ) : isPaid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md badge-emerald">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{formatBRL(calcFreight)} (PAGO)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md badge-amber">
                              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>{formatBRL(calcFreight)} (PENDENTE)</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
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
                            {isLocked ? (
                              <span className="p-1 text-amber-400 bg-amber-500/20 rounded-lg" title="Lançamento em mês trancado (Fechamento de Ciclo)">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <>
                                {onEdit && (
                                  <button
                                    onClick={() => onEdit(item)}
                                    className="p-1 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] rounded-lg transition-colors"
                                    title="Abrir formulário modal"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => onDelete(item.id)}
                                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                                  title="Excluir carga"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Details Sub-Row */}
                      {isExpanded && (
                        <tr className="bg-black/30">
                          <td colSpan={9} className="p-3 border-b border-white/[0.08]">
                            <div className="bg-[#1A1E27] p-4 rounded-xl border border-white/[0.08] space-y-3 shadow-inner">
                              <div className="flex items-center justify-between pb-2 border-b border-white/[0.07] text-xs">
                                <span className="font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                                  <Sliders className="w-4 h-4 text-blue-400" />
                                  Detalhes & Configurações de Cargas — NF {item.invoiceNumber || 'S/N'}
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">Carga ID: {item.id}</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                {/* Unidade de Medida */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Unidade de Medida</label>
                                  <select
                                    value={item.unitOfMeasure || 'ton'}
                                    onChange={(e) => onUpdateRecord({ ...item, unitOfMeasure: e.target.value })}
                                    className="w-full mac-input font-semibold text-slate-100 py-1"
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
                                    disabled={isLocked}
                                    value={item.valuePerTon ?? 0}
                                    onChange={(e) => handlePricePerTonChange(item, Number(e.target.value))}
                                    className="w-full mac-input font-mono font-bold text-amber-300 bg-amber-500/10 border-amber-500/20 py-1"
                                  />
                                </div>

                                {/* Cobrar Frete? + Valor */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Cobrar Frete Motorista?</label>
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      disabled={isLocked}
                                      value={isPayable ? 'YES' : 'NO'}
                                      onChange={(e) => handleFreightPayableChange(item, e.target.value === 'YES')}
                                      className="mac-input font-bold text-slate-100 py-1"
                                    >
                                      <option value="YES">SIM</option>
                                      <option value="NO">NÃO</option>
                                    </select>
                                    <input
                                      type="number"
                                      step="0.01"
                                      disabled={!isPayable || isLocked}
                                      value={calcFreight}
                                      onChange={(e) => handleFreightCostChange(item, Number(e.target.value))}
                                      className="w-full mac-input font-mono font-bold text-slate-100 py-1"
                                      placeholder="R$ Frete"
                                    />
                                  </div>
                                </div>

                                {/* Status do Pagamento do Frete */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Status Quitação Frete</label>
                                  <select
                                    disabled={!isPayable || isLocked}
                                    value={item.freightStatus || 'PENDING'}
                                    onChange={(e) => onUpdateRecord({ ...item, freightStatus: e.target.value as 'PENDING' | 'PAID' })}
                                    className={`w-full mac-input font-bold py-1 ${
                                      item.freightStatus === 'PAID'
                                        ? 'badge-emerald'
                                        : 'badge-amber'
                                    }`}
                                  >
                                    <option value="PENDING">PENDENTE</option>
                                    <option value="PAID">PAGO (Quitado)</option>
                                  </select>
                                </div>

                                {/* Abater Saldo Klabin */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Abater do Saldo Klabin?</label>
                                  <select
                                    disabled={isLocked}
                                    value={item.deductFromBalance === true || item.deductFromBalance === 'YES' ? 'YES' : 'NO'}
                                    onChange={(e) => onUpdateRecord({ ...item, deductFromBalance: e.target.value === 'YES' })}
                                    className={`w-full mac-input font-bold py-1 ${
                                      item.deductFromBalance === true || item.deductFromBalance === 'YES'
                                        ? 'badge-emerald'
                                        : 'badge-neutral'
                                    }`}
                                  >
                                    <option value="YES">SIM (Abater do Saldo)</option>
                                    <option value="NO">NÃO (Não Abater)</option>
                                  </select>
                                </div>

                                {/* Selecionar Motorista */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Motorista Atribuído</label>
                                  <select
                                    disabled={isLocked}
                                    value={
                                      item.motoristaId ||
                                      item.driverId ||
                                      (item.driverPlate || item.licensePlate
                                        ? motoristas.find(
                                            (m) =>
                                              m.id === item.driverPlate ||
                                              `${m.name} / ${m.licensePlate}` === item.driverPlate ||
                                              m.licensePlate === item.licensePlate ||
                                              m.name === item.driverPlate
                                          )?.id || 'NONE'
                                        : 'NONE')
                                    }
                                    onChange={(e) => {
                                      const selId = e.target.value;
                                      if (!selId || selId === 'NONE' || selId === 'nenhum') {
                                        const updatedItem = { ...item };
                                        updatedItem.motoristaId = undefined;
                                        updatedItem.driverId = undefined;
                                        updatedItem.freightPayable = false;
                                        updatedItem.freightCost = 0;
                                        delete updatedItem.driverPlate;
                                        delete updatedItem.licensePlate;
                                        onUpdateRecord(updatedItem);
                                      } else {
                                        const matched = motoristas.find((m) => m.id === selId);
                                        if (matched) {
                                          const qty = Number(item.quantityTons) || 0;
                                          const calculatedFreight = Number((qty * freightRatePerTon).toFixed(2));
                                          const updatedItem = { ...item };
                                          updatedItem.motoristaId = matched.id;
                                          updatedItem.driverId = matched.id;
                                          updatedItem.freightPayable = true;
                                          updatedItem.freightCost = calculatedFreight;
                                          updatedItem.freightStatus = item.freightStatus || 'PENDING';
                                          delete updatedItem.driverPlate;
                                          delete updatedItem.licensePlate;
                                          onUpdateRecord(updatedItem);
                                        }
                                      }
                                    }}
                                    className="w-full mac-input font-medium text-slate-100 py-1"
                                  >
                                    <option value="NONE">Nenhum (Fornecedor)</option>
                                    {motoristas
                                      .filter((m) => m.status === 'ACTIVE')
                                      .map((m) => (
                                        <option key={m.id} value={m.id}>
                                          {m.name} — {m.licensePlate}
                                        </option>
                                      ))}
                                  </select>
                                </div>

                                {/* Observações */}
                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Observações da Carga</label>
                                  <input
                                    type="text"
                                    disabled={isLocked}
                                    value={item.notes || ''}
                                    onChange={(e) => onUpdateRecord({ ...item, notes: e.target.value })}
                                    placeholder="Observações do lançamento..."
                                    className="w-full mac-input text-slate-200 py-1"
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

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={sortedFiltered.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};
