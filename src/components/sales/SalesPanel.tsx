import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, ChevronsUpDown, Edit2, FileText, Lock, Phone, Plus, RotateCcw, Search, Trash2, Users } from 'lucide-react';
import { formatCurrency, formatDateBR, formatNumber } from '../../utils/formatters';
import { generateClientPendingPdf } from '../../utils/pdfGenerator';
import type { useSalesController } from './useSalesController';

type Props = {
  model: Pick<ReturnType<typeof useSalesController>,
    'vendas'
    | 'appSettings'
    | 'customLogo'
    | 'activeSubTab'
    | 'setVendaStatusFilter'
    | 'vendaStatusFilter'
    | 'pendingVendasAll'
    | 'paidVendasAll'
    | 'vendaSearchTerm'
    | 'setVendaSearchTerm'
    | 'openVendaModal'
    | 'groupedClientVendas'
    | 'collapsedGroups'
    | 'setCollapsedGroups'
    | 'pdfNotification'
    | 'setPdfNotification'
    | 'toggleGroupCollapse'
    | 'isLocked'
    | 'handleMarkAsPaid'
    | 'setVendaToRevert'
    | 'onDeleteVenda'
  >;
};

export function SalesPanel({ model }: Props) {
  const {
    vendas,
    appSettings,
    customLogo,
    activeSubTab,
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
  } = model;
  return <>{activeSubTab === 'SALES' && (
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
                                        {locked && <Lock className="w-3 h-3 text-amber-400" />}
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
      )}</>;
}
