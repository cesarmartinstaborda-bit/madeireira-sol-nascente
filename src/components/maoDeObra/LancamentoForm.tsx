import React, { useRef, useState } from 'react';
import { MaoDeObraClienteRecord, MaoDeObraLancamentoRecord, MaoDeObraProdutoRecord } from '../../types';
import { MaoDeObraLancamentoInput } from '../../hooks/useMaoDeObraHandlers';
import { formatBRLCurrencyInput, parseBRLCurrency } from '../../utils/formatters';
import { calcMaoDeObraTotal, formatDecimalInput, formatOptionalBRL, parseDecimalBR } from '../../utils/maoDeObra';

export const MAO_DE_OBRA_INPUT_CLASS =
  'w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]';

interface LancamentoFormProps {
  clientes: MaoDeObraClienteRecord[];
  produtos: MaoDeObraProdutoRecord[];
  /** Lançamento em edição; ausente = formulário rápido de lançamento novo. */
  record?: MaoDeObraLancamentoRecord;
  onSubmit: (input: MaoDeObraLancamentoInput) => boolean;
  onCancel?: () => void;
}

/** Garante que o cadastro excluído de um lançamento antigo continue selecionado. */
function withMissingOption<T extends { id: string; name: string }>(list: T[], id: string | null, name: string | null) {
  if (!id || list.some((item) => item.id === id)) return list.map((item) => ({ id: item.id, name: item.name }));
  return [...list.map((item) => ({ id: item.id, name: item.name })), { id, name: `${name || 'Sem nome'} (excluído)` }];
}

export const LancamentoForm: React.FC<LancamentoFormProps> = ({ clientes, produtos, record, onSubmit, onCancel }) => {
  const isEdit = Boolean(record);
  const productPrice = (id: string) => produtos.find((p) => p.id === id)?.pricePerTon ?? null;

  const [clientId, setClientId] = useState(record?.clientId || '');
  const [productId, setProductId] = useState(record?.productId || '');
  const [date, setDate] = useState(record?.date || '');
  const [tonsText, setTonsText] = useState(formatDecimalInput(record?.quantityTons ?? null, 6));
  // Preço gravado no lançamento prevalece sobre o cadastro: alterar o produto depois não muda o histórico.
  const initialPrice = record ? record.pricePerTon ?? (record.productId ? productPrice(record.productId) : null) : null;
  const [pricePerTon, setPricePerTon] = useState<number | null>(initialPrice);
  const [manual, setManual] = useState(record?.totalValueManual ?? false);
  // O campo já abre com o valor que será gravado: manual como está; automático, recalculado.
  const initialTotal = record
    ? record.totalValueManual ? record.totalValue : calcMaoDeObraTotal(record.quantityTons, initialPrice)
    : null;
  const [totalText, setTotalText] = useState(initialTotal === null ? '' : formatBRLCurrencyInput(initialTotal));
  const [error, setError] = useState('');
  const tonsRef = useRef<HTMLInputElement>(null);

  const recalc = (nextTonsText: string, nextPrice: number | null, isManual = manual) => {
    if (isManual) return;
    const tons = parseDecimalBR(nextTonsText);
    const total = Number.isNaN(tons) ? null : calcMaoDeObraTotal(tons, nextPrice);
    setTotalText(total === null ? '' : formatBRLCurrencyInput(total));
  };

  const handleTonsChange = (value: string) => {
    setTonsText(value);
    recalc(value, pricePerTon);
  };

  const handleProductChange = (id: string) => {
    setProductId(id);
    const price = id ? productPrice(id) : null;
    setPricePerTon(price);
    recalc(tonsText, price);
  };

  // Digitar no valor o torna manual; apagar o campo volta ao cálculo automático.
  const handleTotalChange = (value: string) => {
    const isManual = value.trim() !== '';
    setManual(isManual);
    setTotalText(value);
    if (!isManual) recalc(tonsText, pricePerTon, false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const tons = parseDecimalBR(tonsText);
    if (Number.isNaN(tons)) return setError('Toneladas inválidas. Use números, por exemplo 12,5.');
    const typedTotal = totalText.trim() ? parseBRLCurrency(totalText) : null;
    if (typedTotal !== null && (Number.isNaN(typedTotal) || typedTotal < 0)) {
      return setError('Valor total inválido. Use o formato 1.800,00.');
    }
    const price = productId ? pricePerTon : null;
    const totalValue = manual ? typedTotal : calcMaoDeObraTotal(tons, price);
    if (!clientId && !productId && !date && tons === null && totalValue === null) {
      return setError('Preencha pelo menos um campo para registrar o lançamento.');
    }

    const cliente = clientes.find((c) => c.id === clientId);
    const produto = produtos.find((p) => p.id === productId);
    const saved = onSubmit({
      clientId: clientId || null,
      clientName: cliente?.name ?? (clientId && clientId === record?.clientId ? record.clientName : null),
      productId: productId || null,
      productName: produto?.name ?? (productId && productId === record?.productId ? record.productName : null),
      date: date || null,
      quantityTons: tons,
      pricePerTon: price,
      totalValue,
      totalValueManual: manual && totalValue !== null,
    });

    // No lançamento rápido, cliente, produto e data ficam para o próximo registro.
    if (saved && !isEdit) {
      setTonsText('');
      setManual(false);
      setTotalText('');
      tonsRef.current?.focus();
    }
  };

  const clienteOptions = withMissingOption(clientes, record?.clientId ?? null, record?.clientName ?? null);
  const produtoOptions = withMissingOption(produtos, record?.productId ?? null, record?.productName ?? null);
  const label = 'block text-slate-300 font-semibold mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs" aria-label={isEdit ? 'Editar lançamento' : 'Novo lançamento'}>
      <div className={`grid gap-2.5 ${isEdit ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-6 items-end'}`}>
        <div>
          <label htmlFor={`mob-tons-${record?.id || 'novo'}`} className={label}>Toneladas</label>
          <input
            id={`mob-tons-${record?.id || 'novo'}`}
            ref={tonsRef}
            type="text"
            inputMode="decimal"
            value={tonsText}
            onChange={(e) => handleTonsChange(e.target.value)}
            placeholder="Ex: 12,5"
            className={`${MAO_DE_OBRA_INPUT_CLASS} font-mono font-bold`}
          />
        </div>
        <div>
          <label htmlFor={`mob-cliente-${record?.id || 'novo'}`} className={label}>Cliente</label>
          <select id={`mob-cliente-${record?.id || 'novo'}`} value={clientId} onChange={(e) => setClientId(e.target.value)} className={MAO_DE_OBRA_INPUT_CLASS}>
            <option value="">Sem cliente</option>
            {clienteOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`mob-produto-${record?.id || 'novo'}`} className={label}>Produto</label>
          <select id={`mob-produto-${record?.id || 'novo'}`} value={productId} onChange={(e) => handleProductChange(e.target.value)} className={MAO_DE_OBRA_INPUT_CLASS}>
            <option value="">Sem produto</option>
            {produtoOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`mob-data-${record?.id || 'novo'}`} className={label}>Data</label>
          <input id={`mob-data-${record?.id || 'novo'}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={MAO_DE_OBRA_INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor={`mob-valor-${record?.id || 'novo'}`} className={label}>Valor total (R$)</label>
          <input
            id={`mob-valor-${record?.id || 'novo'}`}
            type="text"
            inputMode="decimal"
            value={totalText}
            onChange={(e) => handleTotalChange(e.target.value)}
            placeholder="Opcional"
            className={`${MAO_DE_OBRA_INPUT_CLASS} font-mono`}
          />
        </div>
        {!isEdit && (
          <button type="submit" className="mac-button-primary justify-center h-[34px]">Lançar</button>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        {manual
          ? 'Valor informado manualmente; apague o campo para voltar ao cálculo automático.'
          : productId && pricePerTon !== null
            ? `Valor calculado: toneladas × ${formatOptionalBRL(pricePerTon)}/t.`
            : 'Nenhum campo é obrigatório. Com produto e toneladas, o valor é calculado.'}
      </p>
      {error && <p role="alert" className="text-[11px] font-semibold text-rose-400">{error}</p>}

      {isEdit && (
        <div className="pt-3 flex items-center justify-end space-x-2 border-t border-[var(--graphite-border-subtle)]">
          <button type="button" onClick={onCancel} className="mac-button-secondary">Cancelar</button>
          <button type="submit" className="mac-button-primary">Salvar lançamento</button>
        </div>
      )}
    </form>
  );
};
