import React, { useState } from 'react';
import { CargaRecord, DepositoKlabinRecord, ProdutoRecord, MotoristaRecord, AppSettings } from '../types';
import { TableCargas } from './TableCargas';
import { TableDepositos } from './TableDepositos';
import { Truck, Building2, FileText } from 'lucide-react';
import { generateKlabinStatementPdf } from '../utils/pdfGenerator';

interface KlabinDashboardProps {
  cargasRecords: CargaRecord[];
  depositosRecords: DepositoKlabinRecord[];
  searchTerm: string;
  onEditCarga?: (record: CargaRecord) => void;
  onDeleteCarga: (id: string) => void;
  onAddCarga: () => void;
  onUpdateCargaRecord: (record: CargaRecord) => void;
  onEditDeposito?: (record: DepositoKlabinRecord) => void;
  onDeleteDeposito: (id: string) => void;
  onAddDeposito: () => void;
  onUpdateDepositoRecord: (record: DepositoKlabinRecord) => void;
  produtos?: ProdutoRecord[];
  lockedMonths?: string[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
  activeSubTab?: 'CARGAS' | 'DEPOSITOS';
  onSubTabChange?: (subTab: 'CARGAS' | 'DEPOSITOS') => void;
  initialSubTab?: 'CARGAS' | 'DEPOSITOS';
  appSettings?: AppSettings;
  customLogo?: string;
}

export const KlabinDashboard: React.FC<KlabinDashboardProps> = ({
  cargasRecords,
  depositosRecords,
  searchTerm,
  onEditCarga,
  onDeleteCarga,
  onAddCarga,
  onUpdateCargaRecord,
  onEditDeposito,
  onDeleteDeposito,
  onAddDeposito,
  onUpdateDepositoRecord,
  produtos = [],
  lockedMonths = [],
  motoristas = [],
  freightRatePerTon = 15,
  activeSubTab: controlledSubTab,
  onSubTabChange,
  initialSubTab = 'CARGAS',
  appSettings,
  customLogo,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<'CARGAS' | 'DEPOSITOS'>(initialSubTab);

  const currentSubTab = controlledSubTab !== undefined ? controlledSubTab : internalSubTab;

  const handleSubTabSwitch = (tab: 'CARGAS' | 'DEPOSITOS') => {
    if (controlledSubTab === undefined) {
      setInternalSubTab(tab);
    }
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  const handleGeneratePdf = () => {
    generateKlabinStatementPdf({
      depositos: depositosRecords,
      cargas: cargasRecords,
      appSettings,
      customLogo,
    });
  };

  return (
    <div className="space-y-6">
      {/* Graphite Pro macOS Segmented Control */}
      <div className="flex items-center justify-between border-b border-[var(--graphite-border-subtle)] pb-4">
        <div className="mac-segmented-control">
          <button
            onClick={() => handleSubTabSwitch('CARGAS')}
            className={`mac-segmented-item ${currentSubTab === 'CARGAS' ? 'mac-segmented-item-active' : ''}`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Cargas de Madeira ({cargasRecords.length})</span>
          </button>
          <button
            onClick={() => handleSubTabSwitch('DEPOSITOS')}
            className={`mac-segmented-item ${currentSubTab === 'DEPOSITOS' ? 'mac-segmented-item-active' : ''}`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Depósitos Klabin ({depositosRecords.length})</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleGeneratePdf}
            className="mac-button-secondary py-1.5 px-3 text-xs flex items-center space-x-1.5"
            title="Gerar Extrato do Saldo Klabin em PDF"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Gerar Extrato PDF</span>
          </button>
          <div className="hidden sm:block text-xs text-[var(--graphite-text-secondary)] font-medium">
            Módulo Klabin S.A.
          </div>
        </div>
      </div>

      {/* SubTab Views */}
      {currentSubTab === 'CARGAS' ? (
        <TableCargas
          records={cargasRecords}
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
          records={depositosRecords}
          searchTerm={searchTerm}
          onEdit={onEditDeposito}
          onDelete={onDeleteDeposito}
          onAdd={onAddDeposito}
          lockedMonths={lockedMonths}
        />
      )}
    </div>
  );
};
