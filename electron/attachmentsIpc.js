'use strict';

const path = require('node:path');
const { AttachmentError } = require('./localAttachments.js');

/**
 * Canais IPC dos anexos PDF das cargas. O renderer nunca informa caminhos de arquivo: quem
 * escolhe o PDF (e o destino da exportação) é o diálogo do sistema aberto aqui, no processo
 * principal, então um renderer comprometido não consegue pedir a leitura de arquivos arbitrários.
 *
 * Todo handler valida a origem (`requireMainFrame`) antes de qualquer coisa e responde com um
 * envelope `{ ok: true, data }` ou `{ ok: false, code, message }`.
 */

const CHANNELS = [
  'attachments-list',
  'attachments-summary',
  'attachments-add',
  'attachments-open',
  'attachments-export',
  'attachments-remove',
  'attachments-remove-carga',
];

function failure(error) {
  if (error instanceof AttachmentError) return { ok: false, code: error.code, message: error.message };
  console.warn('[Anexos] Erro inesperado:', error);
  return { ok: false, code: 'UNEXPECTED', message: 'Falha inesperada ao tratar o anexo.' };
}

function registerAttachmentsIpc({ ipcMain, dialog, shell, store, requireMainFrame, getWindow, getDownloadsDir }) {
  const handle = (channel, fn) =>
    ipcMain.handle(channel, async (event, ...args) => {
      requireMainFrame(event);
      try {
        return { ok: true, data: await fn(...args) };
      } catch (error) {
        return failure(error);
      }
    });

  handle('attachments-list', (cargaId) => store.list(cargaId));

  handle('attachments-summary', () => store.summary());

  handle('attachments-add', async (cargaId) => {
    store.assertCargaId(cargaId); // não abre o seletor para uma carga inválida
    const picked = await dialog.showOpenDialog(getWindow() || undefined, {
      title: 'Anexar PDF à carga',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (picked.canceled || !picked.filePaths || picked.filePaths.length === 0) {
      return { canceled: true, added: [], failed: [] };
    }
    const { added, failed } = await store.addFromPaths(cargaId, picked.filePaths);
    return { canceled: false, added, failed };
  });

  handle('attachments-open', async (cargaId, attachmentId) => {
    const { filePath } = await store.resolveFile(cargaId, attachmentId);
    const problem = await shell.openPath(filePath);
    if (problem) throw new AttachmentError('OPEN_FAILED', 'Não foi possível abrir o PDF no visualizador do sistema.');
    return true;
  });

  handle('attachments-export', async (cargaId, attachmentId) => {
    const { fileName } = await store.resolveFile(cargaId, attachmentId);
    const chosen = await dialog.showSaveDialog(getWindow() || undefined, {
      title: 'Salvar cópia do PDF',
      defaultPath: path.join(getDownloadsDir(), fileName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (chosen.canceled || !chosen.filePath) return { canceled: true };
    const exportedTo = await store.exportTo(cargaId, attachmentId, chosen.filePath);
    return { canceled: false, path: exportedTo };
  });

  handle('attachments-remove', (cargaId, attachmentId) => store.remove(cargaId, attachmentId));

  handle('attachments-remove-carga', (cargaId) => store.removeForCarga(cargaId));
}

module.exports = { registerAttachmentsIpc, ATTACHMENT_CHANNELS: CHANNELS };
