import React, { useState, useEffect } from 'react';
import { TableType, CargaRecord, DepositoKlabinRecord, ResumoRecord, CaixaRecord, ProdutoRecord, ClientRecord, MotoristaRecord, UNIT_OF_MEASURE_OPTIONS } from '../types';
import { X, Save, AlertCircle, ShieldCheck } from 'lucide-react';
import { generateId } from '../utils/idGenerator';
import { normalizeIsoDate, normalizeIsoTimestamp, hasPaymentKeywordsInNotes } from '../utils/formatters';

interface RecordModalProps {
  isOpen: boolean;
  tableType: TableType;
  recordToEdit: any | null;
  onClose: () => void;
  onSave: (record: any) => void;
  produtos?: ProdutoRecord[];
  clientes?: ClientRecord[];
  motoristas?: MotoristaRecord[];
  freightRatePerTon?: number;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  tableType,
  recordToEdit,
  onClose,
  onSave,
  produtos = [],
  clientes = [],
  motoristas = [],
  freightRatePerTon = 15,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeProducts = produtos.filter((p) => p.status === 'ACTIVE');
  const productList = Array.from(
    new Set([
      ...activeProducts.map((p) => p.name),
      ...produtos.map((p) => p.name),
      'Eucalipto',
      'Pinus Taeda',
      'Pinus Elliottii',
      'Cavaco de Madeira',
      'Tora Eucalipto',
    ])
  );

  useEffect(() => {
    if (recordToEdit) {
      let resolvedDriverId = recordToEdit.motoristaId || recordToEdit.driverId;
      if (!resolvedDriverId && (recordToEdit.driverPlate || recordToEdit.licensePlate)) {
        const matched = motoristas.find(
          (m) =>
            m.id === recordToEdit.driverPlate ||
            `${m.name} / ${m.licensePlate}` === recordToEdit.driverPlate ||
            m.licensePlate === recordToEdit.licensePlate ||
            m.name === recordToEdit.driverPlate
        );
        if (matched) {
          resolvedDriverId = matched.id;
        }
      }
      setFormData({
        ...recordToEdit,
        motoristaId: resolvedDriverId || undefined,
        driverId: resolvedDriverId || undefined,
      });
    } else {
      // Default initial states per table
      const today = new Date().toISOString().slice(0, 10);
      switch (tableType) {
        case 'Cargas':
          setFormData({
            date: today,
            supplier: 'Klabin',
            product: 'Eucalipto',
            productId: activeProducts.find((p) => p.name === 'Eucalipto')?.id || '',
            quantityTons: 100,
            unitOfMeasure: 'ton',
            valuePerTon: 250,
            totalValue: 25000, // 100 * 250
            licensePlate: '',
            driverPlate: '',
            freightPayable: false,
            freightCost: 0,
            notes: '',
            deductFromBalance: true,
          });
          break;
        case 'Depositos_Klabin':
          setFormData({
            date: today,
            value: 100000,
            notes: '',
          });
          break;
        case 'Resumo':
          setFormData({
            metricName: '',
            metricValue: 0,
          });
          break;
        case 'Caixa':
          setFormData({
            balanceControlKlabin: '',
            value: 0,
          });
          break;
        case 'Clientes':
        case 'Gestao_Clientes':
          setFormData({
            name: '',
            contact: '',
            notes: '',
          });
          break;
        case 'Vendas':
          const firstClient = clientes[0];
          const firstProd = activeProducts[0];
          setFormData({
            date: today,
            clientId: firstClient?.id || '',
            clientName: firstClient?.name || '',
            productId: firstProd?.id || '',
            product: firstProd?.name || 'Eucalipto',
            quantity: 10,
            unitOfMeasure: firstProd?.unitOfMeasure || 'ton',
            unitPrice: firstProd ? Number(firstProd.referencePrice) : 250,
            totalValue: (firstProd ? Number(firstProd.referencePrice) : 250) * 10,
            status: 'PENDING',
            notes: '',
          });
          break;
      }
    }
    setErrors({});
  }, [recordToEdit, tableType, isOpen]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => {
      const updated = { ...prev, [field]: value };

      if (tableType === 'Cargas') {
        // Automatic Price, Unit of Measure, and Product ID based on Product selection
        if (field === 'product') {
          const matchedProd = produtos.find((p) => p.name === value);
          updated.productId = matchedProd?.id || '';
          const price = matchedProd ? Number(matchedProd.referencePrice) : (value === 'Pinus Taeda' ? 330 : 250);
          if (matchedProd?.unitOfMeasure) {
            updated.unitOfMeasure = matchedProd.unitOfMeasure;
          }
          updated.valuePerTon = price;
          const qty = Number(prev.quantityTons) || 0;
          updated.totalValue = Number((qty * price).toFixed(2));
        }

        // Auto-calculate Total Value and Freight Cost
        if (field === 'quantityTons' || field === 'valuePerTon' || field === 'freightPayable') {
          const qty = Number(field === 'quantityTons' ? value : prev.quantityTons) || 0;
          const price = Number(field === 'valuePerTon' ? value : prev.valuePerTon) || 0;
          const selectedDriverId = updated.motoristaId || updated.driverId || prev.motoristaId || prev.driverId;
          const isDriverSelected = Boolean(selectedDriverId && selectedDriverId !== 'NONE' && selectedDriverId !== 'nenhum');
          updated.totalValue = Number((qty * price).toFixed(2));
          updated.freightPayable = isDriverSelected;
          updated.freightCost = isDriverSelected ? Number((qty * freightRatePerTon).toFixed(2)) : 0;
        }

        if (field === 'driverPlate' && !prev.licensePlate) {
          updated.licensePlate = value;
        }
      }

      if (tableType === 'Vendas') {
        if (field === 'clientId') {
          const matchedCli = clientes.find((c) => c.id === value);
          if (matchedCli) {
            updated.clientName = matchedCli.name;
          }
        }
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = Number(field === 'quantity' ? value : prev.quantity) || 0;
          const price = Number(field === 'unitPrice' ? value : prev.unitPrice) || 0;
          updated.totalValue = Number((qty * price).toFixed(2));
          if (prev.driverId && prev.driverId !== 'NONE') {
            updated.freightCost = Number((qty * freightRatePerTon).toFixed(2));
          }
        }
        if (field === 'product') {
          const matchedProd = produtos.find((p) => p.name === value);
          updated.productId = matchedProd?.id || '';
          if (matchedProd) {
            updated.unitPrice = Number(matchedProd.referencePrice);
            if (matchedProd.unitOfMeasure) updated.unitOfMeasure = matchedProd.unitOfMeasure;
            const qty = Number(prev.quantity) || 0;
            updated.totalValue = Number((qty * Number(matchedProd.referencePrice)).toFixed(2));
            if (prev.driverId && prev.driverId !== 'NONE') {
              updated.freightCost = Number((qty * freightRatePerTon).toFixed(2));
            }
          }
        }
      }

      return updated;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (tableType === 'Cargas' || tableType === 'Motoristas') {
      if (!formData.product || !String(formData.product).trim()) {
        errs.product = 'Produto é obrigatório.';
      }
      const qty = Number(formData.quantityTons);
      if (isNaN(qty) || qty <= 0) {
        errs.quantityTons = 'Quantidade deve ser maior que zero.';
      }
      const valPerTon = Number(formData.valuePerTon);
      if (isNaN(valPerTon) || valPerTon <= 0) {
        errs.valuePerTon = 'Valor por tonelada deve ser maior que zero.';
      }
      const isPayable = formData.freightPayable === true || formData.freightPayable === 'YES' || formData.freightPayable === undefined;
      if (isPayable) {
        const freight = Number(formData.freightCost);
        if (isNaN(freight) || freight < 0) {
          errs.freightCost = 'Valor do frete é obrigatório para cargas com frete a pagar.';
        }
      }
    } else if (tableType === 'Depositos_Klabin') {
      if (!formData.date) errs.date = 'Data do depósito é obrigatória.';
      if (!formData.value || Number(formData.value) <= 0) {
        errs.value = 'Valor do depósito deve ser maior que zero.';
      }
    } else if (tableType === 'Resumo') {
      if (!formData.metricName) errs.metricName = 'Nome da métrica é obrigatório.';
      if (formData.metricValue === undefined || formData.metricValue === '') {
        errs.metricValue = 'Valor da métrica é obrigatório.';
      }
    } else if (tableType === 'Caixa') {
      if (!formData.balanceControlKlabin) errs.balanceControlKlabin = 'Descrição / Controle do Saldo é obrigatório.';
      if (formData.value === undefined || formData.value === '') errs.value = 'Valor é obrigatório.';
    } else if (tableType === 'Clientes' || tableType === 'Gestao_Clientes') {
      if (!formData.name || !String(formData.name).trim()) {
        errs.name = 'Nome do cliente é obrigatório.';
      }
    } else if (tableType === 'Vendas') {
      if (!formData.date) errs.date = 'Data da venda é obrigatória.';
      if (!formData.clientName || !String(formData.clientName).trim()) {
        errs.clientName = 'Nome do cliente é obrigatório.';
      }
      if (!formData.product || !String(formData.product).trim()) {
        errs.product = 'Produto é obrigatório.';
      }
      const qty = Number(formData.quantity);
      if (isNaN(qty) || qty <= 0) {
        errs.quantity = 'Quantidade deve ser maior que zero.';
      }
      const price = Number(formData.unitPrice);
      if (isNaN(price) || price <= 0) {
        errs.unitPrice = 'Preço unitário deve ser maior que zero.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      let finalFormData = { ...formData };
      if (tableType === 'Cargas' || tableType === 'Motoristas') {
        const todayStr = new Date().toISOString().slice(0, 10);
        finalFormData.date = normalizeIsoDate(finalFormData.date || todayStr);
        finalFormData.supplier = 'Klabin';
        delete finalFormData.supplierCnpj;
        delete finalFormData.transactionKey;
        finalFormData.product = finalFormData.product || 'Eucalipto';
        const matchedProd = produtos.find((p) => p.name === finalFormData.product);
        finalFormData.productId = finalFormData.productId || matchedProd?.id || undefined;
        finalFormData.quantityTons = finalFormData.quantityTons !== undefined && finalFormData.quantityTons !== '' ? Number(finalFormData.quantityTons) : 0;
        finalFormData.valuePerTon = finalFormData.valuePerTon !== undefined && finalFormData.valuePerTon !== '' ? Number(finalFormData.valuePerTon) : (finalFormData.product === 'Pinus Taeda' ? 330 : 250);
        finalFormData.totalValue = finalFormData.totalValue !== undefined && finalFormData.totalValue !== '' ? Number(finalFormData.totalValue) : Number(((finalFormData.quantityTons || 0) * (finalFormData.valuePerTon || 0)).toFixed(2));
        finalFormData.deductFromBalance = finalFormData.deductFromBalance === true || finalFormData.deductFromBalance === 'YES';
        
        const selectedDriverId = finalFormData.motoristaId || finalFormData.driverId;
        const isDriverSelected = Boolean(
          selectedDriverId && selectedDriverId !== 'NONE' && selectedDriverId !== 'nenhum'
        );

        if (isDriverSelected) {
          const matchedDriver = motoristas.find((m) => m.id === selectedDriverId);
          if (matchedDriver) {
            const qty = Number(finalFormData.quantityTons) || 0;
            const calculatedFreight = Number((qty * freightRatePerTon).toFixed(2));
            finalFormData.motoristaId = matchedDriver.id;
            finalFormData.driverId = matchedDriver.id;
            finalFormData.freightPayable = true;
            finalFormData.freightCost = calculatedFreight;
            finalFormData.freightStatus = finalFormData.freightStatus || 'PENDING';
            delete finalFormData.driverPlate;
            delete finalFormData.licensePlate;
          } else {
            finalFormData.motoristaId = undefined;
            finalFormData.driverId = undefined;
            finalFormData.freightPayable = false;
            finalFormData.freightCost = 0;
            delete finalFormData.driverPlate;
            delete finalFormData.licensePlate;
          }
        } else if (finalFormData.driverPlate) {
          const matchedDriver = motoristas.find(
            (m) =>
              `${m.name} / ${m.licensePlate}` === finalFormData.driverPlate ||
              m.licensePlate === finalFormData.licensePlate ||
              m.name === finalFormData.driverPlate
          );
          if (matchedDriver) {
            const qty = Number(finalFormData.quantityTons) || 0;
            const calculatedFreight = Number((qty * freightRatePerTon).toFixed(2));
            finalFormData.motoristaId = matchedDriver.id;
            finalFormData.driverId = matchedDriver.id;
            finalFormData.freightPayable = true;
            finalFormData.freightCost = calculatedFreight;
            finalFormData.freightStatus = finalFormData.freightStatus || 'PENDING';
            delete finalFormData.driverPlate;
            delete finalFormData.licensePlate;
          } else {
            finalFormData.motoristaId = undefined;
            finalFormData.driverId = undefined;
            finalFormData.freightPayable = false;
            finalFormData.freightCost = 0;
            delete finalFormData.driverPlate;
            delete finalFormData.licensePlate;
          }
        } else {
          finalFormData.motoristaId = undefined;
          finalFormData.driverId = undefined;
          finalFormData.freightPayable = false;
          finalFormData.freightCost = 0;
          delete finalFormData.driverPlate;
          delete finalFormData.licensePlate;
        }
      } else if (tableType === 'Vendas') {
        const todayStr = new Date().toISOString().slice(0, 10);
        finalFormData.date = normalizeIsoDate(finalFormData.date || todayStr);
        const matchedProd = produtos.find((p) => p.name === finalFormData.product);
        finalFormData.productId = finalFormData.productId || matchedProd?.id || undefined;
        const matchedCli = clientes.find((c) => c.id === finalFormData.clientId || c.name.toLowerCase() === (finalFormData.clientName || '').toLowerCase());
        finalFormData.clientId = finalFormData.clientId || matchedCli?.id || undefined;
        finalFormData.clientName = finalFormData.clientName || matchedCli?.name || 'Cliente Geral';
        finalFormData.status = finalFormData.status === 'PAID' ? 'PAID' : (finalFormData.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING');

        if (finalFormData.driverId && finalFormData.driverId !== 'NONE') {
          const matchedDriver = motoristas.find((m) => m.id === finalFormData.driverId);
          if (matchedDriver) {
            finalFormData.driverId = matchedDriver.id;
            finalFormData.motoristaId = matchedDriver.id;
            finalFormData.driverPlate = `${matchedDriver.name} / ${matchedDriver.licensePlate}`;
            finalFormData.licensePlate = matchedDriver.licensePlate;
            finalFormData.freightPayable = true;
            finalFormData.freightCost = Number(((finalFormData.quantity || 0) * freightRatePerTon).toFixed(2));
            finalFormData.freightStatus = finalFormData.freightStatus || 'PENDING';
          }
        } else {
          finalFormData.driverId = undefined;
          finalFormData.motoristaId = undefined;
          finalFormData.driverPlate = '';
          finalFormData.licensePlate = '';
          finalFormData.freightPayable = false;
          finalFormData.freightCost = 0;
        }
      } else if (finalFormData.date) {
        finalFormData.date = normalizeIsoDate(finalFormData.date);
      }

      // Build saved record with UUID-based ID and ISO createdAt timestamp
      const prefix = tableType.toLowerCase().slice(0, 3);
      const savedRecord = {
        ...finalFormData,
        id: finalFormData.id || generateId(prefix),
        createdAt: normalizeIsoTimestamp(finalFormData.createdAt || new Date().toISOString()),
      };

      onSave(savedRecord);
      onClose();
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="mac-hud max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-white/[0.02] px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-100 text-base">
              {recordToEdit ? `Editar Registro em ${tableType}` : `Novo Registro em ${tableType}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Preencha os campos abaixo de acordo com as especificações da tabela.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-white/[0.08] transition-colors active:scale-95"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Form Fields for TABLE 1: Cargas & Motoristas */}
          {(tableType === 'Cargas' || tableType === 'Motoristas') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Data da Compra</label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className="mac-input w-full"
                  />
                  {errors.date && <p className="text-[11px] text-rose-400 mt-1">{errors.date}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Produto (Preço Automático) *</label>
                  <select
                    value={formData.product || 'Eucalipto'}
                    onChange={(e) => handleChange('product', e.target.value)}
                    className="mac-input w-full font-medium text-emerald-400"
                  >
                    {productList.map((prod) => (
                      <option key={prod} value={prod}>
                        {prod}
                      </option>
                    ))}
                  </select>
                  {errors.product && <p className="text-[11px] text-rose-400 mt-1">{errors.product}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Motorista</label>
                  <select
                    value={formData.motoristaId || formData.driverId || 'NONE'}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (!selectedId || selectedId === 'NONE' || selectedId === 'nenhum') {
                        setFormData((prev: any) => {
                          const updated = { ...prev };
                          updated.motoristaId = undefined;
                          updated.driverId = undefined;
                          updated.freightPayable = false;
                          updated.freightCost = 0;
                          delete updated.driverPlate;
                          delete updated.licensePlate;
                          return updated;
                        });
                      } else {
                        const matched = motoristas.find((m) => m.id === selectedId);
                        if (matched) {
                          const qty = Number(formData.quantityTons) || 0;
                          const calculatedFreight = Number((qty * freightRatePerTon).toFixed(2));
                          setFormData((prev: any) => {
                            const updated = { ...prev };
                            updated.motoristaId = matched.id;
                            updated.driverId = matched.id;
                            updated.freightPayable = true;
                            updated.freightCost = calculatedFreight;
                            updated.freightStatus = prev.freightStatus || 'PENDING';
                            delete updated.driverPlate;
                            delete updated.licensePlate;
                            return updated;
                          });
                        }
                      }
                    }}
                    className="mac-input w-full font-medium text-slate-200"
                  >
                    <option value="NONE">Nenhum (Frete por conta do fornecedor)</option>
                    {motoristas
                      .filter((m) => m.status === 'ACTIVE')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.licensePlate}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 bg-white/5 p-3 rounded-xl border border-white/10">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Quantidade *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={formData.quantityTons ?? ''}
                    onChange={(e) => handleChange('quantityTons', parseFloat(e.target.value) || 0)}
                    className="mac-input w-full font-mono"
                  />
                  {errors.quantityTons && <p className="text-[10px] text-rose-400 mt-1 leading-tight">{errors.quantityTons}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Unidade</label>
                  <select
                    value={formData.unitOfMeasure || 'ton'}
                    onChange={(e) => handleChange('unitOfMeasure', e.target.value)}
                    className="mac-input w-full font-bold text-center"
                  >
                    {UNIT_OF_MEASURE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value} ({opt.label.split('(')[1]?.replace(')', '') || opt.value})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Preço Unit. (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="250"
                    value={formData.valuePerTon ?? ''}
                    onChange={(e) => handleChange('valuePerTon', parseFloat(e.target.value) || 0)}
                    className="mac-input w-full font-mono"
                  />
                  {errors.valuePerTon && <p className="text-[10px] text-rose-400 mt-1 leading-tight">{errors.valuePerTon}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={formData.totalValue ?? ''}
                    onChange={(e) => handleChange('totalValue', parseFloat(e.target.value) || 0)}
                    className="mac-input w-full font-bold text-emerald-400 border-emerald-500/40 font-mono"
                  />
                </div>
              </div>

              {/* Integrated Freight Block */}
              <div className="bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-emerald-300">Frete A Pagar? (R$ 15,00 / Tonelada)</label>
                  <div className="flex gap-3 items-center">
                    <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="freightPayable"
                        value="true"
                        checked={formData.freightPayable === true || formData.freightPayable === 'YES' || formData.freightPayable === undefined}
                        onChange={() => handleChange('freightPayable', true)}
                        className="text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-emerald-300">SIM</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="freightPayable"
                        value="false"
                        checked={formData.freightPayable === false || formData.freightPayable === 'NO'}
                        onChange={() => handleChange('freightPayable', false)}
                        className="text-slate-400 focus:ring-slate-500"
                      />
                      <span className="font-semibold text-slate-400">NÃO</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-emerald-500/20 text-xs font-mono">
                  <span className="text-slate-300 font-sans">Valor do Frete (R$):</span>
                  {(formData.freightPayable === true || formData.freightPayable === 'YES' || formData.freightPayable === undefined) ? (
                    <div className="flex flex-col items-end gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.freightCost ?? ''}
                        onChange={(e) => handleChange('freightCost', e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Ex: 2137.50"
                        className={`w-32 px-2 py-1 border rounded-lg text-xs font-mono font-bold text-right focus:ring-1 focus:outline-none ${
                          errors.freightCost ? 'border-rose-500 focus:ring-rose-200 bg-rose-500/20 text-rose-300' : 'border-emerald-500/40 focus:ring-emerald-500/40 bg-white/5 text-emerald-300'
                        }`}
                      />
                      {errors.freightCost && (
                        <p className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{errors.freightCost}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="font-bold text-slate-400 font-mono">R$ 0,00</span>
                  )}
                </div>
              </div>

              {/* Freight Status Block */}
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <label className="block text-xs font-bold text-slate-200 mb-1">Status do Frete</label>
                <select
                  value={formData.freightStatus || 'PENDING'}
                  onChange={(e) => handleChange('freightStatus', e.target.value)}
                  className="mac-input w-full font-bold text-slate-100"
                >
                  <option value="PENDING">PENDENTE</option>
                  <option value="PAID">PAGO / QUITADO</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Abater do Saldo Klabin?</label>
                <div className="flex gap-4 items-center mt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="deduct"
                      value="true"
                      checked={formData.deductFromBalance === true || formData.deductFromBalance === 'YES'}
                      onChange={() => handleChange('deductFromBalance', true)}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-emerald-300">SIM (Abater do Saldo)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="deduct"
                      value="false"
                      checked={formData.deductFromBalance === false || formData.deductFromBalance === 'NO'}
                      onChange={() => handleChange('deductFromBalance', false)}
                      className="text-slate-400 focus:ring-slate-500"
                    />
                    <span className="font-semibold text-slate-400">NÃO (Sem Abatimento)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Pátio de Madeira Monte Alegre, ordem de carregamento..."
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="mac-input w-full"
                />
                {hasPaymentKeywordsInNotes(formData.notes) && (formData.freightStatus === 'PENDING' || !formData.freightStatus) && (
                  <div className="mt-2 bg-amber-500/20 border border-amber-500/40 p-2.5 rounded-lg text-xs text-amber-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Atenção: A observação sugere pagamento, mas o status do frete está Pendente.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleChange('freightStatus', 'PAID')}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-[11px] shrink-0"
                    >
                      Marcar Frete PAGO
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Form Fields for TABLE 2: Depositos_Klabin */}
          {tableType === 'Depositos_Klabin' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Data do Depósito *</label>
                <input
                  type="date"
                  value={formData.date || ''}
                  onChange={(e) => handleChange('date', e.target.value)}
                  className="mac-input w-full"
                />
                {errors.date && <p className="text-[11px] text-rose-400 mt-1">{errors.date}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Valor do Depósito (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 350000"
                  value={formData.value ?? ''}
                  onChange={(e) => handleChange('value', parseFloat(e.target.value) || 0)}
                  className="mac-input w-full font-mono font-bold text-emerald-400"
                />
                {errors.value && <p className="text-[11px] text-rose-400 mt-1">{errors.value}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Observações / Comprovante</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Adiantamento Contratual Klabin S.A. - Ref. Quota de Madeira"
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="mac-input w-full"
                />
              </div>
            </>
          )}

          {/* Form Fields for TABLE 4: Resumo */}
          {tableType === 'Resumo' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Nome da Métrica *</label>
                <input
                  type="text"
                  placeholder="Ex: Total Volume Cargas (Toneladas)"
                  value={formData.metricName || ''}
                  onChange={(e) => handleChange('metricName', e.target.value)}
                  className="mac-input w-full"
                />
                {errors.metricName && <p className="text-[11px] text-rose-400 mt-1">{errors.metricName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Valor da Métrica (Número) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 741.50"
                  value={formData.metricValue ?? ''}
                  onChange={(e) => handleChange('metricValue', parseFloat(e.target.value) || 0)}
                  className="mac-input w-full font-mono font-bold text-emerald-400"
                />
                {errors.metricValue && <p className="text-[11px] text-rose-400 mt-1">{errors.metricValue}</p>}
              </div>
            </>
          )}

          {/* Form Fields for TABLE 5: Caixa */}
          {tableType === 'Caixa' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Controle de Saldo Klabin (Descrição) *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Adiantamento Depósitos Klabin ou Abatimento Cargas"
                  value={formData.balanceControlKlabin || ''}
                  onChange={(e) => handleChange('balanceControlKlabin', e.target.value)}
                  className="mac-input w-full"
                />
                {errors.balanceControlKlabin && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.balanceControlKlabin}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Valor (R$) * <span className="font-normal text-slate-400">(positivo para crédito, negativo para débito)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 150000 ou -25000"
                  value={formData.value ?? ''}
                  onChange={(e) => handleChange('value', parseFloat(e.target.value) || 0)}
                  className="mac-input w-full font-mono font-bold"
                />
                {errors.value && <p className="text-[11px] text-rose-400 mt-1">{errors.value}</p>}
              </div>
            </>
          )}

          {/* Form Fields for Clientes / Gestao_Clientes */}
          {(tableType === 'Clientes' || tableType === 'Gestao_Clientes') && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Nome do Cliente / Empresa *</label>
                <input
                  type="text"
                  placeholder="Ex: Serraria Paraná Ltda"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="mac-input w-full"
                />
                {errors.name && <p className="text-[11px] text-rose-400 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Contato / Telefone / E-mail</label>
                <input
                  type="text"
                  placeholder="Ex: (42) 99823-1100"
                  value={formData.contact || ''}
                  onChange={(e) => handleChange('contact', e.target.value)}
                  className="mac-input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Observações do cliente..."
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="mac-input w-full"
                />
              </div>
            </>
          )}

          {/* Form Fields for Vendas */}
          {tableType === 'Vendas' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Data da Venda *</label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className="mac-input w-full"
                  />
                  {errors.date && <p className="text-[11px] text-rose-400 mt-1">{errors.date}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Nome do Cliente *</label>
                  <input
                    type="text"
                    placeholder="Nome do cliente"
                    value={formData.clientName || ''}
                    onChange={(e) => handleChange('clientName', e.target.value)}
                    className="mac-input w-full font-bold"
                  />
                  {errors.clientName && <p className="text-[11px] text-rose-400 mt-1">{errors.clientName}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Produto *</label>
                  <select
                    value={formData.product || 'Eucalipto'}
                    onChange={(e) => handleChange('product', e.target.value)}
                    className="mac-input w-full font-semibold text-slate-100"
                  >
                    {productList.map((prod) => (
                      <option key={prod} value={prod}>
                        {prod}
                      </option>
                    ))}
                  </select>
                  {errors.product && <p className="text-[11px] text-rose-400 mt-1">{errors.product}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Status Quitação</label>
                  <select
                    value={formData.status || 'PENDING'}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="mac-input w-full font-bold"
                  >
                    <option value="PENDING">PENDENTE</option>
                    <option value="PAID">PAGO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Motorista</label>
                <select
                  value={formData.driverId || formData.motoristaId || 'NONE'}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (selectedId === 'NONE' || selectedId === 'nenhum') {
                      setFormData((prev: any) => ({
                        ...prev,
                        driverId: undefined,
                        motoristaId: undefined,
                        licensePlate: '',
                        driverPlate: '',
                        freightPayable: false,
                        freightCost: 0,
                      }));
                    } else {
                      const matched = motoristas.find((m) => m.id === selectedId);
                      if (matched) {
                        const formattedPlate = `${matched.name} / ${matched.licensePlate}`;
                        const qty = Number(formData.quantity) || 0;
                        setFormData((prev: any) => ({
                          ...prev,
                          driverId: matched.id,
                          motoristaId: matched.id,
                          licensePlate: matched.licensePlate,
                          driverPlate: formattedPlate,
                          freightPayable: true,
                          freightCost: prev.freightCost && prev.freightCost > 0 ? prev.freightCost : Number((qty * freightRatePerTon).toFixed(2)),
                          freightStatus: prev.freightStatus || 'PENDING',
                        }));
                      }
                    }
                  }}
                  className="mac-input w-full font-medium text-slate-100"
                >
                  <option value="NONE">Nenhum (Frete por conta do cliente / Sem motorista)</option>
                  {motoristas.filter((m) => m.status === 'ACTIVE').map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.licensePlate}
                    </option>
                  ))}
                </select>
              </div>

              {/* Integrated Freight Block for Vendas */}
              <div className="bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-emerald-300">Cobrar/Gerar Frete a Pagar a este Motorista? (R$ {freightRatePerTon.toFixed(2)} / Tonelada)</label>
                  <div className="flex gap-3 items-center">
                    <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="vendaFreightPayable"
                        value="true"
                        checked={formData.freightPayable === true || formData.freightPayable === 'YES'}
                        onChange={() => {
                          const qty = Number(formData.quantity) || 0;
                          setFormData((prev: any) => ({
                            ...prev,
                            freightPayable: true,
                            freightCost: prev.freightCost && prev.freightCost > 0 ? prev.freightCost : Number((qty * freightRatePerTon).toFixed(2)),
                          }));
                        }}
                        className="text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-emerald-300">SIM</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="vendaFreightPayable"
                        value="false"
                        checked={formData.freightPayable === false || formData.freightPayable === 'NO'}
                        onChange={() => {
                          setFormData((prev: any) => ({
                            ...prev,
                            freightPayable: false,
                            freightCost: 0,
                          }));
                        }}
                        className="text-slate-400 focus:ring-slate-500"
                      />
                      <span className="font-semibold text-slate-400">NÃO</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-emerald-500/20 text-xs font-mono">
                  <span className="text-slate-300 font-sans">Valor do Frete (R$):</span>
                  {(formData.freightPayable === true || formData.freightPayable === 'YES') ? (
                    <input
                      type="number"
                      step="0.01"
                      value={formData.freightCost ?? ''}
                      onChange={(e) => handleChange('freightCost', e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex: 150.00"
                      className="w-32 px-2 py-1 border rounded-lg text-xs font-mono font-bold text-right focus:ring-1 focus:outline-none border-emerald-500/40 focus:ring-emerald-500/40 bg-white/5 text-emerald-300"
                    />
                  ) : (
                    <span className="font-bold text-slate-400 font-mono">R$ 0,00</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 bg-white/5 p-3 rounded-xl border border-white/10">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Quantidade *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantity ?? ''}
                    onChange={(e) => {
                      const qty = parseFloat(e.target.value) || 0;
                      const price = Number(formData.unitPrice) || 0;
                      handleChange('quantity', qty);
                      handleChange('totalValue', Number((qty * price).toFixed(2)));
                    }}
                    className="mac-input w-full font-mono font-bold"
                  />
                  {errors.quantity && <p className="text-[10px] text-rose-400 mt-1 leading-tight">{errors.quantity}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Unidade</label>
                  <select
                    value={formData.unitOfMeasure || 'ton'}
                    onChange={(e) => handleChange('unitOfMeasure', e.target.value)}
                    className="mac-input w-full font-bold text-center"
                  >
                    {UNIT_OF_MEASURE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value} ({opt.label.split('(')[1]?.replace(')', '') || opt.value})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Preço Unit. (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unitPrice ?? ''}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value) || 0;
                      const qty = Number(formData.quantity) || 0;
                      handleChange('unitPrice', price);
                      handleChange('totalValue', Number((qty * price).toFixed(2)));
                    }}
                    className="mac-input w-full font-mono font-bold text-amber-300"
                  />
                  {errors.unitPrice && <p className="text-[10px] text-rose-400 mt-1 leading-tight">{errors.unitPrice}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-indigo-300 mb-1">Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.totalValue ?? ''}
                    onChange={(e) => handleChange('totalValue', parseFloat(e.target.value) || 0)}
                    className="mac-input w-full font-mono font-extrabold text-indigo-300"
                  />
                </div>
              </div>

              {/* Vendas Payment Status & Conciliation Transaction Key Block */}
              <div className="grid grid-cols-2 gap-3 bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Status do Pagamento</label>
                  <select
                    value={formData.status || 'PENDING'}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="mac-input w-full font-bold text-slate-100"
                  >
                    <option value="PENDING">PENDENTE</option>
                    <option value="PAID">PAGO / QUITADO</option>
                    <option value="CANCELLED">CANCELADO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Chave Transação / NSU (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: PIX-9102384 ou Comp-102"
                    value={formData.transactionKey || ''}
                    onChange={(e) => handleChange('transactionKey', e.target.value)}
                    className="mac-input w-full font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Observações da venda..."
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="mac-input w-full"
                />
                {hasPaymentKeywordsInNotes(formData.notes) && (formData.status === 'PENDING' || !formData.status) && (
                  <div className="mt-2 bg-amber-500/20 border border-amber-500/40 p-2.5 rounded-lg text-xs text-amber-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Atenção: A observação sugere pagamento, mas o status está Pendente.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleChange('status', 'PAID')}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-[11px] shrink-0"
                    >
                      Marcar PAGO
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Submit Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="mac-button-secondary text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mac-button-primary text-xs"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Registro'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
