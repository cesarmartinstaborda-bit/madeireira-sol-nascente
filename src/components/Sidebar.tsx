import React, { useRef } from 'react';
import { TableType } from '../types';
import {
  LayoutDashboard,
  Building2,
  Users,
  Truck,
  Settings,
} from 'lucide-react';
import defaultLogo from '@/assets/icon.png';

interface SidebarProps {
  activeTable: TableType;
  onSelectTable: (table: TableType) => void;
  counts: {
    Cargas: number;
    Depositos_Klabin: number;
    Motoristas: number;
    Resumo: number;
    Caixa: number;
    Clientes: number;
    Vendas: number;
    Produtos: number;
  };
  customLogo?: string;
  onUpdateCustomLogo: (logoBase64: string | undefined) => void;
  companyName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTable,
  onSelectTable,
  counts,
  customLogo,
  onUpdateCustomLogo,
  companyName = 'SOL NASCENTE',
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Exactly the 5 main modules
  const menuItems: {
    id: TableType;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    {
      id: 'Dashboard',
      label: 'Painel Consolidado',
      sublabel: 'Visão Geral & Indicadores',
      icon: LayoutDashboard,
    },
    {
      id: 'Klabin',
      label: 'Klabin',
      sublabel: 'Cargas & Depósitos',
      icon: Building2,
      count: counts.Cargas + counts.Depositos_Klabin,
    },
    {
      id: 'Clientes_Produtos',
      label: 'Clientes & Produtos',
      sublabel: 'Vendas & Catálogo',
      icon: Users,
      count: counts.Clientes + counts.Produtos,
    },
    {
      id: 'Motoristas',
      label: 'Gestão de Motoristas',
      sublabel: 'Fretes & Cadastro',
      icon: Truck,
      count: counts.Motoristas,
    },
    {
      id: 'Configuracoes',
      label: 'Configurações e Ajustes',
      sublabel: 'Backups & Sistema',
      icon: Settings,
    },
  ];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateCustomLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Determine active module including compatibility with sub-tab routes
  const isItemActive = (itemId: TableType) => {
    if (activeTable === itemId) return true;
    if (itemId === 'Klabin' && (activeTable === 'Cargas' || activeTable === 'Depositos_Klabin')) return true;
    if (itemId === 'Clientes_Produtos' && (activeTable === 'Gestao_Clientes' || activeTable === 'Vendas' || activeTable === 'Produtos')) return true;
    if (itemId === 'Dashboard' && (activeTable === 'Resumo' || activeTable === 'Caixa')) return true;
    return false;
  };

  return (
    <aside className="w-64 bg-[#14171d] text-slate-100 flex flex-col h-screen sticky top-0 border-r border-[var(--graphite-border-subtle)] select-none">
      {/* Brand & Logo Header */}
      <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center space-x-3">
        <div
          className="relative group cursor-pointer shrink-0"
          onClick={() => logoInputRef.current?.click()}
          title="Clique para alterar a logo"
        >
          {customLogo ? (
            <img
              src={customLogo}
              alt="Madeireira Sol Nascente"
              className="h-10 w-10 object-contain rounded-lg border border-[var(--graphite-border-base)] bg-[#1c2027]"
            />
          ) : (
            <img
              src={defaultLogo}
              alt="Madeireira Sol Nascente"
              className="h-10 w-10 object-contain rounded-lg border border-[var(--graphite-border-base)] bg-[#1c2027]"
            />
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center text-[10px] text-white font-medium">
            Logo
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-xs font-bold text-slate-100 tracking-tight leading-snug truncate uppercase">
            {companyName}
          </h1>
          <p className="text-[10px] text-slate-400 font-medium truncate">
            Sistema de Gestão
          </p>
        </div>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoUpload}
        />
      </div>

      {/* Navigation Links - 5 Main Modules Only */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="text-[10px] uppercase font-semibold tracking-wider text-[var(--graphite-text-tertiary)] px-2.5 py-1.5">
          Módulos Principais
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item.id);

          return (
            <button
              key={item.id}
              onClick={() => onSelectTable(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left group ${
                active
                  ? 'bg-[var(--graphite-accent-blue)] text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-[var(--graphite-surface-1)] hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <div className="truncate">
                  <div className="leading-snug truncate">{item.label}</div>
                  <div
                    className={`text-[10px] leading-tight truncate ${
                      active ? 'text-blue-100' : 'text-[var(--graphite-text-tertiary)]'
                    }`}
                  >
                    {item.sublabel}
                  </div>
                </div>
              </div>

              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 ml-1.5 ${
                    active
                      ? 'bg-blue-600/80 text-white'
                      : 'bg-[#1e2229] text-slate-400 border border-[var(--graphite-border-subtle)]'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
