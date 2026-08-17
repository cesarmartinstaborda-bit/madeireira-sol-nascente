import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4">
      <div className="mac-hud max-w-sm w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-11 h-11 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/25 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <h3 className="font-bold text-slate-100 text-base">{title}</h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{message}</p>

        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={onClose}
            className="mac-button-secondary text-xs px-4 py-2"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="mac-button-danger text-xs px-4 py-2 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Confirmar Exclusão</span>
          </button>
        </div>
      </div>
    </div>
  );
};
