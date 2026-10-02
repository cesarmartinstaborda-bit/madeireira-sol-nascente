import React, { useMemo, useState } from 'react';
import { AppSettings, CargaRecord, DepositoKlabinRecord, MotoristaRecord, ProdutoRecord } from '../types';
import { TableCargas } from './TableCargas';
import { TableDepositos } from './TableDepositos';
import { formatBRL, formatMonthYearBR } from '../utils/formatters';
import { calcKlabinBalance } from '../utils/klabinBalance';
import { generateKlabinStatementPdf } from '../utils/pdfGenerator';
import { Archive, ArrowLeft, Building2, ChevronRight, FileText, Truck } from 'lucide-react';

interface HistoricoDashboardProps {
  /** Cargas already restricted to closed competencies (appSettings.cycles.lockedMonths). */
  cargas: CargaRecord[];
  /** Depósitos already restricted to closed competencies. */
  depositos: DepositoKlabinRecord[];
  lockedMonths: string[];
  produtos?: ProdutoRecord[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
  appSettings?: AppSettings;
  customLogo?: string;
  onEditCarga?: (record: CargaRecord) => void;
  onDeleteCarga: (id: string) => void;
  onUpdateCargaRecord: (record: CargaRecord) => void;
  onEditDeposito?: (record: DepositoKlabinRecord) => void;
  onDeleteDeposito: (id: string) => void;
  onUpdateDepositoRecord: (record: DepositoKlabinRecord) => void;
}

interface Competency {
  monthKey: string;
  cargas: CargaRecord[];
  depositos: DepositoKlabinRecord[];
  saldo: number;
}

export const HistoricoDashboard: React.FC<HistoricoDashboardProps> = ({
  cargas,
  depositos,
  lockedMonths,
  produtos = [],
  motoristas = [],
  freightRatePerTon = 15,
  appSettings,
  customLogo,
  onEditCarga,
  onDeleteCarga,
  onUpdateCargaRecord,
  onEditDeposito,
  onDeleteDeposito,
  onUpdateDepositoRecord,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Grouped strictly by appSettings.cycles.lockedMonths — the single source of truth
  // for what counts as a closed competency. Every record here already belongs to one.
  const competencies = useMemo<Competency[]>(() => {
    const months = [...(lockedMonths || [])].sort((a, b) => b.localeCompare(a));
    return months.map((monthKey) => {
      const monthCargas = cargas.filter((c) => (c.date || '').slice(0, 7) === monthKey);
      const monthDepositos = depositos.filter((d) => (d.date || '').slice(0, 7) === monthKey);
      const { saldo } = calcKlabinBalance({ cargas: monthCargas, depositos: monthDepositos });
      return { monthKey, cargas: monthCargas, depositos: monthDepositos, saldo };
    });
  }, [cargas, depositos, lockedMonths]);

  const selected = competencies.find((c) => c.monthKey === selectedMonth) || null;

  const handleGenerateCompetencyPdf = (competency: Competency) => {
    generateKlabinStatementPdf({
      cargas: competency.cargas,
      depositos: competency.depositos,
      appSettings,
      customLogo,
      periodLabel: formatMonthYearBR(competency.monthKey),
      periodKey: competency.monthKey,
    });
  };

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--graphite-border-subtle)] pb-4">
          <button
            onClick={() => setSelectedMonth(null)}
            className="mac-button-secondary py-1.5 px-3 text-xs flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Histórico</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => handleGenerateCompetencyPdf(selected)}
              className="mac-button-secondary py-1.5 px-3 text-xs flex items-center space-x-1.5"
              title="Gerar Extrato da Competência em PDF"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gerar PDF da Competência</span>
            </button>
            <div className="hidden sm:block text-xs text-[var(--graphite-text-secondary)] font-medium capitalize">
              {formatMonthYearBR(selected.monthKey)} · Competência Encerrada
            </div>
          </div>
        </div>

        <TableCargas
          records={selected.cargas}
          searchTerm=""
          onEdit={onEditCarga}
          onDelete={onDeleteCarga}
          onAdd={() => {}}
          onUpdateRecord={onUpdateCargaRecord}
          produtos={produtos}
          lockedMonths={lockedMonths}
          motoristas={motoristas}
          freightRatePerTon={freightRatePerTon}
          readOnly
        />

        <TableDepositos
          records={selected.depositos}
          searchTerm=""
          onEdit={onEditDeposito || (() => {})}
          onDelete={onDeleteDeposito}
          onAdd={() => {}}
          lockedMonths={lockedMonths}
          readOnly
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--graphite-border-subtle)] pb-4">
        <div className="flex items-center space-x-2 text-white font-bold text-sm">
          <Archive className="w-4 h-4 text-amber-400" />
          <span>Histórico de Competências Encerradas</span>
        </div>
        <div className="hidden sm:block text-xs text-[var(--graphite-text-secondary)] font-medium">
          Módulo Klabin S.A.
        </div>
      </div>

      {competencies.length === 0 ? (
        <div className="glass-card-static p-10 text-center text-slate-500 text-xs font-medium">
          Nenhuma competência encerrada até o momento. Tranque um mês em Configurações → Ciclos
          para movê-lo automaticamente para o Histórico.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {competencies.map((c) => (
            <button
              key={c.monthKey}
              onClick={() => setSelectedMonth(c.monthKey)}
              className="glass-card p-4 text-left hover:border-[var(--graphite-border-base)] transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white capitalize">{formatMonthYearBR(c.monthKey)}</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Truck className="w-3 h-3" />
                    <span>Cargas</span>
                  </span>
                  <span className="font-mono text-slate-200">{c.cargas.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Building2 className="w-3 h-3" />
                    <span>Depósitos</span>
                  </span>
                  <span className="font-mono text-slate-200">{c.depositos.length}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-[var(--graphite-border-subtle)] mt-1.5">
                  <span className="font-semibold text-slate-300">Saldo da Competência</span>
                  <span className={`font-mono font-bold ${c.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatBRL(c.saldo)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
