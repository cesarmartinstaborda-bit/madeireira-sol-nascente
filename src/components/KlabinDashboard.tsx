import React from 'react';
import { CargaRecord, DepositoKlabinRecord, ProdutoRecord, MotoristaRecord } from '../types';
import { TableCargas } from './TableCargas';
import { TableDepositos } from './TableDepositos';
import { Package, Building2 } from 'lucide-react';

interface KlabinDashboardProps {
  cargas: CargaRecord[];
  depositos: DepositoKlabinRecord[];
  searchTerm: string;
  produtos?: ProdutoRecord[];
  lockedMonths?: string[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
  activeSubTab: 'CARGAS' | 'DEPOSITOS';
  onSubTabChange: (tab: 'CARGAS' | 'DEPOSITOS') => void;
  onEditCarga: (record: CargaRecord) => void;
  onDeleteCarga: (id: string) => void;
  onAddCarga: () => void;
  onUpdateCargaRecord: (record: CargaRecord) => void;
  onEditDeposito?: (record: DepositoKlabinRecord) => void;
  onDeleteDeposito: (id: string) => void;
  onAddDeposito: () => void;
  onUpdateDepositoRecord: (record: DepositoKlabinRecord) => void;
}

export const KlabinDashboard: React.FC<KlabinDashboardProps> = ({
  cargas,
  depositos,
  searchTerm,
  produtos = [],
  lockedMonths = [],
  motoristas = [],
  freightRatePerTon = 15,
  activeSubTab,
  onSubTabChange,
  onEditCarga,
  onDeleteCarga,
  onAddCarga,
  onUpdateCargaRecord,
  onEditDeposito,
  onDeleteDeposito,
  onAddDeposito,
  onUpdateDepositoRecord,
}) => {
  return (
    <div className="space-y-6">
      {/* Sub-Navigation Bar: Cargas vs Depósitos Klabin */}
      <div className="mac-segmented-control">
        <button
          onClick={() => onSubTabChange('CARGAS')}
          className={`mac-segmented-item flex items-center gap-2 ${
            activeSubTab === 'CARGAS' ? 'mac-segmented-item-active' : ''
          }`}
        >
          <Package className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Cargas de Madeira ({cargas.length})</span>
        </button>

        <button
          onClick={() => onSubTabChange('DEPOSITOS')}
          className={`mac-segmented-item flex items-center gap-2 ${
            activeSubTab === 'DEPOSITOS' ? 'mac-segmented-item-active' : ''
          }`}
        >
          <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Depósitos Klabin ({depositos.length})</span>
        </button>
      </div>

      {activeSubTab === 'CARGAS' ? (
        <TableCargas
          records={cargas}
          searchTerm={searchTerm}
          onEdit={onEditCarga}
          onDelete={onDeleteCarga}
          onAdd={onAddCarga}
          onUpdateRecord={onUpdateCargaRecord}
          produtos={produtos}
          lockedMonths={lockedMonths}
          motoristas={motoristas}
          freightRatePerTon={freightRatePerTon}
        />
      ) : (
        <TableDepositos
          records={depositos}
          searchTerm={searchTerm}
          onEdit={onEditDeposito}
          onDelete={onDeleteDeposito}
          onAdd={onAddDeposito}
          onUpdateRecord={onUpdateDepositoRecord}
          lockedMonths={lockedMonths}
        />
      )}
    </div>
  );
};
