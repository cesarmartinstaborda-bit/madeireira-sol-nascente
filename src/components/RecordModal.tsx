import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TableType, ProdutoRecord, ClientRecord, MotoristaRecord } from '../types';
import { generateId } from '../utils/idGenerator';
import { formatBRLCurrencyInput, formatCurrency, parseBRLCurrency } from '../utils/formatters';
import { X, Save, AlertCircle } from 'lucide-react';

interface RecordModalProps {
  isOpen: boolean;
  tableType: TableType;
  recordToEdit: any | null;
  onClose: () => void;
  onSave: (savedRecord: any) => boolean | void;
  produtos: ProdutoRecord[];
  clientes: ClientRecord[];
  motoristas: MotoristaRecord[];
  freightRatePerTon: number;
  defaultDeductFromBalance?: boolean;
  defaultCargoFreightPayable?: boolean;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  tableType,
  recordToEdit,
  onClose,
  onSave,
  produtos,
  clientes,
  motoristas,
  freightRatePerTon,
  defaultDeductFromBalance = true,
  defaultCargoFreightPayable = true,
}) => {
  const isDeposito = tableType === 'Depositos_Klabin';

  // Common date
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Carga fields
  const [selectedProductId, setSelectedProductId] = useState('');
  const [product, setProduct] = useState('');
  const [quantityTons, setQuantityTons] = useState('40');
  const [valuePerTon, setValuePerTon] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverPlate, setDriverPlate] = useState('');
  const [freightPayable, setFreightPayable] = useState<'YES' | 'NO'>('YES');
  const [freightCost, setFreightCost] = useState('');
  const [deductFromBalance, setDeductFromBalance] = useState<'YES' | 'NO'>('YES');

  // Depósito fields
  const [value, setValue] = useState('10000');
  const [notes, setNotes] = useState('');

  // Populate form fields on recordToEdit change
  useEffect(() => {
    if (recordToEdit) {
      if (recordToEdit.date) setDate(recordToEdit.date.split('T')[0]);

      // Historical product & productId resolution
      const editProdName = recordToEdit.product || '';
      setProduct(editProdName);

      const matchedProd =
        produtos.find((p) => p.id === recordToEdit.productId) ||
        produtos.find((p) => p.name.trim().toLowerCase() === editProdName.trim().toLowerCase());

      setSelectedProductId(matchedProd?.id || recordToEdit.productId || '');

      // Preserve historical price intact on edit
      if (recordToEdit.valuePerTon !== undefined && recordToEdit.valuePerTon !== null) {
        setValuePerTon(formatBRLCurrencyInput(recordToEdit.valuePerTon));
      } else if (matchedProd) {
        setValuePerTon(formatBRLCurrencyInput(matchedProd.referencePrice));
      } else {
        setValuePerTon('');
      }

      if (recordToEdit.quantityTons !== undefined) setQuantityTons(String(recordToEdit.quantityTons));

      // Resolve driver
      const dId = recordToEdit.driverId || recordToEdit.motoristaId || '';
      const matchedDriver =
        motoristas.find((m) => m.id === dId) ||
        motoristas.find((m) => recordToEdit.licensePlate && m.licensePlate === recordToEdit.licensePlate) ||
        motoristas.find((m) => recordToEdit.driverPlate && recordToEdit.driverPlate.includes(m.licensePlate));

      setSelectedDriverId(matchedDriver?.id || dId || '');
      setDriverPlate(recordToEdit.driverPlate || (matchedDriver ? `${matchedDriver.name} / ${matchedDriver.licensePlate}` : ''));

      if (recordToEdit.freightPayable) setFreightPayable(recordToEdit.freightPayable === 'NO' ? 'NO' : 'YES');
      if (recordToEdit.freightCost !== undefined && recordToEdit.freightCost !== null) {
        setFreightCost(formatBRLCurrencyInput(recordToEdit.freightCost));
      } else {
        const t = parseFloat(recordToEdit.quantityTons) || 0;
        setFreightCost(String(t * freightRatePerTon));
      }
      if (recordToEdit.deductFromBalance !== undefined && recordToEdit.deductFromBalance !== null) {
        const isDeduct = recordToEdit.deductFromBalance === 'YES' || recordToEdit.deductFromBalance === true;
        setDeductFromBalance(isDeduct ? 'YES' : 'NO');
      } else {
        setDeductFromBalance('YES');
      }

      if (recordToEdit.value !== undefined) setValue(formatBRLCurrencyInput(recordToEdit.value));
      if (recordToEdit.notes) setNotes(recordToEdit.notes);
    } else {
      setDate(new Date().toISOString().split('T')[0]);

      // Auto-select first active product for new Carga and suggest its price
      const activeProds = produtos.filter((p) => p.status === 'ACTIVE' || !p.status);
      if (activeProds.length > 0) {
        const first = activeProds[0];
        setSelectedProductId(first.id);
        setProduct(first.name);
        setValuePerTon(formatBRLCurrencyInput(first.referencePrice));
      } else {
        setSelectedProductId('');
        setProduct('');
        setValuePerTon('');
      }

      setQuantityTons('40');
      setSelectedDriverId('');
      setDriverPlate('');

      const shouldPayFreight = defaultCargoFreightPayable !== false;
      setFreightPayable(shouldPayFreight ? 'YES' : 'NO');
      setFreightCost(formatBRLCurrencyInput(shouldPayFreight ? 40 * freightRatePerTon : 0));
      setDeductFromBalance(defaultDeductFromBalance ? 'YES' : 'NO');
      setValue('');
      setNotes('');
    }
  }, [recordToEdit, produtos, motoristas, freightRatePerTon, defaultDeductFromBalance, defaultCargoFreightPayable]);

  if (!isOpen) return null;

  // Handle explicit product selection change - auto-populate suggested reference price
  const handleProductSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProdId = e.target.value;
    setSelectedProductId(newProdId);
    const selectedProd = produtos.find((p) => p.id === newProdId);
    if (selectedProd) {
      setProduct(selectedProd.name);
      setValuePerTon(formatBRLCurrencyInput(selectedProd.referencePrice));
    } else {
      setProduct('');
      setValuePerTon('');
    }
  };

  // Handle driver selection change
  const handleDriverSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const driverId = e.target.value;
    setSelectedDriverId(driverId);
    const matched = motoristas.find((m) => m.id === driverId);
    if (matched) {
      setDriverPlate(`${matched.name} / ${matched.licensePlate}`);
    } else {
      setDriverPlate('');
    }
  };

  // Recalculate freight cost suggestion on quantity change
  const handleQuantityChange = (val: string) => {
    setQuantityTons(val);
    const tons = parseFloat(val) || 0;
    setFreightCost(formatBRLCurrencyInput(tons * freightRatePerTon));
  };

  // Available products: active ones, plus the currently selected inactive product if editing
  const activeProducts = produtos.filter((p) => p.status === 'ACTIVE' || !p.status);
  const displayProducts = [...activeProducts];
  if (recordToEdit && selectedProductId) {
    const cur = produtos.find((p) => p.id === selectedProductId);
    if (cur && cur.status === 'INACTIVE' && !displayProducts.some((p) => p.id === cur.id)) {
      displayProducts.push(cur);
    }
  }

  // Available drivers: active ones, plus the currently selected inactive driver if editing
  const activeDrivers = motoristas.filter((m) => m.status === 'ACTIVE' || !m.status);
  const displayDrivers = [...activeDrivers];
  if (recordToEdit && selectedDriverId) {
    const cur = motoristas.find((m) => m.id === selectedDriverId);
    if (cur && cur.status === 'INACTIVE' && !displayDrivers.some((m) => m.id === cur.id)) {
      displayDrivers.push(cur);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isDeposito) {
      const depVal = parseBRLCurrency(value);
      if (isNaN(depVal) || depVal <= 0) {
        alert('Informe um valor de depósito válido.');
        return;
      }
      const success = onSave({
        id: recordToEdit?.id || generateId('dep'),
        date,
        value: depVal,
        notes: notes.trim(),
      });
      if (success !== false) {
        onClose();
      }
    } else {
      // Product is strictly mandatory for Cargas
      if (!product.trim() && !selectedProductId) {
        alert('Selecione um produto de madeira cadastrado antes de salvar a carga.');
        return;
      }

      const tons = parseFloat(quantityTons) || 0;
      const vPerTon = parseBRLCurrency(valuePerTon) || 0;
      const totalVal = tons * vPerTon;
      const fCost = freightPayable === 'YES' ? parseBRLCurrency(freightCost) || (tons * freightRatePerTon) : 0;

      // Extract driver info if selected
      const matchedDriver =
        motoristas.find((m) => m.id === selectedDriverId) ||
        motoristas.find((m) => `${m.name} / ${m.licensePlate}` === driverPlate);

      const matchedProduct =
        produtos.find((p) => p.id === selectedProductId) ||
        produtos.find((p) => p.name.trim().toLowerCase() === product.trim().toLowerCase());

      const success = onSave({
        id: recordToEdit?.id || generateId('crg'),
        date,
        invoiceNumber: recordToEdit?.invoiceNumber || '',
        supplier: recordToEdit?.supplier || 'Klabin',
        supplierCnpj: recordToEdit?.supplierCnpj || '',
        product: (product || matchedProduct?.name || '').trim(),
        productId: selectedProductId || matchedProduct?.id || undefined,
        unitOfMeasure: matchedProduct?.unitOfMeasure || 'ton',
        quantityTons: tons,
        valuePerTon: vPerTon,
        totalValue: totalVal,
        driverPlate: (driverPlate || (matchedDriver ? `${matchedDriver.name} / ${matchedDriver.licensePlate}` : '')).trim(),
        licensePlate: matchedDriver?.licensePlate || undefined,
        driverId: matchedDriver?.id || selectedDriverId || undefined,
        motoristaId: matchedDriver?.id || selectedDriverId || undefined,
        freightPayable,
        freightCost: fCost,
        freightStatus: recordToEdit?.freightStatus || 'PENDING',
        freightPaidAt: recordToEdit?.freightPaidAt,
        transactionKey: recordToEdit?.transactionKey,
        deductFromBalance,
        notes: notes.trim(),
      });

      if (success !== false) {
        onClose();
      }
    }
  };

  const modalNode = (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#181c23] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] max-h-[90vh] overflow-y-auto my-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--graphite-border-subtle)]">
          <h3 className="text-base font-bold text-white">
            {isDeposito
              ? recordToEdit
                ? 'Editar Depósito Klabin'
                : 'Novo Depósito Klabin'
              : recordToEdit
              ? 'Editar Carga de Madeira'
              : 'Nova Carga de Madeira'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {isDeposito ? 'Data do Depósito *' : 'Data do Lançamento *'}
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
            />
          </div>

          {isDeposito ? (
            <>
              <div>
                <label htmlFor="deposit-value" className="block text-slate-300 font-semibold mb-1">Valor do Depósito (R$) *</label>
                <input
                  id="deposit-value"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observações / Comprovante</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais de adiantamento Klabin"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Produto de Madeira *</label>
                {displayProducts.length === 0 ? (
                  <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl text-amber-200 text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Nenhum produto ativo cadastrado.</p>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        Cadastre um produto no Catálogo de Produtos antes de lançar uma carga.
                      </p>
                    </div>
                  </div>
                ) : (
                  <select
                    required
                    value={selectedProductId}
                    onChange={handleProductSelectChange}
                    className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-medium"
                  >
                    {!selectedProductId && <option value="">Selecione um produto...</option>}
                    {displayProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.status === 'INACTIVE' ? '(INATIVO)' : ''} — R$ {p.referencePrice}/{p.unitOfMeasure || 'ton'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quantidade (Toneladas) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={quantityTons}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Valor por Tonelada (R$) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={valuePerTon}
                    onChange={(e) => setValuePerTon(e.target.value)}
                    className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold font-mono"
                  />
                </div>
              </div>

              {/* Total Calculated Preview */}
              <div className="p-3 bg-[var(--graphite-surface-2)] border border-[var(--graphite-border-subtle)] rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">Total da Carga (Qtd × R$/Ton):</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {formatCurrency((parseFloat(quantityTons) || 0) * (parseBRLCurrency(valuePerTon) || 0))}
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Motorista do Transporte</label>
                {displayDrivers.length === 0 ? (
                  <input
                    type="text"
                    value={driverPlate}
                    onChange={(e) => setDriverPlate(e.target.value)}
                    placeholder="Ex: João Silva / ABC-1234"
                    className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-medium"
                  />
                ) : (
                  <div className="space-y-1.5">
                    <select
                      value={selectedDriverId}
                      onChange={handleDriverSelectChange}
                      className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-medium"
                    >
                      <option value="">Selecione um motorista cadastrado...</option>
                      {displayDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} — Placa: {d.licensePlate} {d.status === 'INACTIVE' ? '(INATIVO)' : ''}
                        </option>
                      ))}
                    </select>
                    {!selectedDriverId && (
                      <input
                        type="text"
                        value={driverPlate}
                        onChange={(e) => setDriverPlate(e.target.value)}
                        placeholder="Ou digite Motorista / Placa avulsa..."
                        className="w-full px-3 py-1.5 bg-[#12151a] border border-[var(--graphite-border-subtle)] rounded-xl text-slate-300 text-xs focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Frete a Pagar?</label>
                  <select
                    value={freightPayable}
                    onChange={(e) => setFreightPayable(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  >
                    <option value="YES">SIM</option>
                    <option value="NO">NÃO (Sem Frete)</option>
                  </select>
                </div>

                {freightPayable === 'YES' && (
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Custo Frete (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={freightCost}
                      onChange={(e) => setFreightCost(e.target.value)}
                      className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-blue-400 font-mono font-bold focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Abater do Saldo Klabin?</label>
                <select
                  value={deductFromBalance}
                  onChange={(e) => setDeductFromBalance(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold"
                >
                  <option value="YES">SIM (Diminui o Saldo Klabin)</option>
                  <option value="NO">NÃO (Não Altera Saldo)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas sobre a carga"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              {/* Static Fornecedor Info */}
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--graphite-surface-2)] border border-[var(--graphite-border-subtle)] rounded-xl text-xs">
                <span className="text-slate-400 font-medium">Fornecedor</span>
                <span className="text-white font-bold tracking-wide">Klabin</span>
              </div>
            </>
          )}

          <div className="pt-3 flex items-center justify-end space-x-2 border-t border-[var(--graphite-border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="mac-button-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isDeposito && displayProducts.length === 0}
              className="mac-button-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>{isDeposito ? 'Salvar Depósito' : 'Salvar Carga'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
};
