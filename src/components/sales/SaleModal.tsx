import { Truck } from 'lucide-react';
import { createPortal } from 'react-dom';
import { formatBRLCurrencyInput, formatCurrency, parseBRLCurrency } from '../../utils/formatters';
import type { useSalesController } from './useSalesController';

type Props = {
  model: Pick<ReturnType<typeof useSalesController>,
    'showVendaModal'
    | 'editingVenda'
    | 'handleSaveVendaModal'
    | 'vendaDate'
    | 'setVendaDate'
    | 'vendaClientId'
    | 'setVendaClientId'
    | 'clientes'
    | 'produtos'
    | 'vendaProductId'
    | 'handleVendaProductSelectChange'
    | 'vendaQuantity'
    | 'handleVendaQuantityChange'
    | 'vendaUnitPrice'
    | 'setVendaUnitPrice'
    | 'vendaFreightPayable'
    | 'setVendaFreightPayable'
    | 'setVendaFreightCost'
    | 'freightRatePerTon'
    | 'motoristas'
    | 'vendaDriverId'
    | 'vendaDriverPlate'
    | 'setVendaDriverPlate'
    | 'handleVendaDriverSelectChange'
    | 'vendaFreightCost'
    | 'vendaNotes'
    | 'setVendaNotes'
    | 'setShowVendaModal'
  >;
};

export function SaleModal({ model }: Props) {
  const {
    showVendaModal,
    editingVenda,
    handleSaveVendaModal,
    vendaDate,
    setVendaDate,
    vendaClientId,
    setVendaClientId,
    clientes,
    produtos,
    vendaProductId,
    handleVendaProductSelectChange,
    vendaQuantity,
    handleVendaQuantityChange,
    vendaUnitPrice,
    setVendaUnitPrice,
    vendaFreightPayable,
    setVendaFreightPayable,
    setVendaFreightCost,
    freightRatePerTon,
    motoristas,
    vendaDriverId,
    vendaDriverPlate,
    setVendaDriverPlate,
    handleVendaDriverSelectChange,
    vendaFreightCost,
    vendaNotes,
    setVendaNotes,
    setShowVendaModal,
  } = model;
  return <>{showVendaModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#181c23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="text-base font-bold text-white mb-4">
              {editingVenda ? 'Editar Lançamento de Venda' : 'Lançar Nova Venda'}
            </h3>
            <form onSubmit={handleSaveVendaModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Data da Venda *</label>
                <input
                  type="date"
                  required
                  value={vendaDate}
                  onChange={(e) => setVendaDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cliente *</label>
                <select
                  value={vendaClientId}
                  onChange={(e) => setVendaClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                >
                  {clientes.length === 0 && <option value="">Nenhum cliente cadastrado</option>}
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Produto Vendido *</label>
                {(() => {
                  const activeVendaProducts = produtos.filter((p) => p.status === 'ACTIVE' || !p.status);
                  const displayVendaProducts = [...activeVendaProducts];
                  if (editingVenda && vendaProductId) {
                    const cur = produtos.find((p) => p.id === vendaProductId);
                    if (cur && cur.status === 'INACTIVE' && !displayVendaProducts.some((p) => p.id === cur.id)) {
                      displayVendaProducts.push(cur);
                    }
                  }

                  if (displayVendaProducts.length === 0) {
                    return (
                      <div className="p-2.5 bg-amber-950/50 border border-amber-800 rounded-xl text-amber-300 text-xs font-medium">
                        Nenhum produto ativo cadastrado no catálogo.
                      </div>
                    );
                  }

                  return (
                    <select
                      required
                      value={vendaProductId}
                      onChange={handleVendaProductSelectChange}
                      className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-medium"
                    >
                      {!vendaProductId && <option value="">Selecione um produto...</option>}
                      {displayVendaProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.status === 'INACTIVE' ? '(INATIVO)' : ''} — R$ {p.referencePrice}/{p.unitOfMeasure || 'ton'}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quantidade *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={vendaQuantity}
                    onChange={(e) => handleVendaQuantityChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Preço Unitário (R$) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={vendaUnitPrice}
                    onChange={(e) => setVendaUnitPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold font-mono"
                  />
                </div>
              </div>

              {/* Total Calculated Preview */}
              <div className="p-3 bg-[var(--graphite-surface-2)] border border-[var(--graphite-border-subtle)] rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">Total da Venda (Qtd × Preço):</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {formatCurrency((parseFloat(vendaQuantity) || 0) * (parseBRLCurrency(vendaUnitPrice) || 0))}
                </span>
              </div>

              {/* Frete Configuration */}
              <div className="p-3 bg-[var(--graphite-surface-2)] border border-[var(--graphite-border-subtle)] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-white font-bold flex items-center space-x-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Frete desta Venda</span>
                  </label>
                  <select
                    value={vendaFreightPayable}
                    onChange={(e) => {
                      const val = e.target.value as 'YES' | 'NO';
                      setVendaFreightPayable(val);
                      if (val === 'YES') {
                        const qtyNum = parseFloat(vendaQuantity) || 0;
                        setVendaFreightCost(formatBRLCurrencyInput(qtyNum * freightRatePerTon));
                      }
                    }}
                    className="px-2.5 py-1 text-xs bg-[#12151a] border border-[var(--graphite-border-base)] text-white rounded-lg font-semibold focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  >
                    <option value="NO">NÃO (Sem Frete)</option>
                    <option value="YES">SIM (Frete a Pagar)</option>
                  </select>
                </div>

                {vendaFreightPayable === 'YES' && (
                  <div className="space-y-2 pt-1 border-t border-[var(--graphite-border-subtle)]">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Motorista do Transporte</label>
                      {(() => {
                        const activeDrivers = motoristas.filter((m) => m.status === 'ACTIVE' || !m.status);
                        const displayDrivers = [...activeDrivers];
                        if (editingVenda && vendaDriverId) {
                          const cur = motoristas.find((m) => m.id === vendaDriverId);
                          if (cur && cur.status === 'INACTIVE' && !displayDrivers.some((p) => p.id === cur.id)) {
                            displayDrivers.push(cur);
                          }
                        }

                        if (displayDrivers.length === 0) {
                          return (
                            <input
                              type="text"
                              value={vendaDriverPlate}
                              onChange={(e) => setVendaDriverPlate(e.target.value)}
                              placeholder="Ex: João Silva / ABC-1234"
                              className="w-full px-3 py-1.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                            />
                          );
                        }

                        return (
                          <div className="space-y-1">
                            <select
                              value={vendaDriverId}
                              onChange={handleVendaDriverSelectChange}
                              className="w-full px-3 py-1.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                            >
                              <option value="">Selecione um motorista...</option>
                              {displayDrivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name} — Placa: {d.licensePlate} {d.status === 'INACTIVE' ? '(INATIVO)' : ''}
                                </option>
                              ))}
                            </select>
                            {!vendaDriverId && (
                              <input
                                type="text"
                                value={vendaDriverPlate}
                                onChange={(e) => setVendaDriverPlate(e.target.value)}
                                placeholder="Ou digite Motorista / Placa avulsa..."
                                className="w-full px-3 py-1 bg-[#12151a] border border-[var(--graphite-border-subtle)] rounded-xl text-slate-300 text-xs"
                              />
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Custo Frete a Pagar (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={vendaFreightCost}
                        onChange={(e) => setVendaFreightCost(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl focus:outline-none focus:border-[var(--graphite-accent-blue)] font-bold text-blue-400 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={vendaNotes}
                  onChange={(e) => setVendaNotes(e.target.value)}
                  placeholder="Observações do pedido"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-[var(--graphite-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowVendaModal(false)}
                  className="mac-button-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mac-button-primary"
                >
                  Salvar Venda
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}</>;
}
