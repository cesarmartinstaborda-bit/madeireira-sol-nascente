import React, { useState } from 'react';
import { CargaRecord, MotoristaRecord, VendaRecord } from '../types';
import { formatBRL, formatDate, formatNumber } from '../utils/formatters';
import { Pagination } from './Pagination';
import { DriverPdfPreviewModal } from './DriverPdfPreviewModal';
import { TableCadastroMotoristas } from './TableCadastroMotoristas';
import {
  Truck,
  Plus,
  Tag,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  DollarSign,
  Filter,
  Clock,
  History,
  CheckCircle,
  RotateCcw,
  FileText,
  UserCheck,
} from 'lucide-react';

interface TableMotoristasProps {
  cargas: CargaRecord[];
  vendas?: VendaRecord[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
  searchTerm: string;
  onEdit: (record: CargaRecord) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onPayFreight: (driverKey: string, transactionKey?: string) => void;
  onRevertFreight: (driverKey: string) => void;
  onToggleSingleFreight: (cargaId: string, transactionKey?: string) => void;
  onAddMotorista?: (m: MotoristaRecord) => void;
  onUpdateMotorista?: (m: MotoristaRecord) => void;
  onDeleteMotorista?: (id: string) => void;
}

export const TableMotoristas: React.FC<TableMotoristasProps> = ({
  cargas,
  vendas = [],
  motoristas = [],
  freightRatePerTon = 15,
  searchTerm,
  onEdit,
  onDelete,
  onAdd,
  onPayFreight,
  onRevertFreight,
  onToggleSingleFreight,
  onAddMotorista,
  onUpdateMotorista,
  onDeleteMotorista,
}) => {
  const [activeTab, setActiveTab] = useState<'FRETES' | 'CADASTRO'>('FRETES');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'PAID' | 'ALL'>('PENDING');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [driverPdfModal, setDriverPdfModal] = useState<{
    isOpen: boolean;
    driverPlate: string;
    cargas: CargaRecord[];
  }>({
    isOpen: false,
    driverPlate: '',
    cargas: [],
  });

  // Convert Sales (Vendas) with assigned driver to CargaRecord representation for driver ledger
  const vendasAsCargas: CargaRecord[] = (vendas || [])
    .filter((v) => v.driverId || (v.driverPlate && v.driverPlate.trim()))
    .map((v) => ({
      id: v.id,
      date: v.date,
      invoiceNumber: v.transactionKey ? `TK-${v.id.slice(-6).toUpperCase()}` : (v.id ? `TK-${v.id.slice(-6).toUpperCase()}` : 'VENDA'),
      supplier: `[Venda] Cliente: ${v.clientName}`,
      supplierCnpj: '-',
      product: v.product,
      quantityTons: Number(v.quantity) || 0,
      valuePerTon: Number(v.unitPrice) || 0,
      totalValue: Number(v.totalValue) || 0,
      driverPlate: v.driverPlate || '',
      licensePlate: v.licensePlate || '',
      deductFromBalance: false,
      freightPayable: v.freightPayable === undefined ? true : (v.freightPayable === true || v.freightPayable === 'YES' || (v.freightPayable as any) !== 'NO'),
      freightCost: v.freightCost !== undefined ? Number(v.freightCost) : (Number(v.quantity) || 0) * freightRatePerTon,
      freightStatus: v.freightStatus || 'PENDING',
      freightPaidAt: v.freightPaidAt,
      notes: v.notes ? `[Venda] ${v.notes}` : '[Venda]',
      driverId: v.driverId,
    }));

  const combinedRecords = [...cargas, ...vendasAsCargas];

  // Filter charges by search term
  const term = searchTerm.toLowerCase();
  const filteredCargas = combinedRecords.filter((r) => {
    if (!term) return true;
    const driver = (r.driverPlate || r.licensePlate || '').toLowerCase();
    const invoice = (r.invoiceNumber || '').toLowerCase();
    const supplier = (r.supplier || '').toLowerCase();
    const product = (r.product || '').toLowerCase();
    return driver.includes(term) || invoice.includes(term) || supplier.includes(term) || product.includes(term);
  });

  // Maps for relational matching
  const motoristaById = new Map<string, MotoristaRecord>();
  motoristas.forEach((m) => {
    if (m.id) motoristaById.set(m.id, m);
  });

  const motoristaByPlateOrName = new Map<string, MotoristaRecord>();
  motoristas.forEach((m) => {
    if (m.licensePlate) motoristaByPlateOrName.set(m.licensePlate.trim().toLowerCase(), m);
    if (m.name) motoristaByPlateOrName.set(m.name.trim().toLowerCase(), m);
  });

  // Pre-seed groupsMap with all active registered motoristas
  const groupsMap = new Map<string, CargaRecord[]>();
  motoristas.filter((m) => m.status === 'ACTIVE').forEach((m) => {
    const key = `${m.name} / ${m.licensePlate}`;
    groupsMap.set(key, []);
  });

  // Distribute cargas into groups by relational ID or matching text
  filteredCargas.forEach((item) => {
    let matchedDriver: MotoristaRecord | undefined;

    const dId = item.driverId || item.motoristaId;
    if (dId && motoristaById.has(dId)) {
      matchedDriver = motoristaById.get(dId);
    }

    if (!matchedDriver) {
      const p1 = (item.licensePlate || '').trim().toLowerCase();
      const p2 = (item.driverPlate || '').trim().toLowerCase();
      if (p1 && motoristaByPlateOrName.has(p1)) {
        matchedDriver = motoristaByPlateOrName.get(p1);
      } else if (p2 && motoristaByPlateOrName.has(p2)) {
        matchedDriver = motoristaByPlateOrName.get(p2);
      }
    }

    const groupKey = matchedDriver
      ? `${matchedDriver.name} / ${matchedDriver.licensePlate}`
      : (item.driverPlate || item.licensePlate || 'Fornecedor / Frete Pago').trim();

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, []);
    }
    groupsMap.get(groupKey)!.push(item);
  });

  // Build driver group summaries
  const allDriverGroups = Array.from(groupsMap.entries()).map(([driverPlate, groupRecords]) => {
    const sortedRecords = [...groupRecords].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const totalTons = sortedRecords.reduce((acc, r) => acc + (Number(r.quantityTons) || 0), 0);

    let pendingFreightPayable = 0;
    let paidFreightPayable = 0;
    let pendingCount = 0;
    let paidCount = 0;

    sortedRecords.forEach((r) => {
      const isPayable = r.freightPayable !== false && (r.freightPayable as any) !== 'NO';
      if (isPayable) {
        const cost = (r.freightCost !== undefined && r.freightCost !== null)
          ? Number(r.freightCost)
          : (Number(r.quantityTons) || 0) * freightRatePerTon;
        if (r.freightStatus === 'PAID') {
          paidFreightPayable += cost;
          paidCount += 1;
        } else {
          pendingFreightPayable += cost;
          pendingCount += 1;
        }
      }
    });

    const totalFreightPayable = pendingFreightPayable + paidFreightPayable;
    const isFullyPaid = pendingCount === 0 && totalFreightPayable > 0;

    return {
      driverPlate,
      records: sortedRecords,
      totalTons,
      pendingFreightPayable,
      paidFreightPayable,
      totalFreightPayable,
      totalCargasCount: sortedRecords.length,
      pendingCount,
      paidCount,
      isFullyPaid,
    };
  });

  // Filter groups based on statusFilter tab
  const displayedDriverGroups = allDriverGroups.filter((g) => {
    if (statusFilter === 'PENDING') return g.pendingFreightPayable > 0 || (g.totalFreightPayable === 0);
    if (statusFilter === 'PAID') return g.isFullyPaid || (g.paidFreightPayable > 0 && g.pendingFreightPayable === 0);
    return true;
  });

  displayedDriverGroups.sort((a, b) => b.pendingFreightPayable - a.pendingFreightPayable);

  const totalPages = Math.ceil(displayedDriverGroups.length / pageSize) || 1;
  const paginatedDriverGroups = displayedDriverGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const pendingGroupsCount = allDriverGroups.filter((g) => g.pendingFreightPayable > 0).length;
  const paidGroupsCount = allDriverGroups.filter((g) => g.isFullyPaid).length;

  const toggleExpand = (driverKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [driverKey]: prev[driverKey] === undefined ? true : !prev[driverKey],
    }));
  };

  const isExpanded = (driverKey: string) => {
    return expandedGroups[driverKey] ?? true;
  };

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Bar */}
      <div className="mac-segmented-control">
        <button
          onClick={() => setActiveTab('FRETES')}
          className={`mac-segmented-item flex items-center gap-2 ${
            activeTab === 'FRETES' ? 'mac-segmented-item-active' : ''
          }`}
        >
          <Truck className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Visão & Quitação de Fretes</span>
        </button>

        <button
          onClick={() => setActiveTab('CADASTRO')}
          className={`mac-segmented-item flex items-center gap-2 ${
            activeTab === 'CADASTRO' ? 'mac-segmented-item-active' : ''
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Cadastro de Motoristas ({motoristas.length})</span>
        </button>
      </div>

      {activeTab === 'CADASTRO' ? (
        <TableCadastroMotoristas
          motoristas={motoristas}
          onAddMotorista={onAddMotorista || (() => {})}
          onUpdateMotorista={onUpdateMotorista || (() => {})}
          onDeleteMotorista={onDeleteMotorista || (() => {})}
        />
      ) : (
        <>
          {/* Top Action Header */}
          <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                <Truck className="w-4.5 h-4.5" />
              </span>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-slate-100">Gestão de Motoristas & Fretes</h2>
              </div>
            </div>

            <button
              onClick={onAdd}
              className="mac-button-primary text-xs py-1.5 px-3 flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Carga / Motorista</span>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="glass-card p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-400 text-[11px]">Filtrar:</span>
              <div className="mac-segmented-control">
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className={`mac-segmented-item flex items-center gap-1.5 ${
                    statusFilter === 'PENDING' ? 'mac-segmented-item-active' : ''
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Pendentes ({pendingGroupsCount})</span>
                </button>

                <button
                  onClick={() => setStatusFilter('PAID')}
                  className={`mac-segmented-item flex items-center gap-1.5 ${
                    statusFilter === 'PAID' ? 'mac-segmented-item-active' : ''
                  }`}
                >
                  <History className="w-3 h-3" />
                  <span>Quitados ({paidGroupsCount})</span>
                </button>

                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`mac-segmented-item ${statusFilter === 'ALL' ? 'mac-segmented-item-active' : ''}`}
                >
                  <span>Todos ({allDriverGroups.length})</span>
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Exibindo <span className="text-slate-100 font-bold font-mono">{displayedDriverGroups.length}</span> grupos de motoristas
            </div>
          </div>

          {/* Driver Groups List */}
          {displayedDriverGroups.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Truck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-200">Nenhum motorista nesta visualização</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {statusFilter === 'PENDING'
                  ? 'Não existem fretes pendentes de pagamento.'
                  : 'Nenhum registro encontrado para o filtro selecionado.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedDriverGroups.map((group) => {
                const expanded = isExpanded(group.driverPlate);
                const hasPending = group.pendingFreightPayable > 0;

                return (
                  <div
                    key={group.driverPlate}
                    className="glass-card overflow-hidden transition-all"
                  >
                    {/* Group Card Header */}
                    <div
                      className="p-3.5 bg-white/[0.02] hover:bg-white/[0.05] flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] transition-colors select-none"
                    >
                      <div
                        onClick={() => toggleExpand(group.driverPlate)}
                        className="flex items-center space-x-3 cursor-pointer flex-1"
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border bg-white/[0.04] text-slate-300 border-white/[0.08]"
                        >
                          <Truck className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h3 className="font-bold text-slate-100 text-sm">{group.driverPlate}</h3>
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/[0.04] text-slate-300 rounded-full border border-white/[0.08]">
                              {group.totalCargasCount} {group.totalCargasCount === 1 ? 'carga' : 'cargas'}
                            </span>
                            {hasPending ? (
                              <span className="px-2 py-0.5 text-[10px] font-semibold badge-amber rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-400" /> Pendente
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-semibold badge-emerald rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-emerald-400" /> Quitado
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Volume: <span className="font-semibold text-slate-200">{formatNumber(group.totalTons)} t</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-5">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            TOTAL A PAGAR
                          </p>
                          <p className={`text-base font-extrabold font-mono ${hasPending ? 'text-amber-300' : 'text-emerald-400'}`}>
                            {formatBRL(hasPending ? group.pendingFreightPayable : group.totalFreightPayable)}
                          </p>
                        </div>

                        {/* Pay & Revert Freight & PDF Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDriverPdfModal({
                                isOpen: true,
                                driverPlate: group.driverPlate,
                                cargas: group.records,
                              });
                            }}
                            className="mac-button-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs"
                            title="Gerar PDF Relatório de Fretes A4"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>PDF</span>
                          </button>

                          {hasPending && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPayFreight(group.driverPlate);
                              }}
                              className="mac-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                              title="Quitar todos os fretes pendentes deste motorista"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Pagar Frete</span>
                            </button>
                          )}

                          {group.paidFreightPayable > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRevertFreight(group.driverPlate);
                              }}
                              className="mac-button-secondary text-amber-400 border-amber-500/30 hover:bg-amber-500/10 flex items-center gap-1.5 px-3 py-1.5 text-xs"
                              title="Desfazer e reverter fretes quitados para Pendente"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                              <span>Reverter</span>
                            </button>
                          )}

                          {!hasPending && group.paidFreightPayable === 0 && (
                            <span className="px-2.5 py-1 bg-white/[0.04] text-slate-400 border border-white/[0.08] text-xs font-medium rounded-lg">
                              Isento
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(group.driverPlate)}
                          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] rounded-lg transition-colors"
                          title={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                        >
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Group Table Details */}
                    {expanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="mac-table-header">
                              <th className="py-2.5 px-3">Data Compra</th>
                              <th className="py-2.5 px-3">Nº NF</th>
                              <th className="py-2.5 px-3">Fornecedor</th>
                              <th className="py-2.5 px-3">Produto</th>
                              <th className="py-2.5 px-3 text-right">Qtd (Ton)</th>
                              <th className="py-2.5 px-3 text-center">Frete A Pagar?</th>
                              <th className="py-2.5 px-3 text-right">Custo Frete (R$)</th>
                              <th className="py-2.5 px-3 text-center">Status Frete</th>
                              <th className="py-2.5 px-3 text-center w-28">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {group.records.map((item) => {
                              const isPayable = item.freightPayable !== 'NO';
                              const calcCost = item.freightCost !== undefined ? item.freightCost : (isPayable ? (Number(item.quantityTons) || 0) * 15 : 0);
                              const isPaid = item.freightStatus === 'PAID';

                              return (
                                <tr key={item.id} className="mac-table-row">
                                  <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                                    {formatDate(item.date)}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-200 whitespace-nowrap">
                                    {item.invoiceNumber || '-'}
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-slate-300 truncate max-w-[140px]">
                                    {item.supplier || '-'}
                                  </td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.04] text-slate-300 border border-white/[0.08]">
                                      <Tag className="w-3 h-3 text-blue-400" />
                                      {item.product}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-200 whitespace-nowrap">
                                    {formatNumber(item.quantityTons)} t
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    {isPayable ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold badge-emerald">
                                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> SIM
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold badge-neutral">
                                        <AlertCircle className="w-3 h-3 text-slate-400" /> NÃO
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                                    {isPayable ? (
                                      <span className={isPaid ? 'text-emerald-400' : 'text-amber-300'}>
                                        {formatBRL(calcCost)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 font-sans font-normal">Isento</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    {isPayable ? (
                                      isPaid ? (
                                        <div className="flex flex-col items-center">
                                          <button
                                            onClick={() => onToggleSingleFreight(item.id)}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold badge-emerald hover:opacity-80 transition-opacity"
                                            title="Clique para reverter pagamento para PENDENTE"
                                          >
                                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> QUITADO
                                          </button>
                                          {item.transactionKey && (
                                            <span className="text-[9px] font-mono text-emerald-400 font-bold mt-0.5" title="Comprovante">
                                              🔑 {item.transactionKey}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => onToggleSingleFreight(item.id)}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold badge-amber hover:opacity-80 transition-opacity"
                                          title="Clique para quitar este frete"
                                        >
                                          <Clock className="w-3 h-3 text-amber-400" /> PENDENTE
                                        </button>
                                      )
                                    ) : (
                                      <span className="text-slate-500 font-sans text-[10px]">-</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center space-x-1">
                                      {isPayable && (
                                        <button
                                          onClick={() => onToggleSingleFreight(item.id)}
                                          className={`p-1.5 rounded-lg transition-colors ${
                                            isPaid
                                              ? 'text-slate-400 hover:text-amber-300 hover:bg-white/[0.08]'
                                              : 'text-amber-400 hover:text-emerald-300 hover:bg-white/[0.08]'
                                          }`}
                                          title={isPaid ? 'Reverter para Pendente' : 'Marcar frete como quitado'}
                                        >
                                          {isPaid ? <RotateCcw className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                                        </button>
                                      )}
                                      <button
                                        onClick={() => onEdit(item)}
                                        className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] rounded-lg transition-colors"
                                        title="Editar esta carga"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => onDelete(item.id)}
                                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                                        title="Excluir carga"
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

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={displayedDriverGroups.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </>
      )}

      {/* Driver PDF Preview Modal */}
      <DriverPdfPreviewModal
        isOpen={driverPdfModal.isOpen}
        onClose={() => setDriverPdfModal((prev) => ({ ...prev, isOpen: false }))}
        driverPlate={driverPdfModal.driverPlate}
        cargas={driverPdfModal.cargas}
      />
    </div>
  );
};
