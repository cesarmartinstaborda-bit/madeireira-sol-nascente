import React, { useState } from 'react';
import { Edit2, Package, Trash2, Users } from 'lucide-react';
import { MaoDeObraClienteRecord, MaoDeObraProdutoRecord } from '../../types';
import { formatBRLCurrencyInput, parseBRLCurrency } from '../../utils/formatters';
import { formatOptionalBRL } from '../../utils/maoDeObra';
import { MAO_DE_OBRA_INPUT_CLASS } from './LancamentoForm';

interface CadastroPanelProps {
  clientes: MaoDeObraClienteRecord[];
  produtos: MaoDeObraProdutoRecord[];
  onSaveCliente: (name: string, editingId?: string) => void;
  onDeleteCliente: (record: MaoDeObraClienteRecord) => void;
  onSaveProduto: (name: string, pricePerTon: number | null, editingId?: string) => void;
  onDeleteProduto: (record: MaoDeObraProdutoRecord) => void;
}

const byName = <T extends { name: string }>(list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

const RowActions: React.FC<{ label: string; onEdit: () => void; onDelete: () => void }> = ({ label, onEdit, onDelete }) => (
  <div className="flex items-center justify-center space-x-1">
    <button onClick={onEdit} className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all" title={`Editar ${label}`}>
      <Edit2 className="w-3.5 h-3.5" />
    </button>
    <button onClick={onDelete} className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all" title={`Excluir ${label}`}>
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

export const CadastroPanel: React.FC<CadastroPanelProps> = ({
  clientes,
  produtos,
  onSaveCliente,
  onDeleteCliente,
  onSaveProduto,
  onDeleteProduto,
}) => {
  const [clienteName, setClienteName] = useState('');
  const [editingClienteId, setEditingClienteId] = useState<string | undefined>();
  const [produtoName, setProdutoName] = useState('');
  const [produtoPrice, setProdutoPrice] = useState('');
  const [editingProdutoId, setEditingProdutoId] = useState<string | undefined>();
  const [produtoError, setProdutoError] = useState('');

  const resetCliente = () => { setClienteName(''); setEditingClienteId(undefined); };
  const resetProduto = () => { setProdutoName(''); setProdutoPrice(''); setEditingProdutoId(undefined); setProdutoError(''); };

  const submitCliente = (e: React.FormEvent) => {
    e.preventDefault();
    const name = clienteName.trim();
    if (!name) return;
    onSaveCliente(name, editingClienteId);
    resetCliente();
  };

  const submitProduto = (e: React.FormEvent) => {
    e.preventDefault();
    const name = produtoName.trim();
    if (!name) return;
    const price = produtoPrice.trim() ? parseBRLCurrency(produtoPrice) : null;
    if (price !== null && (Number.isNaN(price) || price < 0)) {
      setProdutoError('Preço inválido. Use o formato 150,00.');
      return;
    }
    onSaveProduto(name, price, editingProdutoId);
    resetProduto();
  };

  const label = 'block text-slate-300 font-semibold mb-1';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="glass-card-static overflow-hidden">
        <div className="p-4 border-b border-[var(--graphite-border-subtle)]">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span>Clientes ({clientes.length})</span>
          </h2>
        </div>
        <form onSubmit={submitCliente} className="p-4 flex items-end gap-2.5 text-xs border-b border-[var(--graphite-border-subtle)]" aria-label="Cadastro de cliente">
          <div className="flex-1">
            <label htmlFor="mob-cad-cliente" className={label}>Nome do cliente *</label>
            <input id="mob-cad-cliente" type="text" required value={clienteName} onChange={(e) => setClienteName(e.target.value)} placeholder="Ex: Serraria Boa Vista" className={MAO_DE_OBRA_INPUT_CLASS} />
          </div>
          {editingClienteId && <button type="button" onClick={resetCliente} className="mac-button-secondary h-[34px]">Cancelar</button>}
          <button type="submit" className="mac-button-primary h-[34px]">{editingClienteId ? 'Salvar cliente' : 'Adicionar cliente'}</button>
        </form>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="mac-table-header">
              <th className="py-2.5 px-3">Nome</th>
              <th className="py-2.5 px-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
            {clientes.length === 0 ? (
              <tr><td colSpan={2} className="p-6 text-center text-slate-500 font-medium">Nenhum cliente cadastrado.</td></tr>
            ) : (
              byName(clientes).map((c) => (
                <tr key={c.id} className="mac-table-row">
                  <td className="py-2.5 px-3 font-semibold text-white">{c.name}</td>
                  <td className="py-2.5 px-3">
                    <RowActions label="cliente" onEdit={() => { setEditingClienteId(c.id); setClienteName(c.name); }} onDelete={() => onDeleteCliente(c)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-card-static overflow-hidden">
        <div className="p-4 border-b border-[var(--graphite-border-subtle)]">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Package className="w-4 h-4 text-blue-400" />
            <span>Produtos ({produtos.length})</span>
          </h2>
        </div>
        <form onSubmit={submitProduto} className="p-4 space-y-2 text-xs border-b border-[var(--graphite-border-subtle)]" aria-label="Cadastro de produto">
          <div className="flex items-end gap-2.5">
            <div className="flex-1">
              <label htmlFor="mob-cad-produto" className={label}>Nome do produto *</label>
              <input id="mob-cad-produto" type="text" required value={produtoName} onChange={(e) => setProdutoName(e.target.value)} placeholder="Ex: Descarga de tora" className={MAO_DE_OBRA_INPUT_CLASS} />
            </div>
            <div className="w-32">
              <label htmlFor="mob-cad-preco" className={label}>Preço por t (R$)</label>
              <input id="mob-cad-preco" type="text" inputMode="decimal" value={produtoPrice} onChange={(e) => setProdutoPrice(e.target.value)} placeholder="Ex: 150,00" className={`${MAO_DE_OBRA_INPUT_CLASS} font-mono`} />
            </div>
            {editingProdutoId && <button type="button" onClick={resetProduto} className="mac-button-secondary h-[34px]">Cancelar</button>}
            <button type="submit" className="mac-button-primary h-[34px]">{editingProdutoId ? 'Salvar produto' : 'Adicionar produto'}</button>
          </div>
          {produtoError && <p role="alert" className="text-[11px] font-semibold text-rose-400">{produtoError}</p>}
          <p className="text-[11px] text-slate-500">Mudar o preço vale só para lançamentos novos; os já registrados mantêm o valor gravado.</p>
        </form>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="mac-table-header">
              <th className="py-2.5 px-3">Nome</th>
              <th className="py-2.5 px-3 text-right">Preço/t</th>
              <th className="py-2.5 px-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
            {produtos.length === 0 ? (
              <tr><td colSpan={3} className="p-6 text-center text-slate-500 font-medium">Nenhum produto cadastrado.</td></tr>
            ) : (
              byName(produtos).map((p) => (
                <tr key={p.id} className="mac-table-row">
                  <td className="py-2.5 px-3 font-semibold text-white">{p.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{formatOptionalBRL(p.pricePerTon)}</td>
                  <td className="py-2.5 px-3">
                    <RowActions
                      label="produto"
                      onEdit={() => { setEditingProdutoId(p.id); setProdutoName(p.name); setProdutoPrice(formatBRLCurrencyInput(p.pricePerTon)); setProdutoError(''); }}
                      onDelete={() => onDeleteProduto(p)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
