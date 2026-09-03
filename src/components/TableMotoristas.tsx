import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CargaRecord, VendaRecord, MotoristaRecord, AppSettings } from '../types';
import { formatCurrency, formatNumber, formatDateBR } from '../utils/formatters';
import { Users, CheckCircle, Clock, DollarSign, Plus, Edit2, Trash2, Phone, CreditCard, AlertCircle, Lock, FileText } from 'lucide-react';
import { generateId } from '../utils/idGenerator';
import { getFreightGroupsByDriver, getFreightRecords, DriverFreightGroup } from '../utils/freightUtils';
import { generateDriverPendingPdf } from '../utils/pdfGenerator';

interface TableMotoristasProps {
  cargas: CargaRecord[];
  vendas: VendaRecord[];
  motoristas: MotoristaRecord[];
  freightRatePerTon: number;
  searchTerm: string;
  onPayFreight: (driverKeyOrId: string, transactionKey?: string) => void;
  onRevertFreight: (driverKeyOrId: string) => void;
  onToggleSingleFreight: (type: 'CARGA' | 'VENDA', recordId: string, transactionKey?: string) => void;
  onAddMotorista: (motorista: MotoristaRecord) => void;
  onUpdateMotorista: (motorista: MotoristaRecord) => void;
  onDeleteMotorista: (id: string) => void;
  lockedMonths?: string[];
  appSettings?: AppSettings;
  customLogo?: string;
}

export const TableMotoristas: React.FC<TableMotoristasProps> = ({
  cargas,
  vendas,
  motoristas,
  freightRatePerTon,
  searchTerm,
  onPayFreight,
  onRevertFreight,
  onToggleSingleFreight,
  onAddMotorista,
  onUpdateMotorista,
  onDeleteMotorista,
  lockedMonths = [],
  appSettings,
  customLogo,
}) => {
  const [activeTab, setActiveTab] = useState<'FREIGHTS' | 'PAID_FREIGHTS' | 'DRIVERS'>('FREIGHTS');
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<MotoristaRecord | null>(null);
  const [pdfNotification, setPdfNotification] = useState<string | null>(null);

  // Form fields for new/edited driver
  const [driverName, setDriverName] = useState('');
  const [driverPlate, setDriverPlate] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverPixKey, setDriverPixKey] = useState('');

  const isLocked = (dateStr?: string) => {
    if (!dateStr || dateStr.length < 7 || !Array.isArray(lockedMonths)) return false;
    return lockedMonths.includes(dateStr.slice(0, 7));
  };

  const openDriverModal = (driver?: MotoristaRecord) => {
    if (driver) {
      setEditingDriver(driver);
      setDriverName(driver.name);
      setDriverPlate(driver.licensePlate);
      setDriverPhone(driver.phone || '');
      setDriverPixKey(driver.pixKey || '');
    } else {
      setEditingDriver(null);
      setDriverName('');
      setDriverPlate('');
      setDriverPhone('');
      setDriverPixKey('');
    }
    setShowDriverModal(true);
  };

  const handleSaveDriverModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) return;

    if (editingDriver) {
      onUpdateMotorista({
        ...editingDriver,
        name: driverName.trim(),
        licensePlate: driverPlate.trim(),
        phone: driverPhone.trim(),
        pixKey: driverPixKey.trim(),
      });
    } else {
      onAddMotorista({
        id: generateId('drv'),
        name: driverName.trim(),
        licensePlate: driverPlate.trim(),
        phone: driverPhone.trim(),
        pixKey: driverPixKey.trim(),
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      });
    }
    setShowDriverModal(false);
  };

  // Group freights by unique driver using centralized freightUtils. The list is
  // split by payment status into two tabs: pending accounts and settled accounts.
  const pendingFreightGroups = React.useMemo(() => {
    return getFreightGroupsByDriver(
      {
        Cargas: cargas,
        Vendas: vendas,
        Motoristas: motoristas,
        appSettings: { freightRatePerTon },
      },
      searchTerm,
      'PENDING'
    );
  }, [cargas, vendas, motoristas, freightRatePerTon, searchTerm]);

  const paidFreightGroups = React.useMemo(() => {
    return getFreightGroupsByDriver(
      {
        Cargas: cargas,
        Vendas: vendas,
        Motoristas: motoristas,
        appSettings: { freightRatePerTon },
      },
      searchTerm,
      'PAID'
    );
  }, [cargas, vendas, motoristas, freightRatePerTon, searchTerm]);

  // Header indicators: one pass over the unified freight records instead of three
  // full scans on every render (Firestore snapshot echoes and unrelated state
  // changes were re-running getFreightRecords 3x per render).
  const { grandTotalFreight, grandPendingFreight, grandPaidFreight } = React.useMemo(() => {
    const records = getFreightRecords({
      Cargas: cargas,
      Vendas: vendas,
      Motoristas: motoristas,
      appSettings: { freightRatePerTon },
    });
    let pending = 0;
    let paid = 0;
    for (const r of records) {
      const cost = Number(r.freightCost) || 0;
      if (r.freightStatus === 'PAID') paid += cost;
      else pending += cost;
    }
    return { grandTotalFreight: pending + paid, grandPendingFreight: pending, grandPaidFreight: paid };
  }, [cargas, vendas, motoristas, freightRatePerTon]);

  // Shared rendering for both freight tabs. `mode` only tweaks copy/affordances
  // that don't make sense in the other tab; the account grouping, totals and
  // per-record data all come straight from the status-filtered groups.
  const renderFreightGroups = (groups: DriverFreightGroup[], mode: 'PENDING' | 'PAID') => (
    <div className="space-y-4">
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

      {groups.length === 0 ? (
        <div className="glass-card-static p-8 text-center text-slate-500 font-medium">
          {mode === 'PAID'
            ? 'Nenhum frete quitado encontrado.'
            : 'Nenhum lançamento de frete pendente encontrado.'}
        </div>
      ) : (
        groups.map((group) => {
          // Prefer the id of a driver that is actually in the cadastro. A
          // record can still carry the id of a deleted Motorista, and paying
          // by that orphan id would skip the group's other records; the
          // driverKey text matches all of them.
          const driverIdentifier = group.motoristaObj?.id || group.driverKey;
          return (
            <div key={group.groupKey} className="glass-card-static overflow-hidden">
              {/* Driver Header */}
              <div className="p-4 bg-[var(--graphite-surface-2)] border-b border-[var(--graphite-border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>{group.driverKey}</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
                    {group.motoristaObj?.phone && (
                      <span className="flex items-center space-x-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{group.motoristaObj.phone}</span>
                      </span>
                    )}
                    {group.motoristaObj?.pixKey && (
                      <span className="flex items-center space-x-1 font-mono text-emerald-400">
                        <CreditCard className="w-3 h-3 text-emerald-400" />
                        <span>Pix: {group.motoristaObj.pixKey}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Pendente</span>
                    <span className="text-xs font-extrabold text-amber-400 font-mono">
                      {formatCurrency(group.pendingFreightCost)}
                    </span>
                  </div>

                  {mode === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => {
                        const success = generateDriverPendingPdf({
                          driver: {
                            id: group.driverId,
                            name: group.motoristaObj?.name || group.driverKey,
                            licensePlate: group.motoristaObj?.licensePlate,
                            driverKey: group.driverKey,
                          },
                          cargas,
                          vendas,
                          motoristas,
                          appSettings,
                          customLogo,
                        });
                        if (!success) {
                          setPdfNotification('Este motorista não possui fretes pendentes.');
                          setTimeout(() => setPdfNotification(null), 3500);
                        }
                      }}
                      className="mac-button-secondary py-1.5 px-3 text-xs flex items-center space-x-1.5"
                      title="Gerar demonstrativo de fretes em PDF"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>Gerar PDF</span>
                    </button>
                  )}

                  {mode === 'PENDING' ? (
                    <button
                      type="button"
                      onClick={() => onPayFreight(driverIdentifier)}
                      className="mac-button-primary"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Quitar Fretes Pendentes</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRevertFreight(driverIdentifier)}
                      className="mac-button-secondary"
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Reverter Quitação</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Freight Records Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="mac-table-header">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Produto</th>
                      <th className="py-2.5 px-3 text-right">Qtd (Ton)</th>
                      <th className="py-2.5 px-3 text-right">Custo Frete</th>
                      <th className="py-2.5 px-3 text-center">Status Pagamento</th>
                      <th className="py-2.5 px-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
                    {group.records.map((rec) => {
                      const locked = isLocked(rec.date);
                      return (
                        <tr key={`${rec.type}-${rec.id}`} className="mac-table-row">
                          <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                            <div className="flex items-center space-x-1">
                              {locked && <Lock className="w-3 h-3 text-amber-400" />}
                              <span>{formatDateBR(rec.date)}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                rec.type === 'CARGA'
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                  : 'bg-blue-950/80 text-blue-300 border border-blue-800'
                              }`}
                            >
                              {rec.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{rec.product}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-200 font-mono">{formatNumber(rec.tons, 2)}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-white font-mono">
                            {formatCurrency(rec.freightCost)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                                rec.freightStatus === 'PAID'
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                  : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {rec.freightStatus === 'PAID'
                                ? `PAGO (${rec.freightPaidAt ? formatDateBR(rec.freightPaidAt) : 'Sim'})`
                                : 'PENDENTE'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => onToggleSingleFreight(rec.type, rec.id)}
                              className="px-2 py-1 bg-[#1a1d24] hover:bg-[#232832] text-slate-300 border border-[var(--graphite-border-subtle)] rounded-lg text-[11px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              {mode === 'PAID' ? 'Reverter para Pendente' : 'Alternar Status'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-[#232832] text-blue-400 rounded-xl border border-[var(--graphite-border-subtle)]">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
              Total Geral de Fretes
            </span>
            <span className="text-lg font-bold text-white font-mono">{formatCurrency(grandTotalFreight)}</span>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-[#232832] text-amber-400 rounded-xl border border-[var(--graphite-border-subtle)]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
              Fretes Pendentes a Pagar
            </span>
            <span className="text-lg font-bold text-amber-400 font-mono">{formatCurrency(grandPendingFreight)}</span>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-[#232832] text-emerald-400 rounded-xl border border-[var(--graphite-border-subtle)]">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
              Fretes Quitados / Pagos
            </span>
            <span className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(grandPaidFreight)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--graphite-border-subtle)] bg-[var(--graphite-surface-1)] rounded-t-2xl px-4 pt-3 space-x-2">
        <button
          onClick={() => setActiveTab('FREIGHTS')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'FREIGHTS'
              ? 'border-[var(--graphite-accent-blue)] text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Contas de Frete por Motorista</span>
        </button>
        <button
          onClick={() => setActiveTab('PAID_FREIGHTS')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'PAID_FREIGHTS'
              ? 'border-[var(--graphite-accent-blue)] text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Fretes Quitados</span>
        </button>
        <button
          onClick={() => setActiveTab('DRIVERS')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'DRIVERS'
              ? 'border-[var(--graphite-accent-blue)] text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Cadastro de Motoristas ({motoristas.length})</span>
        </button>
      </div>

      {/* TAB CONTENT: PENDING FREIGHTS BY DRIVER */}
      {activeTab === 'FREIGHTS' && renderFreightGroups(pendingFreightGroups, 'PENDING')}

      {/* TAB CONTENT: SETTLED FREIGHTS BY DRIVER */}
      {activeTab === 'PAID_FREIGHTS' && renderFreightGroups(paidFreightGroups, 'PAID')}

      {/* TAB CONTENT: DRIVER REGISTRATION */}
      {activeTab === 'DRIVERS' && (
        <div className="glass-card-static overflow-hidden">
          <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Motoristas Cadastrados ({motoristas.length})</span>
            </h2>
            <button
              onClick={() => openDriverModal()}
              className="mac-button-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Motorista</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-3">Nome Motorista</th>
                  <th className="py-2.5 px-3">Placa Veículo</th>
                  <th className="py-2.5 px-3">Telefone</th>
                  <th className="py-2.5 px-3">Chave Pix</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
                {motoristas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                      Nenhum motorista cadastrado no sistema.
                    </td>
                  </tr>
                ) : (
                  motoristas.map((m) => (
                    <tr key={m.id} className="mac-table-row">
                      <td className="py-2.5 px-3 font-semibold text-white">{m.name}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-300">{m.licensePlate}</td>
                      <td className="py-2.5 px-3 text-slate-400">{m.phone || '-'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{m.pixKey || '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            m.status === 'INACTIVE' ? 'bg-[#1a1d24] text-slate-400 border border-[var(--graphite-border-subtle)]' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {m.status === 'INACTIVE' ? 'INATIVO (Soft Delete)' : 'ATIVO'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => openDriverModal(m)}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all"
                            title="Editar motorista"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteMotorista(m.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all"
                            title="Excluir motorista"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Driver Add/Edit Modal */}
      {showDriverModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#181c23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="text-base font-bold text-white mb-4">
              {editingDriver ? 'Editar Cadastro de Motorista' : 'Cadastrar Novo Motorista'}
            </h3>
            <form onSubmit={handleSaveDriverModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Placa do Veículo *</label>
                <input
                  type="text"
                  required
                  value={driverPlate}
                  onChange={(e) => setDriverPlate(e.target.value.toUpperCase())}
                  placeholder="Ex: ABC-1234 ou ABC1D23"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="Ex: (42) 99988-7766"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Chave Pix para Acertos</label>
                <input
                  type="text"
                  value={driverPixKey}
                  onChange={(e) => setDriverPixKey(e.target.value)}
                  placeholder="CPF, Telefone, E-mail ou Chave Aleatória"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-[var(--graphite-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowDriverModal(false)}
                  className="mac-button-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mac-button-primary"
                >
                  Salvar Motorista
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
