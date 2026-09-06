import { DollarSign, ShoppingBag, UserCheck } from 'lucide-react';
import React from 'react';
import { formatCurrency } from '../utils/formatters';
import { ClientModal } from './sales/ClientModal';
import { ClientsPanel } from './sales/ClientsPanel';
import { RevertSaleModal } from './sales/RevertSaleModal';
import { SaleModal } from './sales/SaleModal';
import { SalesPanel } from './sales/SalesPanel';
import { useSalesController, type GestaoClientesDashboardProps } from './sales/useSalesController';

export const GestaoClientesDashboard: React.FC<GestaoClientesDashboardProps> = (props) => {
  const model = useSalesController(props);
  const {
    totalVendaSum,
    totalPaidVendas,
    totalPendingVendas,
    setActiveSubTab,
    activeSubTab,
    vendas,
    clientes,
  } = model;
  return (<div className="space-y-4">
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
      <SalesPanel model={model} />

      {/* SUBTAB: CLIENTS */}
      <ClientsPanel model={model} />

      {/* Confirmation Modal for Reverting Sale to Pending */}
      <RevertSaleModal model={model} />

      {/* Client Modal */}
      <ClientModal model={model} />

      {/* Venda Modal */}
      <SaleModal model={model} />
    </div>);
};
