import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Lock, Paperclip, Plus, Trash2 } from 'lucide-react';
import { CargaAttachment } from '../types';
import type { CargaAttachmentHandlers } from '../hooks/useCargaAttachmentHandlers';
import { discardCargaAttachments, isLocalAttachmentsAvailable } from '../utils/cargaAttachments';

interface CargaAttachmentsSectionProps {
  /** Id da carga: o da carga salva ou, no formulário de carga nova, o id reservado para ela. */
  cargaId: string;
  /** `true` no formulário de carga nova: a carga ainda não existe no banco. */
  isNewCarga: boolean;
  /** Data do formulário, usada na regra de mês trancado de uma carga ainda não salva. */
  date: string;
  /** Mês da data do formulário está trancado no Fechamento de Ciclo. */
  locked: boolean;
  handlers: CargaAttachmentHandlers;
  /** Marcado pelo formulário quando a carga foi salva (nesse caso os anexos ficam). */
  savedRef: React.MutableRefObject<boolean>;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Seção "Anexos" do formulário de carga: PDFs guardados somente neste computador.
 *
 * As operações valem na hora (copiar, abrir, exportar, excluir), inclusive na edição. Numa carga
 * nova, os PDFs ficam numa pasta reservada para o id que a carga terá ao ser salva; se o
 * formulário for fechado sem salvar, essa pasta é apagada.
 */
export const CargaAttachmentsSection: React.FC<CargaAttachmentsSectionProps> = ({
  cargaId,
  isNewCarga,
  date,
  locked,
  handlers,
  savedRef,
}) => {
  const available = isLocalAttachmentsAvailable();
  const [items, setItems] = useState<CargaAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Mantém a lista atual acessível ao efeito de saída (limpeza da pasta provisória).
  const itemsRef = useRef<CargaAttachment[]>([]);
  itemsRef.current = items;
  // Adição em andamento (cópia de PDFs grandes): se o formulário fechar nesse intervalo, a pasta
  // reservada ainda precisa ser apagada quando a cópia terminar.
  const addInFlightRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    if (!available || isNewCarga) return; // carga nova ainda não tem anexos
    let active = true;
    handlers.loadCargaAttachments(cargaId).then((list) => {
      // Une com o que já está na tela: um PDF adicionado antes de a listagem inicial voltar não some.
      if (active) setItems((prev) => [...list, ...prev.filter((a) => !list.some((l) => l.id === a.id))]);
    });
    return () => { active = false; };
  }, [cargaId, isNewCarga, available]);

  // Formulário de carga nova fechado sem salvar: a pasta reservada não pode ficar para trás.
  useEffect(() => {
    return () => {
      if (!isNewCarga || savedRef.current) return;
      const inFlight = addInFlightRef.current;
      if (inFlight) {
        // Formulário fechado durante a cópia: espera terminar e só então apaga (se não foi salvo nesse meio-tempo).
        void inFlight.finally(() => { if (!savedRef.current) void discardCargaAttachments(cargaId); });
      } else if (itemsRef.current.length > 0) {
        void discardCargaAttachments(cargaId);
      }
    };
  }, [cargaId, isNewCarga]);

  const context = { date };

  const handleAdd = async () => {
    setBusy(true);
    const operation = handlers.handleAddCargaAttachments(cargaId, context);
    addInFlightRef.current = operation;
    try {
      const added = await operation;
      if (added.length > 0) setItems((prev) => [...prev, ...added]);
    } finally {
      if (addInFlightRef.current === operation) addInFlightRef.current = null;
      setBusy(false);
    }
  };

  const handleRemove = async (attachmentId: string) => {
    setBusy(true);
    try {
      if (await handlers.handleRemoveCargaAttachment(cargaId, attachmentId, context)) {
        setItems((prev) => prev.filter((a) => a.id !== attachmentId));
      }
    } finally {
      setConfirmingId(null);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5" data-testid="carga-attachments">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-slate-300 font-semibold">
          <Paperclip className="w-3.5 h-3.5 text-slate-400" />
          <span>Anexos (PDF)</span>
          {items.length > 0 && <span className="text-slate-500 font-medium">({items.length})</span>}
        </label>
        {available && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || locked}
            className="mac-button-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            title={locked ? 'Mês trancado no Fechamento de Ciclo' : 'Selecionar um ou vários PDFs'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar PDF</span>
          </button>
        )}
      </div>

      {!available ? (
        <p className="px-3 py-2 bg-[var(--graphite-surface-2)] border border-[var(--graphite-border-subtle)] rounded-xl text-slate-500">
          Os anexos só estão disponíveis no aplicativo instalado.
        </p>
      ) : items.length === 0 ? (
        <p className="px-3 py-2 bg-[var(--graphite-surface-2)] border border-[var(--graphite-border-subtle)] rounded-xl text-slate-500">
          Nenhum anexo. Os PDFs ficam guardados somente neste computador.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--graphite-surface-2)] border border-[var(--graphite-border-subtle)] rounded-xl"
            >
              <span className="flex-1 min-w-0 truncate text-slate-200 font-medium" title={item.fileName}>
                {item.fileName}
              </span>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatFileSize(item.sizeBytes)}</span>

              {confirmingId === item.id ? (
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-rose-300 font-semibold">Excluir?</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    disabled={busy}
                    className="px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800 hover:bg-rose-900/80 font-bold disabled:opacity-40"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="px-2 py-0.5 rounded-md bg-[#1a1d24] text-slate-300 border border-[var(--graphite-border-subtle)] hover:bg-[#232832] font-bold"
                  >
                    Não
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handlers.handleOpenCargaAttachment(cargaId, item.id)}
                    className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all"
                    title="Abrir PDF"
                    aria-label={`Abrir ${item.fileName}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlers.handleExportCargaAttachment(cargaId, item.id)}
                    className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all"
                    title="Salvar uma cópia em outro local"
                    aria-label={`Exportar ${item.fileName}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(item.id)}
                    disabled={busy || locked}
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title={locked ? 'Mês trancado no Fechamento de Ciclo' : 'Excluir anexo'}
                    aria-label={`Excluir ${item.fileName}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {available && locked && (
        <p className="flex items-center gap-1.5 text-amber-300/90">
          <Lock className="w-3 h-3" />
          <span>Mês trancado: não é possível adicionar nem excluir anexos.</span>
        </p>
      )}
    </div>
  );
};
