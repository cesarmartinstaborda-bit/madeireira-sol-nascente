import React, { useMemo, useState } from 'react';
import { CargaRecord, DepositoKlabinRecord, ProdutoRecord, MotoristaRecord, AppSettings } from '../types';
import { TableCargas } from './TableCargas';
import { TableDepositos } from './TableDepositos';
import { Truck, Building2, FileText, Wallet } from 'lucide-react';
import { generateKlabinStatementPdf } from '../utils/pdfGenerator';
import { formatCurrency } from '../utils/formatters';
import { calcKlabinBalance } from '../utils/klabinBalance';

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

  // Mesma regra de cálculo do saldo usada no Header, no Dashboard e no PDF do Klabin —
  // aqui é só a exibição de um resumo único, não uma nova regra de negócio.
  const { saldo } = useMemo(
    () => calcKlabinBalance({ cargas: cargasRecords, depositos: depositosRecords }),
    [cargasRecords, depositosRecords]
  );

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
      {/* Resumo único do módulo: saldo livre Klabin */}
      <div className="glass-card p-4 flex items-center space-x-3">
        <div className="p-2.5 bg-[#232832] text-emerald-400 rounded-xl border border-[var(--graphite-border-subtle)]">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
            Saldo Livre Klabin
          </span>
          <span className={`text-lg font-bold font-mono ${saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(saldo)}
          </span>
        </div>
      </div>

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
