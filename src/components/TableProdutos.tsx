import React, { useState } from 'react';
import { ProdutoRecord, UNIT_OF_MEASURE_OPTIONS, UnitOfMeasure } from '../types';
import { Pagination } from './Pagination';
import {
  Package,
  Plus,
  Trash2,
  Tag,
} from 'lucide-react';

interface TableProdutosProps {
  records: ProdutoRecord[];
  searchTerm: string;
  onAdd: (produto: Partial<ProdutoRecord>) => void;
  onUpdateRecord: (produto: ProdutoRecord) => void;
  onDelete: (id: string) => void;
}

export const TableProdutos: React.FC<TableProdutosProps> = ({
  records,
  searchTerm,
  onAdd,
  onUpdateRecord,
  onDelete,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // New product inputs
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState<number>(250);
  const [newUnit, setNewUnit] = useState<UnitOfMeasure | string>('ton');
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [newDesc, setNewDesc] = useState('');

  // Filter records
  const filtered = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      r.name.toLowerCase().includes(term) ||
      (r.description && r.description.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedRecords = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Form error & submitting state
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form submit handler
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!newName.trim()) {
      setFormError('O nome do produto é obrigatório.');
      return;
    }
    if (Number(newPrice) <= 0) {
      setFormError('O preço de referência deve ser maior que zero.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      onAdd({
        name: newName.trim(),
        referencePrice: Number(newPrice) || 0,
        unitOfMeasure: newUnit,
        status: newStatus,
        description: newDesc.trim() || 'Produto cadastrado no catálogo',
        createdAt: new Date().toISOString(),
      });

      setNewName('');
      setNewPrice(250);
      setNewUnit('ton');
      setNewStatus('ACTIVE');
      setNewDesc('');
      setShowAddForm(false);
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info & Action Button */}
      <div className="glass-card p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-xs">
          <Package className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Catálogo de Produtos</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="mac-button-primary px-3.5 py-1.5 font-bold text-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Produto</span>
        </button>
      </div>

      {/* Add Product Collapsible Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="glass-card p-5 space-y-4 text-xs border border-white/[0.10] rounded-2xl animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" /> Cadastrar Novo Produto
            </h3>
            <button
              type="button"
              onClick={() => {
                setFormError('');
                setShowAddForm(false);
              }}
              className="text-slate-400 hover:text-slate-100 font-bold text-base"
            >
              ✕
            </button>
          </div>

          {formError && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Nome do Produto *</label>
              <input
                type="text"
                required
                placeholder="Ex: Pinus Taeda Qualidade A"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mac-input w-full font-bold text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Preço de Referência (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="250.00"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="mac-input w-full font-mono font-bold text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Unidade de Medida *</label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="mac-input w-full font-bold text-slate-100"
              >
                {UNIT_OF_MEASURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Status *</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="mac-input w-full font-bold text-slate-100"
              >
                <option value="ACTIVE">ATIVO</option>
                <option value="INACTIVE">INATIVO</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Descrição / Especificação</label>
              <input
                type="text"
                placeholder="Detalhes técnicos ou uso..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="mac-input w-full text-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="mac-button-secondary text-xs px-3.5 py-1.5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mac-button-primary px-4 py-1.5 font-bold text-xs"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-1.5">
          <span className="font-semibold text-slate-400 text-[11px]">Status:</span>
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

        <div className="text-slate-400 font-medium">
          Exibindo <span className="text-slate-100 font-bold font-mono">{filtered.length}</span> produtos
        </div>
      </div>

      {/* Products Data Grid Table */}
      <div className="mac-table-container">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">Nenhum produto encontrado</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Cadastre seu primeiro produto para criar sua tabela de preços de referência.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 mac-button-primary px-4 py-2 font-semibold text-xs"
            >
              + Adicionar Produto
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-4 w-56">Nome do Produto</th>
                  <th className="py-2.5 px-4 text-right w-40">Preço de Referência (R$)</th>
                  <th className="py-2.5 px-4 text-center w-36">Unidade de Medida</th>
                  <th className="py-2.5 px-4 text-center w-32">Status</th>
                  <th className="py-2.5 px-4">Descrição / Especificação</th>
                  <th className="py-2.5 px-4 text-center w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedRecords.map((item) => {
                  const isActive = item.status === 'ACTIVE';

                  return (
                    <tr key={item.id} className="mac-table-row">
                      {/* Name editable input */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) =>
                              onUpdateRecord({ ...item, name: e.target.value })
                            }
                            className="mac-input w-full font-bold text-slate-100 py-0.5 px-2"
                          />
                        </div>
                      </td>

                      {/* Reference Price editable input */}
                      <td className="py-2 px-3 text-right">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={item.referencePrice ?? 0}
                            onChange={(e) =>
                              onUpdateRecord({
                                ...item,
                                referencePrice: Number(e.target.value),
                              })
                            }
                            className="mac-input w-full font-mono text-right font-bold text-slate-100 py-0.5 px-2"
                            title="Preço de Referência puxado automaticamente ao lançar Cargas e Vendas"
                          />
                        </div>
                      </td>

                      {/* Unit of Measure editable select */}
                      <td className="py-2 px-3 text-center">
                        <select
                          value={item.unitOfMeasure || 'ton'}
                          onChange={(e) =>
                            onUpdateRecord({
                              ...item,
                              unitOfMeasure: e.target.value,
                            })
                          }
                          className="mac-input w-full font-bold text-blue-400 bg-blue-500/10 border-blue-500/20 py-0.5 px-2"
                        >
                          {UNIT_OF_MEASURE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Status toggle select */}
                      <td className="py-2 px-3 text-center">
                        <select
                          value={item.status}
                          onChange={(e) =>
                            onUpdateRecord({
                              ...item,
                              status: e.target.value as 'ACTIVE' | 'INACTIVE',
                            })
                          }
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isActive
                              ? 'badge-emerald'
                              : 'badge-neutral'
                          }`}
                        >
                          <option value="ACTIVE">ATIVO</option>
                          <option value="INACTIVE">INATIVO</option>
                        </select>
                      </td>

                      {/* Description editable input */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) =>
                            onUpdateRecord({ ...item, description: e.target.value })
                          }
                          placeholder="Observação do produto..."
                          className="mac-input w-full text-slate-300 py-0.5 px-2"
                        />
                      </td>

                      {/* Delete Action */}
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                          title="Excluir produto do catálogo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};
