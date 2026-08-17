import React from 'react';
import { ClientRecord, VendaRecord, ProdutoRecord, MotoristaRecord } from '../types';
import { GestaoClientesDashboard } from './GestaoClientesDashboard';
import { TableProdutos } from './TableProdutos';
import { Users, Tag } from 'lucide-react';

interface ClientesProdutosDashboardProps {
  clientes: ClientRecord[];
  vendas: VendaRecord[];
  produtos: ProdutoRecord[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
  searchTerm: string;
  activeSubTab: 'CLIENTES_VENDAS' | 'PRODUTOS';
  onSubTabChange: (tab: 'CLIENTES_VENDAS' | 'PRODUTOS') => void;
  onAddClient: (client: Partial<ClientRecord>) => void;
  onUpdateClient: (client: ClientRecord) => void;
  onDeleteClient: (id: string) => void;
  onAddVenda: (venda: Partial<VendaRecord>) => void;
  onUpdateVenda: (venda: VendaRecord) => void;
  onDeleteVenda: (id: string) => void;
  onToggleVendaStatus: (id: string, transactionKey?: string) => void;
  onAddProduto: (produto: Partial<ProdutoRecord>) => void;
  onUpdateProduto: (produto: ProdutoRecord) => void;
  onDeleteProduto: (id: string) => void;
  lockedMonths?: string[];
}

export const ClientesProdutosDashboard: React.FC<ClientesProdutosDashboardProps> = ({
  clientes,
  vendas,
  produtos,
  motoristas = [],
  freightRatePerTon = 15,
  searchTerm,
  activeSubTab,
  onSubTabChange,
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
}) => {
  return (
    <div className="space-y-6">
      {/* Sub-Navigation Bar: Clientes & Vendas vs Produtos */}
      <div className="mac-segmented-control">
        <button
          onClick={() => onSubTabChange('CLIENTES_VENDAS')}
          className={`mac-segmented-item flex items-center gap-2 ${
            activeSubTab === 'CLIENTES_VENDAS' ? 'mac-segmented-item-active' : ''
          }`}
        >
          <Users className="w-3.5 h-3.5 text-slate-300" strokeWidth={1.75} />
          <span>Clientes & Vendas ({clientes.length})</span>
        </button>

        <button
          onClick={() => onSubTabChange('PRODUTOS')}
          className={`mac-segmented-item flex items-center gap-2 ${
            activeSubTab === 'PRODUTOS' ? 'mac-segmented-item-active' : ''
          }`}
        >
          <Tag className="w-3.5 h-3.5 text-slate-300" strokeWidth={1.75} />
          <span>Produtos ({produtos.length})</span>
        </button>
      </div>

      {activeSubTab === 'CLIENTES_VENDAS' ? (
        <GestaoClientesDashboard
          clientes={clientes}
          vendas={vendas}
          produtos={produtos}
          motoristas={motoristas}
          freightRatePerTon={freightRatePerTon}
          onAddClient={onAddClient}
          onUpdateClient={onUpdateClient}
          onDeleteClient={onDeleteClient}
          onAddVenda={onAddVenda}
          onUpdateVenda={onUpdateVenda}
          onDeleteVenda={onDeleteVenda}
          onToggleVendaStatus={onToggleVendaStatus}
          lockedMonths={lockedMonths}
        />
      ) : (
        <TableProdutos
          records={produtos}
          searchTerm={searchTerm}
          onAdd={onAddProduto}
          onUpdateRecord={onUpdateProduto}
          onDelete={onDeleteProduto}
        />
      )}
    </div>
  );
};
