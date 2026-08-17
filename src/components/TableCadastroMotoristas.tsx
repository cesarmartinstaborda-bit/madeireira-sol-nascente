import React, { useState } from 'react';
import { MotoristaRecord } from '../types';
import { Truck, Plus, Search, Edit2, Trash2, Phone, CheckCircle2, XCircle, UserCheck } from 'lucide-react';
import { generateId } from '../utils/idGenerator';

interface TableCadastroMotoristasProps {
  motoristas: MotoristaRecord[];
  onAddMotorista: (motorista: MotoristaRecord) => void;
  onUpdateMotorista: (motorista: MotoristaRecord) => void;
  onDeleteMotorista: (id: string) => void;
}

export const TableCadastroMotoristas: React.FC<TableCadastroMotoristasProps> = ({
  motoristas = [],
  onAddMotorista,
  onUpdateMotorista,
  onDeleteMotorista,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMotorista, setEditingMotorista] = useState<MotoristaRecord | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    licensePlate: '',
    trailerPlate: '',
    phone: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Open modal for add
  const handleOpenAdd = () => {
    setEditingMotorista(null);
    setFormData({
      name: '',
      licensePlate: '',
      trailerPlate: '',
      phone: '',
      status: 'ACTIVE',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (m: MotoristaRecord) => {
    setEditingMotorista(m);
    setFormData({
      name: m.name,
      licensePlate: m.licensePlate,
      trailerPlate: m.trailerPlate || '',
      phone: m.phone || '',
      status: m.status,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!formData.name.trim()) errs.name = 'Nome do motorista é obrigatório.';
    if (!formData.licensePlate.trim()) errs.licensePlate = 'Placa do cavalo é obrigatória.';

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    if (editingMotorista) {
      onUpdateMotorista({
        ...editingMotorista,
        name: formData.name.trim(),
        licensePlate: formData.licensePlate.trim().toUpperCase(),
        trailerPlate: formData.trailerPlate.trim().toUpperCase() || undefined,
        phone: formData.phone.trim() || undefined,
        status: formData.status,
      });
    } else {
      onAddMotorista({
        id: generateId('mot'),
        name: formData.name.trim(),
        licensePlate: formData.licensePlate.trim().toUpperCase(),
        trailerPlate: formData.trailerPlate.trim().toUpperCase() || undefined,
        phone: formData.phone.trim() || undefined,
        status: formData.status,
        createdAt: new Date().toISOString(),
      });
    }

    setIsModalOpen(false);
  };

  const handleToggleStatus = (m: MotoristaRecord) => {
    const nextStatus = m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    onUpdateMotorista({
      ...m,
      status: nextStatus,
    });
  };

  // Filtered records
  const filtered = motoristas.filter((m) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      m.name.toLowerCase().includes(term) ||
      m.licensePlate.toLowerCase().includes(term) ||
      (m.trailerPlate && m.trailerPlate.toLowerCase().includes(term)) ||
      (m.phone && m.phone.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalActive = motoristas.filter((m) => m.status === 'ACTIVE').length;
  const totalInactive = motoristas.filter((m) => m.status === 'INACTIVE').length;

  return (
    <div className="space-y-4">
      {/* Top Banner & KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total de Motoristas</p>
            <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">{motoristas.length}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Cadastrados no sistema</p>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Motoristas Ativos</p>
            <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">{totalActive}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Disponíveis para frete</p>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Inativos / Pausados</p>
            <h3 className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">{totalInactive}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Sem escala de transporte</p>
          </div>
          <div className="p-2.5 bg-white/[0.04] rounded-xl text-slate-400 border border-white/[0.08]">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="glass-card p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar motorista, placa ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mac-input w-full pl-8 py-1.5 text-xs"
            />
          </div>

          {/* Status Filter */}
          <div className="mac-segmented-control">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`mac-segmented-item ${statusFilter === 'ALL' ? 'mac-segmented-item-active' : ''}`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`mac-segmented-item ${statusFilter === 'ACTIVE' ? 'mac-segmented-item-active' : ''}`}
            >
              Ativos
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`mac-segmented-item ${statusFilter === 'INACTIVE' ? 'mac-segmented-item-active' : ''}`}
            >
              Inativos
            </button>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="mac-button-primary px-3.5 py-1.5 font-bold text-xs flex items-center justify-center gap-1.5 w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Motorista</span>
        </button>
      </div>

      {/* Table */}
      <div className="mac-table-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="mac-table-header">
              <tr>
                <th className="py-2.5 px-4">Motorista</th>
                <th className="py-2.5 px-4">Placa Cavalo</th>
                <th className="py-2.5 px-4">Placa Carreta</th>
                <th className="py-2.5 px-4">Telefone / Whats</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhum motorista encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="mac-table-row">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/15 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0 border border-blue-500/25">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-100">{m.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-200">
                      <span className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded-md font-mono text-xs text-slate-200">
                        {m.licensePlate}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">
                      {m.trailerPlate ? (
                        <span className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded-md font-mono text-xs text-slate-200">
                          {m.trailerPlate}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Não informada</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {m.phone ? (
                        <span className="inline-flex items-center gap-1 text-slate-200">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {m.phone}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(m)}
                        title="Clique para alternar status Ativo / Inativo"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                          m.status === 'ACTIVE'
                            ? 'badge-emerald hover:opacity-90'
                            : 'badge-neutral hover:opacity-90'
                        }`}
                      >
                        {m.status === 'ACTIVE' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>ATIVO</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>INATIVO</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenEdit(m)}
                          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] rounded-lg transition-colors"
                          title="Editar cadastro"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Tem certeza que deseja excluir o motorista "${m.name}"?`)) {
                              onDeleteMotorista(m.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="mac-hud max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-white/[0.02] text-slate-100 flex items-center justify-between border-b border-white/[0.08]">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-500/15 rounded-lg text-blue-400 border border-blue-500/25">
                  <Truck className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-100">
                  {editingMotorista ? 'Editar Motorista' : 'Cadastrar Novo Motorista'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-white/[0.08]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome Completo do Motorista *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mac-input w-full text-slate-100"
                />
                {formErrors.name && (
                  <p className="text-[11px] text-rose-400 mt-1 font-medium">{formErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Placa do Cavalo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: ABC-4E12"
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                    className="mac-input w-full font-mono text-slate-100"
                  />
                  {formErrors.licensePlate && (
                    <p className="text-[11px] text-rose-400 mt-1 font-medium">
                      {formErrors.licensePlate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Placa da Carreta
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: XYZ-1020"
                    value={formData.trailerPlate}
                    onChange={(e) => setFormData({ ...formData, trailerPlate: e.target.value })}
                    className="mac-input w-full font-mono text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (42) 99911-2233"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mac-input w-full text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })
                    }
                    className="mac-input w-full font-semibold text-slate-100"
                  >
                    <option value="ACTIVE">ATIVO</option>
                    <option value="INACTIVE">INATIVO</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mac-button-secondary text-xs px-3.5 py-1.5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mac-button-primary text-xs px-4 py-1.5 font-bold"
                >
                  Salvar Motorista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
