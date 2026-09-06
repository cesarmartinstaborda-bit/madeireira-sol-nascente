import { AlertCircle, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatters';
import type { useSalesController } from './useSalesController';

type Props = {
  model: Pick<ReturnType<typeof useSalesController>,
    'vendaToRevert'
    | 'setVendaToRevert'
    | 'handleConfirmRevert'
  >;
};

export function RevertSaleModal({ model }: Props) {
  const { vendaToRevert, setVendaToRevert, handleConfirmRevert } = model;
  return <>{vendaToRevert && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#181c23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--graphite-border-base)]">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-amber-950/80 border border-amber-700 rounded-xl text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Reverter venda para pendente?</h3>
                <p className="text-xs text-slate-400">Ela voltará a aparecer na lista de cobranças.</p>
              </div>
            </div>

            <div className="p-3 bg-[var(--graphite-surface-2)] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1 mb-4 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Cliente:</span>
                <span className="font-bold text-white">{vendaToRevert.clientName}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Produto:</span>
                <span className="text-slate-200">{vendaToRevert.product}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Valor:</span>
                <span className="font-bold text-emerald-400 font-mono">{formatCurrency(vendaToRevert.totalValue)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setVendaToRevert(null)}
                className="mac-button-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all shadow-md flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reverter para pendente</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}</>;
}
