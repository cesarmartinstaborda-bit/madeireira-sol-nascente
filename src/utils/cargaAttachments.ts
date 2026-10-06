import type { CargaAttachment } from '../types';

/**
 * Anexos PDF das cargas, guardados só neste computador pelo processo principal do Electron
 * (`electron/localAttachments.js`, pasta `userData/attachments/<cargaId>/`). Este módulo é o
 * cliente tipado da ponte `window.electron.attachments`.
 *
 * Os anexos não fazem parte do banco do app: não passam pelo Firestore, pela fila de upserts
 * nem pelos backups JSON. Fora do Electron (ex.: Vite no navegador, testes) a ponte não existe
 * e as operações falham com `UNAVAILABLE`.
 */

export class AttachmentError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'AttachmentError';
    this.code = code;
    this.cause = cause;
  }
}

export interface AddAttachmentsResult {
  canceled: boolean;
  added: CargaAttachment[];
  failed: { fileName: string; code: string; message: string }[];
}

/** Disparado após qualquer mudança nos anexos, para as telas atualizarem contagens e listas. */
export const ATTACHMENTS_CHANGED_EVENT = 'carga-attachments-changed';

function notifyAttachmentsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ATTACHMENTS_CHANGED_EVENT));
}

export function isLocalAttachmentsAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electron?.attachments);
}

async function call<T>(invoke: (bridge: LocalAttachmentsBridge) => Promise<LocalAttachmentResult<T>>): Promise<T> {
  const bridge = typeof window !== 'undefined' ? window.electron?.attachments : undefined;
  if (!bridge) {
    throw new AttachmentError('UNAVAILABLE', 'Os anexos só funcionam no aplicativo instalado.');
  }
  let result: LocalAttachmentResult<T>;
  try {
    result = await invoke(bridge);
  } catch (error) {
    throw new AttachmentError('UNEXPECTED', 'Falha ao acessar o armazenamento local de anexos.', error);
  }
  // `=== false` (e não `!result.ok`): o projeto compila sem `strict`, e só a comparação com o
  // literal faz o TypeScript estreitar a união discriminada.
  if (result.ok === false) throw new AttachmentError(result.code, result.message);
  return result.data;
}

export const listCargaAttachments = (cargaId: string): Promise<CargaAttachment[]> =>
  call((bridge) => bridge.list(cargaId));

/** Quantidade de anexos por carga (só cargas com anexos), para sinalizar nas tabelas. */
export const getAttachmentCounts = (): Promise<Record<string, number>> => call((bridge) => bridge.summary());

/** Abre o seletor de PDFs do sistema e copia os escolhidos para o armazenamento do aplicativo. */
export async function addCargaAttachments(cargaId: string): Promise<AddAttachmentsResult> {
  const result = await call((bridge) => bridge.add(cargaId));
  if (result.added.length > 0) notifyAttachmentsChanged();
  return result;
}

/** Abre o PDF no visualizador padrão do sistema. */
export const openCargaAttachment = (cargaId: string, attachmentId: string): Promise<true> =>
  call((bridge) => bridge.open(cargaId, attachmentId));

/** Abre o diálogo "Salvar como" e grava uma cópia do PDF no local escolhido. */
export const exportCargaAttachment = (
  cargaId: string,
  attachmentId: string
): Promise<{ canceled: boolean; path?: string }> => call((bridge) => bridge.exportCopy(cargaId, attachmentId));

export async function removeCargaAttachment(cargaId: string, attachmentId: string): Promise<true> {
  const result = await call((bridge) => bridge.remove(cargaId, attachmentId));
  notifyAttachmentsChanged();
  return result;
}

/**
 * Apaga a pasta de anexos da carga excluída. Nunca lança: uma falha aqui não pode impedir nem
 * desfazer a exclusão da carga; no máximo sobra uma pasta no disco, sem referência no app.
 */
export async function discardCargaAttachments(cargaId: string): Promise<void> {
  try {
    await call((bridge) => bridge.removeForCarga(cargaId));
    notifyAttachmentsChanged();
  } catch (error) {
    if (error instanceof AttachmentError && error.code === 'UNAVAILABLE') return;
    console.warn(`[Anexos] Pasta de anexos da carga ${cargaId} não foi apagada:`, error);
  }
}
