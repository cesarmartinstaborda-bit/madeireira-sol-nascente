import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const node = (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#181c23] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] my-auto">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2.5 bg-rose-950/60 text-rose-400 rounded-xl border border-rose-800">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">{title}</h3>
        </div>

        <p className="text-xs text-slate-300 mb-6 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="mac-button-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-rose-900/30"
          >
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(node, document.body);
  }
  return node;
};
