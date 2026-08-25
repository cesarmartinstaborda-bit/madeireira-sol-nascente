import React, { useState } from 'react';
import { ClientRecord, VendaRecord, ProdutoRecord, MotoristaRecord, AppSettings } from '../types';
import { GestaoClientesDashboard } from './GestaoClientesDashboard';
import { TableProdutos } from './TableProdutos';
import { Users, Package } from 'lucide-react';

interface ClientesProdutosDashboardProps {
  clientes: ClientRecord[];
  vendas: VendaRecord[];
  produtos: ProdutoRecord[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
  defaultSaleFreightPayable?: boolean;
  searchTerm: string;
  onAddClient: (client: Partial<ClientRecord>) => void;
  onUpdateClient: (client: ClientRecord) => void;
  onDeleteClient: (id: string) => void;
  onAddVenda: (venda: Partial<VendaRecord>) => void;
  onUpdateVenda: (venda: VendaRecord) => void;
  onDeleteVenda: (id: string) => void;
  onToggleVendaStatus: (id: string) => void;
  onAddProduto: (prod: Partial<ProdutoRecord>) => void;
  onUpdateProduto: (prod: ProdutoRecord) => void;
  onDeleteProduto: (id: string) => void;
  lockedMonths?: string[];
  initialSubTab?: 'CLIENTES_VENDAS' | 'PRODUTOS';
  appSettings?: AppSettings;
  customLogo?: string;
}

export const ClientesProdutosDashboard: React.FC<ClientesProdutosDashboardProps> = ({
  clientes,
  vendas,
  produtos,
  motoristas = [],
  freightRatePerTon = 15,
  defaultSaleFreightPayable = false,
  searchTerm,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onAddVenda,
  onUpdateVenda,
  onDeleteVenda,
  onToggleVendaStatus,
  onAddProduto,
  onUpdateProduto,
  onDeleteProduto,
  lockedMonths = [],
  initialSubTab = 'CLIENTES_VENDAS',
  appSettings,
  customLogo,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'CLIENTES_VENDAS' | 'PRODUTOS'>(initialSubTab);

  return (
    <div className="space-y-6">
      {/* Graphite Pro macOS Segmented Control */}
      <div className="flex items-center justify-between border-b border-[var(--graphite-border-subtle)] pb-4">
        <div className="mac-segmented-control">
          <button
            onClick={() => setActiveSubTab('CLIENTES_VENDAS')}
            className={`mac-segmented-item ${activeSubTab === 'CLIENTES_VENDAS' ? 'mac-segmented-item-active' : ''}`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clientes & Vendas ({clientes.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('PRODUTOS')}
            className={`mac-segmented-item ${activeSubTab === 'PRODUTOS' ? 'mac-segmented-item-active' : ''}`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Catálogo de Produtos ({produtos.length})</span>
          </button>
        </div>

        <div className="text-xs text-[var(--graphite-text-secondary)] font-medium">
          Módulo Comercial & Produtos
        </div>
      </div>

      {/* SubTab Views */}
      {activeSubTab === 'CLIENTES_VENDAS' ? (
        <GestaoClientesDashboard
          clientes={clientes}
          vendas={vendas}
          produtos={produtos}
          motoristas={motoristas}
          freightRatePerTon={freightRatePerTon}
          defaultSaleFreightPayable={defaultSaleFreightPayable}
          onAddClient={onAddClient}
          onUpdateClient={onUpdateClient}
          onDeleteClient={onDeleteClient}
          onAddVenda={onAddVenda}
          onUpdateVenda={onUpdateVenda}
          onDeleteVenda={onDeleteVenda}
          onToggleVendaStatus={onToggleVendaStatus}
          lockedMonths={lockedMonths}
          appSettings={appSettings}
          customLogo={customLogo}
        />
      ) : (
        <TableProdutos
          records={produtos}
          searchTerm={searchTerm}
          onAddRecord={onAddProduto}
          onUpdateRecord={onUpdateProduto}
          onDeleteRecord={onDeleteProduto}
        />
      )}
    </div>
  );
};
