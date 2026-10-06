import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CargaRecord } from '../types';
import type { CargaAttachmentHandlers } from '../hooks/useCargaAttachmentHandlers';
import { formatDateBR, formatNumber } from '../utils/formatters';
import { CargaAttachmentsSection } from './CargaAttachmentsSection';

interface CargaAttachmentsModalProps {
  carga: CargaRecord;
  /** Competência da carga trancada: listar, abrir e exportar seguem liberados; adicionar e excluir não. */
  locked: boolean;
  handlers: CargaAttachmentHandlers;
  onClose: () => void;
}

/**
 * Janela "Anexos da carga", aberta pelo clipe da tabela. Reaproveita a seção do formulário de
 * carga e é o único caminho para ver os PDFs de uma carga de mês trancado, cujo formulário de
 * edição não abre.
 */
export const CargaAttachmentsModal: React.FC<CargaAttachmentsModalProps> = ({ carga, locked, handlers, onClose }) => {
  const savedRef = useRef(true); // carga já existe: nada a descartar ao fechar

  const node = (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-label="Anexos da carga"
        className="bg-[#181c23] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] max-h-[90vh] overflow-y-auto my-auto"
      >
        <div className="flex items-start justify-between pb-3 mb-4 border-b border-[var(--graphite-border-subtle)]">
          <div>
            <h3 className="text-base font-bold text-white">Anexos da carga</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {formatDateBR(carga.date)} · {carga.product || '-'} · {formatNumber(carga.quantityTons, 2)} t
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs">
          <CargaAttachmentsSection
            cargaId={carga.id}
            isNewCarga={false}
            date={carga.date}
            locked={locked}
            handlers={handlers}
            savedRef={savedRef}
          />
        </div>

        <div className="pt-3 mt-4 flex justify-end border-t border-[var(--graphite-border-subtle)]">
          <button type="button" onClick={onClose} className="mac-button-secondary">Fechar</button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
};
