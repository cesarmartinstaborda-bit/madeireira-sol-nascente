import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATTACHMENTS_CHANGED_EVENT,
  AttachmentError,
  addCargaAttachments,
  discardCargaAttachments,
  exportCargaAttachment,
  getAttachmentCounts,
  isLocalAttachmentsAvailable,
  listCargaAttachments,
  openCargaAttachment,
  removeCargaAttachment,
} from '../utils/cargaAttachments';

const entry = { id: 'aaaaaaaa-1111-4111-8111-111111111111', fileName: 'nota.pdf', sizeBytes: 10, addedAt: '2026-10-05T00:00:00.000Z' };
const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
const fail = (code: string, message: string) => Promise.resolve({ ok: false as const, code, message });

function installBridge(overrides: Partial<LocalAttachmentsBridge> = {}) {
  const bridge: LocalAttachmentsBridge = {
    list: vi.fn(() => ok([entry])),
    summary: vi.fn(() => ok({ 'crg-1': 1 })),
    add: vi.fn(() => ok({ canceled: false, added: [entry], failed: [] })),
    open: vi.fn(() => ok(true as const)),
    exportCopy: vi.fn(() => ok({ canceled: false, path: '/home/u/Downloads/nota.pdf' })),
    remove: vi.fn(() => ok(true as const)),
    removeForCarga: vi.fn(() => ok(true as const)),
    ...overrides,
  };
  (window as any).electron = { isElectron: true, attachments: bridge };
  return bridge;
}

describe('cliente da ponte de anexos locais', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { delete (window as any).electron; vi.restoreAllMocks(); });

  it('repassa cada operação à ponte com os ids e devolve os dados', async () => {
    const bridge = installBridge();
    expect(isLocalAttachmentsAvailable()).toBe(true);
    expect(await listCargaAttachments('crg-1')).toEqual([entry]);
    expect(await getAttachmentCounts()).toEqual({ 'crg-1': 1 });
    expect((await addCargaAttachments('crg-1')).added).toEqual([entry]);
    expect(await openCargaAttachment('crg-1', entry.id)).toBe(true);
    expect(await exportCargaAttachment('crg-1', entry.id)).toEqual({ canceled: false, path: '/home/u/Downloads/nota.pdf' });
    expect(await removeCargaAttachment('crg-1', entry.id)).toBe(true);
    expect(bridge.list).toHaveBeenCalledWith('crg-1');
    expect(bridge.exportCopy).toHaveBeenCalledWith('crg-1', entry.id);
  });

  it('erro do processo principal vira AttachmentError com código e mensagem', async () => {
    installBridge({ list: vi.fn(() => fail('INVALID_ID', 'Identificador de carga inválido.')) });
    await expect(listCargaAttachments('..')).rejects.toMatchObject({
      name: 'AttachmentError', code: 'INVALID_ID', message: 'Identificador de carga inválido.',
    });
  });

  it('falha de comunicação (invoke rejeitado) vira UNEXPECTED', async () => {
    installBridge({ remove: vi.fn(() => Promise.reject(new Error('canal fechado'))) });
    await expect(removeCargaAttachment('crg-1', entry.id)).rejects.toMatchObject({ code: 'UNEXPECTED' });
  });

  it('fora do Electron (navegador/testes) falha com UNAVAILABLE em vez de quebrar', async () => {
    expect(isLocalAttachmentsAvailable()).toBe(false);
    await expect(listCargaAttachments('crg-1')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await expect(addCargaAttachments('crg-1')).rejects.toBeInstanceOf(AttachmentError);
  });

  it('discardCargaAttachments nunca lança: sem ponte é silencioso, com falha só registra aviso', async () => {
    await expect(discardCargaAttachments('crg-1')).resolves.toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();

    const bridge = installBridge({ removeForCarga: vi.fn(() => fail('DELETE_FAILED', 'sem permissão')) });
    await expect(discardCargaAttachments('crg-1')).resolves.toBeUndefined();
    expect(bridge.removeForCarga).toHaveBeenCalledWith('crg-1');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  describe('evento de mudança (alimenta o indicador da tabela)', () => {
    const listen = () => { const fn = vi.fn(); window.addEventListener(ATTACHMENTS_CHANGED_EVENT, fn); return fn; };
    afterEach(() => { /* o listener é local ao teste e a janela é recriada a cada arquivo */ });

    it('adicionar dispara só quando algo foi de fato adicionado', async () => {
      const fn = listen();
      installBridge({ add: vi.fn(() => ok({ canceled: true, added: [], failed: [] })) });
      await addCargaAttachments('crg-1');
      installBridge({ add: vi.fn(() => ok({ canceled: false, added: [], failed: [{ fileName: 'x.pdf', code: 'INVALID_FILE', message: 'x' }] })) });
      await addCargaAttachments('crg-1');
      expect(fn).not.toHaveBeenCalled();
      installBridge();
      await addCargaAttachments('crg-1');
      expect(fn).toHaveBeenCalledTimes(1);
      window.removeEventListener(ATTACHMENTS_CHANGED_EVENT, fn);
    });

    it('excluir anexo e descartar a pasta da carga disparam; descartar sem ponte não dispara', async () => {
      const fn = listen();
      installBridge();
      await removeCargaAttachment('crg-1', entry.id);
      await discardCargaAttachments('crg-1');
      expect(fn).toHaveBeenCalledTimes(2);
      delete (window as any).electron;
      await discardCargaAttachments('crg-1');
      expect(fn).toHaveBeenCalledTimes(2);
      window.removeEventListener(ATTACHMENTS_CHANGED_EVENT, fn);
    });
  });
});
