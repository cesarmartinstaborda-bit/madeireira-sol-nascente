import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ProdutoRecord } from '../types';
import { formatBRLCurrencyInput, formatCurrency, parseBRLCurrency } from '../utils/formatters';
import { Package, Plus, Edit2, Trash2, X } from 'lucide-react';

interface TableProdutosProps {
  records: ProdutoRecord[];
  searchTerm: string;
  onAddRecord: (prodData: Partial<ProdutoRecord>) => void;
  onUpdateRecord: (prod: ProdutoRecord) => void;
  onDeleteRecord: (prodId: string) => void;
}

export const TableProdutos: React.FC<TableProdutosProps> = ({
  records,
  searchTerm,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingProd, setEditingProd] = useState<ProdutoRecord | null>(null);
  const [prodName, setProdName] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('ton');
  const [refPrice, setRefPrice] = useState('250');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  const filtered = records.filter((r) => {
    if (!searchTerm) return true;
    return r.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const openModal = (prod?: ProdutoRecord) => {
    if (prod) {
      setEditingProd(prod);
      setProdName(prod.name);
      setUnitOfMeasure(prod.unitOfMeasure || 'ton');
      setRefPrice(formatBRLCurrencyInput(prod.referencePrice));
      setStatus(prod.status || 'ACTIVE');
    } else {
      setEditingProd(null);
      setProdName('');
      setUnitOfMeasure('ton');
      setRefPrice('250');
      setStatus('ACTIVE');
    }
    setShowModal(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;

    const parsedPrice = parseBRLCurrency(refPrice) || 0;

    if (editingProd) {
      onUpdateRecord({
        ...editingProd,
        name: prodName.trim(),
        unitOfMeasure: unitOfMeasure.trim() || 'ton',
        referencePrice: parsedPrice,
        status,
      });
    } else {
      onAddRecord({
        name: prodName.trim(),
        unitOfMeasure: unitOfMeasure.trim() || 'ton',
        referencePrice: parsedPrice,
        status,
      });
    }
    setShowModal(false);
  };

  const modalContent = showModal && typeof document !== 'undefined' ? (
    createPortal(
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-[#181c23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] max-h-[90vh] overflow-y-auto my-auto">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--graphite-border-subtle)]">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Package className="w-4 h-4 text-blue-400" />
              <span>{editingProd ? 'Editar Produto' : 'Novo Produto'}</span>
            </h3>
            <button
              onClick={() => setShowModal(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveModal} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nome do Produto *</label>
              <input
                type="text"
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Ex: Eucalipto Tora"
                className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Unidade de Medida *</label>
                <input
                  type="text"
                  required
                  value={unitOfMeasure}
                  onChange={(e) => setUnitOfMeasure(e.target.value)}
                  placeholder="Ex: ton, st, m³"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Preço de Referência (R$) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={refPrice}
                  onChange={(e) => setRefPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Status do Produto *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-semibold"
              >
                <option value="ACTIVE">ATIVO</option>
                <option value="INACTIVE">INATIVO</option>
              </select>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-[var(--graphite-border-subtle)]">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="mac-button-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="mac-button-primary"
              >
                Salvar Produto
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div className="glass-card-static overflow-hidden">
      <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
        <h2 className="text-sm font-bold text-white flex items-center space-x-2">
          <Package className="w-4 h-4 text-blue-400" />
          <span>Catálogo de Produtos ({filtered.length})</span>
        </h2>
        <button
          onClick={() => openModal()}
          className="mac-button-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Produto</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="mac-table-header">
              <th className="py-2.5 px-3">Nome do Produto</th>
              <th className="py-2.5 px-3">Unidade de Medida</th>
              <th className="py-2.5 px-3 text-right">Preço Referência (R$)</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isInactive = r.status === 'INACTIVE';
                return (
                  <tr key={r.id} className={`mac-table-row ${isInactive ? 'opacity-60 bg-[#12151a]/40' : ''}`}>
                    <td className="py-2.5 px-3 font-semibold text-white">{r.name}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{r.unitOfMeasure}</td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-emerald-400 font-mono">
                      {formatCurrency(r.referencePrice)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isInactive ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#1a1d24] text-slate-400 border border-[var(--graphite-border-subtle)]">
                          INATIVO
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                          ATIVO
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => openModal(r)}
                          className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all"
                          title="Editar produto"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteRecord(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all"
                          title="Excluir produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalContent}
    </div>
  );
};
