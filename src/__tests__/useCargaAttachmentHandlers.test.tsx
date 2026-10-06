import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCargaAttachmentHandlers } from '../hooks/useCargaAttachmentHandlers';

const cloud = vi.hoisted(() => ({
  list: vi.fn(), add: vi.fn(), remove: vi.fn(), open: vi.fn(), exportCopy: vi.fn(),
}));
vi.mock('../utils/cargaAttachments', async () => {
  const real = await vi.importActual<typeof import('../utils/cargaAttachments')>('../utils/cargaAttachments');
  return {
    AttachmentError: real.AttachmentError,
    listCargaAttachments: cloud.list,
    addCargaAttachments: cloud.add,
    removeCargaAttachment: cloud.remove,
    openCargaAttachment: cloud.open,
    exportCargaAttachment: cloud.exportCopy,
  };
});
import { AttachmentError } from '../utils/cargaAttachments';

const A1 = { id: 'aaaaaaaa-1111-4111-8111-111111111111', fileName: 'a.pdf', sizeBytes: 10, addedAt: '2026-10-05T00:00:00.000Z' };
const A2 = { id: 'bbbbbbbb-2222-4222-8222-222222222222', fileName: 'b.pdf', sizeBytes: 20, addedAt: '2026-10-05T00:00:01.000Z' };

function setup(locked = false) {
  const database = { Cargas: [{ id: 'c1', date: '2026-08-20', quantityTons: 10, totalValue: 1000 }], Depositos_Klabin: [], Frete: [] } as any;
  const showToast = vi.fn();
  const hook = renderHook(() => useCargaAttachmentHandlers({ database, showToast, isDateLocked: () => locked }));
  return { ...hook, showToast, database };
}

describe('useCargaAttachmentHandlers (anexos locais)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('não altera o banco do app: os anexos ficam fora dele', async () => {
    cloud.add.mockResolvedValue({ canceled: false, added: [A1], failed: [] });
    const h = setup();
    const before = JSON.stringify(h.database);
    await act(async () => { await h.result.current.handleAddCargaAttachments('c1'); });
    expect(JSON.stringify(h.database)).toBe(before);
    expect('attachments' in h.database.Cargas[0]).toBe(false);
  });

  it('adiciona um ou vários PDFs e devolve o que foi anexado', async () => {
    const h = setup();
    cloud.add.mockResolvedValueOnce({ canceled: false, added: [A1], failed: [] });
    let added: any[] = [];
    await act(async () => { added = await h.result.current.handleAddCargaAttachments('c1'); });
    expect(added).toEqual([A1]);
    expect(h.showToast).toHaveBeenLastCalledWith('PDF anexado com sucesso.');

    cloud.add.mockResolvedValueOnce({ canceled: false, added: [A1, A2], failed: [] });
    await act(async () => { added = await h.result.current.handleAddCargaAttachments('c1'); });
    expect(added).toHaveLength(2);
    expect(h.showToast).toHaveBeenLastCalledWith('2 PDFs anexados com sucesso.');
  });

  it('cancelar o seletor não faz nada nem avisa', async () => {
    cloud.add.mockResolvedValue({ canceled: true, added: [], failed: [] });
    const h = setup();
    await act(async () => { expect(await h.result.current.handleAddCargaAttachments('c1')).toEqual([]); });
    expect(h.showToast).not.toHaveBeenCalled();
  });

  it('falha parcial informa o que entrou e o motivo do que não entrou', async () => {
    cloud.add.mockResolvedValue({ canceled: false, added: [A1], failed: [{ fileName: 'x.pdf', code: 'INVALID_FILE', message: 'O arquivo não é um PDF válido.' }] });
    const h = setup();
    await act(async () => { await h.result.current.handleAddCargaAttachments('c1'); });
    expect(h.showToast).toHaveBeenCalledWith(expect.stringContaining('x.pdf: O arquivo não é um PDF válido.'));
  });

  it('falha total ou erro da ponte não deixa nada e avisa o usuário', async () => {
    const h = setup();
    cloud.add.mockRejectedValue(new AttachmentError('COPY_FAILED', 'Não foi possível copiar o PDF.'));
    await act(async () => { expect(await h.result.current.handleAddCargaAttachments('c1')).toEqual([]); });
    expect(h.showToast).toHaveBeenCalledWith('Não foi possível copiar o PDF.');
  });

  it('mês trancado bloqueia adicionar e excluir, mas listar, abrir e exportar continuam livres', async () => {
    const h = setup(true);
    await act(async () => { await h.result.current.handleAddCargaAttachments('c1'); });
    await act(async () => { await h.result.current.handleRemoveCargaAttachment('c1', A1.id); });
    expect(cloud.add).not.toHaveBeenCalled();
    expect(cloud.remove).not.toHaveBeenCalled();
    expect(h.showToast).toHaveBeenCalledWith(expect.stringContaining('trancado'));

    cloud.list.mockResolvedValue([A1]);
    cloud.open.mockResolvedValue(true);
    cloud.exportCopy.mockResolvedValue({ canceled: false, path: '/x.pdf' });
    await act(async () => {
      expect(await h.result.current.loadCargaAttachments('c1')).toEqual([A1]);
      expect(await h.result.current.handleOpenCargaAttachment('c1', A1.id)).toBe(true);
      expect(await h.result.current.handleExportCargaAttachment('c1', A1.id)).toBe(true);
    });
  });

  it('carga inexistente não dispara nenhuma operação', async () => {
    const h = setup();
    await act(async () => { await h.result.current.handleAddCargaAttachments('nao-existe'); });
    expect(cloud.add).not.toHaveBeenCalled();
    expect(h.showToast).toHaveBeenCalledWith('Carga não encontrada.');
  });

  it('exclusão individual: sucesso avisa; falha mantém o anexo e avisa', async () => {
    const h = setup();
    cloud.remove.mockResolvedValueOnce(true);
    await act(async () => { expect(await h.result.current.handleRemoveCargaAttachment('c1', A1.id)).toBe(true); });
    cloud.remove.mockRejectedValueOnce(new AttachmentError('DELETE_FAILED', 'Não foi possível excluir o anexo.'));
    await act(async () => { expect(await h.result.current.handleRemoveCargaAttachment('c1', A1.id)).toBe(false); });
    expect(h.showToast).toHaveBeenLastCalledWith('Não foi possível excluir o anexo.');
  });

  it('exportar cancelado devolve false sem avisar; falha avisa; abrir com falha avisa', async () => {
    const h = setup();
    cloud.exportCopy.mockResolvedValueOnce({ canceled: true });
    await act(async () => { expect(await h.result.current.handleExportCargaAttachment('c1', A1.id)).toBe(false); });
    expect(h.showToast).not.toHaveBeenCalled();
    cloud.exportCopy.mockRejectedValueOnce(new AttachmentError('EXPORT_FAILED', 'Não foi possível salvar o PDF no local escolhido.'));
    await act(async () => { expect(await h.result.current.handleExportCargaAttachment('c1', A1.id)).toBe(false); });
    expect(h.showToast).toHaveBeenLastCalledWith('Não foi possível salvar o PDF no local escolhido.');
    cloud.open.mockRejectedValueOnce(new AttachmentError('NOT_FOUND', 'O anexo não foi encontrado neste computador.'));
    await act(async () => { expect(await h.result.current.handleOpenCargaAttachment('c1', A1.id)).toBe(false); });
    expect(h.showToast).toHaveBeenLastCalledWith('O anexo não foi encontrado neste computador.');
  });

  it('listar com falha devolve lista vazia e avisa', async () => {
    cloud.list.mockRejectedValue(new AttachmentError('LIST_FAILED', 'Não foi possível ler os anexos da carga.'));
    const h = setup();
    await act(async () => { expect(await h.result.current.loadCargaAttachments('c1')).toEqual([]); });
    expect(h.showToast).toHaveBeenCalledWith('Não foi possível ler os anexos da carga.');
  });
});

describe('useCargaAttachmentHandlers — carga ainda não salva (formulário de carga nova)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
  const setupNew = () => {
    const database = { Cargas: [], Depositos_Klabin: [], Frete: [] } as any;
    const showToast = vi.fn();
    const hook = renderHook(() => useCargaAttachmentHandlers({ database, showToast, isDateLocked: (d) => Boolean(d?.startsWith('2026-08')) }));
    return { ...hook, showToast };
  };

  it('usa a data do formulário: adicionar e excluir bloqueados em mês trancado, liberados em mês aberto', async () => {
    cloud.add.mockResolvedValue({ canceled: false, added: [A1], failed: [] });
    cloud.remove.mockResolvedValue(true);
    const h = setupNew();
    await act(async () => { await h.result.current.handleAddCargaAttachments('crg-novo', { date: '2026-08-10' }); });
    await act(async () => { await h.result.current.handleRemoveCargaAttachment('crg-novo', A1.id, { date: '2026-08-10' }); });
    expect(cloud.add).not.toHaveBeenCalled();
    expect(cloud.remove).not.toHaveBeenCalled();
    expect(h.showToast).toHaveBeenCalledWith(expect.stringContaining('trancado'));

    await act(async () => { await h.result.current.handleAddCargaAttachments('crg-novo', { date: '2026-10-05' }); });
    await act(async () => { await h.result.current.handleRemoveCargaAttachment('crg-novo', A1.id, { date: '2026-10-05' }); });
    expect(cloud.add).toHaveBeenCalledWith('crg-novo');
    expect(cloud.remove).toHaveBeenCalledWith('crg-novo', A1.id);
  });

  it('sem data nem carga salva (id desconhecido) não faz nada', async () => {
    const h = setupNew();
    await act(async () => { await h.result.current.handleAddCargaAttachments('crg-novo'); });
    expect(cloud.add).not.toHaveBeenCalled();
    expect(h.showToast).toHaveBeenCalledWith('Carga não encontrada.');
  });
});

describe('useCargaAttachmentHandlers — data do formulário e data salva', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

  it('bloqueia se a data do formulário estiver em mês trancado, mesmo com a data salva em mês aberto', async () => {
    cloud.add.mockResolvedValue({ canceled: false, added: [A1], failed: [] });
    const database = { Cargas: [{ id: 'c1', date: '2026-10-05', quantityTons: 1, totalValue: 1 }], Depositos_Klabin: [], Frete: [] } as any;
    const showToast = vi.fn();
    const hook = renderHook(() => useCargaAttachmentHandlers({ database, showToast, isDateLocked: (d) => Boolean(d?.startsWith('2026-08')) }));
    await act(async () => { await hook.result.current.handleAddCargaAttachments('c1', { date: '2026-08-10' }); });
    expect(cloud.add).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('trancado'));
    await act(async () => { await hook.result.current.handleAddCargaAttachments('c1', { date: '2026-10-06' }); });
    expect(cloud.add).toHaveBeenCalledTimes(1);
  });
});
