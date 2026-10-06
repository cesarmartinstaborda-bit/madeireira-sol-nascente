import { CargaAttachment, KlabinDatabase } from '../types';
import {
  AttachmentError,
  addCargaAttachments,
  exportCargaAttachment,
  listCargaAttachments,
  openCargaAttachment,
  removeCargaAttachment,
} from '../utils/cargaAttachments';

interface UseCargaAttachmentHandlersParams {
  database: KlabinDatabase;
  showToast: (msg: string) => void;
  isDateLocked: (dateStr?: string) => boolean;
}

/** Contexto de uma carga que ainda não foi salva: o formulário informa a data dela. */
export interface AttachmentContext {
  date?: string;
}

export type CargaAttachmentHandlers = ReturnType<typeof useCargaAttachmentHandlers>;

const LOCKED_MESSAGE = 'Operação bloqueada: o mês desta carga está trancado no Fechamento de Ciclo.';

function describeError(error: unknown, fallback: string): string {
  return error instanceof AttachmentError ? error.message : fallback;
}

/**
 * Operações de anexo PDF das cargas (armazenamento local deste computador).
 *
 * Os anexos ficam fora do banco do app, então estas funções não alteram `database`: devolvem o
 * resultado para quem exibe a lista e já avisam o usuário em caso de falha.
 * Mês trancado bloqueia adicionar e excluir anexo; abrir, exportar e listar são livres.
 */
export function useCargaAttachmentHandlers({ database, showToast, isDateLocked }: UseCargaAttachmentHandlersParams) {
  const findCarga = (cargaId: string) => database.Cargas.find((c) => c.id === cargaId);

  const loadCargaAttachments = async (cargaId: string): Promise<CargaAttachment[]> => {
    try {
      return await listCargaAttachments(cargaId);
    } catch (error) {
      console.error(`[Anexos] Falha ao listar anexos da carga ${cargaId}:`, error);
      showToast(describeError(error, 'Não foi possível ler os anexos desta carga.'));
      return [];
    }
  };

  /**
   * Data usada na regra de mês trancado: a da carga salva ou, para uma carga ainda não salva
   * (formulário de carga nova), a informada pelo formulário. `null` = carga desconhecida.
   */
  const isLockedFor = (cargaId: string, options?: AttachmentContext): boolean | null => {
    const carga = findCarga(cargaId);
    if (!carga && options?.date === undefined) return null; // carga desconhecida
    // Vale a data salva e também a do formulário (a tela usa a do formulário para habilitar os botões).
    return [carga?.date, options?.date].some((date) => Boolean(date) && isDateLocked(date));
  };

  /** Devolve os anexos efetivamente adicionados ([] se cancelou, bloqueou ou falhou). */
  const handleAddCargaAttachments = async (cargaId: string, options?: AttachmentContext): Promise<CargaAttachment[]> => {
    const locked = isLockedFor(cargaId, options);
    if (locked === null) {
      showToast('Carga não encontrada.');
      return [];
    }
    if (locked) {
      showToast(LOCKED_MESSAGE);
      return [];
    }

    try {
      const result = await addCargaAttachments(cargaId);
      if (result.canceled) return [];
      if (result.added.length > 0 && result.failed.length === 0) {
        showToast(result.added.length === 1 ? 'PDF anexado com sucesso.' : `${result.added.length} PDFs anexados com sucesso.`);
      } else if (result.failed.length > 0) {
        const reasons = result.failed.map((f) => `${f.fileName}: ${f.message}`).join(' ');
        showToast(
          result.added.length > 0
            ? `${result.added.length} anexado(s); falhou: ${reasons}`
            : `Nenhum PDF foi anexado. ${reasons}`
        );
      }
      return result.added;
    } catch (error) {
      console.error(`[Anexos] Falha ao anexar à carga ${cargaId}:`, error);
      showToast(describeError(error, 'Não foi possível anexar o PDF.'));
      return [];
    }
  };

  const handleRemoveCargaAttachment = async (
    cargaId: string,
    attachmentId: string,
    options?: AttachmentContext
  ): Promise<boolean> => {
    const locked = isLockedFor(cargaId, options);
    if (locked === null) {
      showToast('Carga não encontrada.');
      return false;
    }
    if (locked) {
      showToast(LOCKED_MESSAGE);
      return false;
    }
    try {
      await removeCargaAttachment(cargaId, attachmentId);
      showToast('Anexo excluído.');
      return true;
    } catch (error) {
      console.error(`[Anexos] Falha ao excluir anexo ${attachmentId} da carga ${cargaId}:`, error);
      showToast(describeError(error, 'Não foi possível excluir o anexo.'));
      return false;
    }
  };

  const handleOpenCargaAttachment = async (cargaId: string, attachmentId: string): Promise<boolean> => {
    try {
      await openCargaAttachment(cargaId, attachmentId);
      return true;
    } catch (error) {
      console.error(`[Anexos] Falha ao abrir anexo ${attachmentId} da carga ${cargaId}:`, error);
      showToast(describeError(error, 'Não foi possível abrir o PDF.'));
      return false;
    }
  };

  /** `true` quando a cópia foi gravada; `false` se o usuário cancelou ou houve falha. */
  const handleExportCargaAttachment = async (cargaId: string, attachmentId: string): Promise<boolean> => {
    try {
      const result = await exportCargaAttachment(cargaId, attachmentId);
      if (result.canceled) return false;
      showToast('PDF salvo no local escolhido.');
      return true;
    } catch (error) {
      console.error(`[Anexos] Falha ao exportar anexo ${attachmentId} da carga ${cargaId}:`, error);
      showToast(describeError(error, 'Não foi possível salvar o PDF.'));
      return false;
    }
  };

  return {
    loadCargaAttachments,
    handleAddCargaAttachments,
    handleRemoveCargaAttachment,
    handleOpenCargaAttachment,
    handleExportCargaAttachment,
  };
}
