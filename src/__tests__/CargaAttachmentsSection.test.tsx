import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CargaAttachmentsSection } from '../components/CargaAttachmentsSection';

const A1 = { id: 'aaaaaaaa-1111-4111-8111-111111111111', fileName: 'Romaneio 123.pdf', sizeBytes: 2048, addedAt: '2026-10-05T10:00:00.000Z' };
const A2 = { id: 'bbbbbbbb-2222-4222-8222-222222222222', fileName: 'DANFE 456.pdf', sizeBytes: 3 * 1024 * 1024, addedAt: '2026-10-05T10:01:00.000Z' };

function makeHandlers(initial: any[] = []) {
  return {
    loadCargaAttachments: vi.fn(async () => initial),
    handleAddCargaAttachments: vi.fn(async () => [] as any[]),
    handleRemoveCargaAttachment: vi.fn(async () => true),
    handleOpenCargaAttachment: vi.fn(async () => true),
    handleExportCargaAttachment: vi.fn(async () => true),
  };
}

function installBridge() {
  const bridge = { removeForCarga: vi.fn(async () => ({ ok: true, data: true })) };
  (window as any).electron = { isElectron: true, attachments: bridge };
  return bridge;
}

function renderSection(props: Partial<React.ComponentProps<typeof CargaAttachmentsSection>> & { handlers: any }) {
  const savedRef = { current: false };
  const utils = render(
    <CargaAttachmentsSection cargaId="crg-1" isNewCarga={false} date="2026-10-05" locked={false} savedRef={savedRef} {...props} />
  );
  return { ...utils, savedRef };
}

describe('Seção "Anexos" do formulário de carga', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { cleanup(); delete (window as any).electron; vi.restoreAllMocks(); });

  it('fora do aplicativo instalado avisa e não oferece ações', () => {
    renderSection({ handlers: makeHandlers() });
    expect(screen.getByText(/só estão disponíveis no aplicativo instalado/i)).toBeTruthy();
    expect(screen.queryByText('Adicionar PDF')).toBeNull();
  });

  it('na edição lista os anexos existentes com o nome original e o tamanho', async () => {
    installBridge();
    const handlers = makeHandlers([A1, A2]);
    renderSection({ handlers });
    expect(await screen.findByText('Romaneio 123.pdf')).toBeTruthy();
    expect(screen.getByText('DANFE 456.pdf')).toBeTruthy();
    expect(screen.getByText('2 KB')).toBeTruthy();
    expect(screen.getByText('3,0 MB')).toBeTruthy();
    expect(handlers.loadCargaAttachments).toHaveBeenCalledWith('crg-1');
  });

  it('carga sem anexo mostra o estado vazio e não lista nada', async () => {
    installBridge();
    renderSection({ handlers: makeHandlers([]) });
    expect(await screen.findByText(/Nenhum anexo/)).toBeTruthy();
  });

  it('adiciona um ou vários PDFs de uma vez e mostra todos', async () => {
    installBridge();
    const handlers = makeHandlers([]);
    handlers.handleAddCargaAttachments.mockResolvedValue([A1, A2]);
    renderSection({ handlers });
    fireEvent.click(await screen.findByText('Adicionar PDF'));
    expect(await screen.findByText('Romaneio 123.pdf')).toBeTruthy();
    expect(screen.getByText('DANFE 456.pdf')).toBeTruthy();
    expect(handlers.handleAddCargaAttachments).toHaveBeenCalledWith('crg-1', { date: '2026-10-05' });
  });

  it('seleção cancelada ou com falha não altera a lista', async () => {
    installBridge();
    const handlers = makeHandlers([A1]);
    renderSection({ handlers });
    await screen.findByText('Romaneio 123.pdf');
    fireEvent.click(screen.getByText('Adicionar PDF'));
    await waitFor(() => expect(handlers.handleAddCargaAttachments).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); }); // deixa o estado assentar
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect((screen.getByText('Adicionar PDF').closest('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('abre e exporta cada PDF pelo id certo', async () => {
    installBridge();
    const handlers = makeHandlers([A1, A2]);
    renderSection({ handlers });
    fireEvent.click(await screen.findByLabelText('Abrir DANFE 456.pdf'));
    fireEvent.click(screen.getByLabelText('Exportar Romaneio 123.pdf'));
    expect(handlers.handleOpenCargaAttachment).toHaveBeenCalledWith('crg-1', A2.id);
    expect(handlers.handleExportCargaAttachment).toHaveBeenCalledWith('crg-1', A1.id);
  });

  it('excluir pede confirmação na própria linha; "Não" cancela e "Sim" remove só aquele anexo', async () => {
    installBridge();
    const handlers = makeHandlers([A1, A2]);
    renderSection({ handlers });
    fireEvent.click(await screen.findByLabelText('Excluir Romaneio 123.pdf'));
    expect(handlers.handleRemoveCargaAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Não'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Excluir Romaneio 123.pdf'));
    fireEvent.click(screen.getByText('Sim'));
    await waitFor(() => expect(screen.queryByText('Romaneio 123.pdf')).toBeNull());
    expect(handlers.handleRemoveCargaAttachment).toHaveBeenCalledWith('crg-1', A1.id, { date: '2026-10-05' });
    expect(screen.getByText('DANFE 456.pdf')).toBeTruthy();
  });

  it('falha ao excluir mantém o anexo na lista', async () => {
    installBridge();
    const handlers = makeHandlers([A1]);
    handlers.handleRemoveCargaAttachment.mockResolvedValue(false);
    renderSection({ handlers });
    fireEvent.click(await screen.findByLabelText('Excluir Romaneio 123.pdf'));
    fireEvent.click(screen.getByText('Sim'));
    await waitFor(() => expect(handlers.handleRemoveCargaAttachment).toHaveBeenCalled());
    expect(screen.getByText('Romaneio 123.pdf')).toBeTruthy();
  });

  it('mês trancado bloqueia adicionar e excluir, mas abrir e exportar continuam liberados', async () => {
    installBridge();
    const handlers = makeHandlers([A1]);
    renderSection({ handlers, locked: true });
    await screen.findByText('Romaneio 123.pdf');
    expect((screen.getByText('Adicionar PDF').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Excluir Romaneio 123.pdf') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Abrir Romaneio 123.pdf') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText('Exportar Romaneio 123.pdf') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/Mês trancado/)).toBeTruthy();
  });

  describe('carga nova (pasta reservada)', () => {
    it('não lista nada ao abrir (a carga ainda não existe)', async () => {
      installBridge();
      const handlers = makeHandlers([A1]);
      renderSection({ handlers, isNewCarga: true, cargaId: 'crg-novo' });
      await screen.findByText(/Nenhum anexo/);
      expect(handlers.loadCargaAttachments).not.toHaveBeenCalled();
    });

    it('fechar sem salvar apaga a pasta reservada quando houve anexos', async () => {
      const bridge = installBridge();
      const handlers = makeHandlers();
      handlers.handleAddCargaAttachments.mockResolvedValue([A1]);
      const { unmount } = renderSection({ handlers, isNewCarga: true, cargaId: 'crg-novo' });
      fireEvent.click(await screen.findByText('Adicionar PDF'));
      await screen.findByText('Romaneio 123.pdf');
      unmount();
      await waitFor(() => expect(bridge.removeForCarga).toHaveBeenCalledWith('crg-novo'));
    });

    it('fechar sem ter anexado nada não toca no disco', async () => {
      const bridge = installBridge();
      const { unmount } = renderSection({ handlers: makeHandlers(), isNewCarga: true, cargaId: 'crg-novo' });
      await screen.findByText(/Nenhum anexo/);
      unmount();
      expect(bridge.removeForCarga).not.toHaveBeenCalled();
    });

    it('depois de salvar a carga os anexos ficam', async () => {
      const bridge = installBridge();
      const handlers = makeHandlers();
      handlers.handleAddCargaAttachments.mockResolvedValue([A1]);
      const { unmount, savedRef } = renderSection({ handlers, isNewCarga: true, cargaId: 'crg-novo' });
      fireEvent.click(await screen.findByText('Adicionar PDF'));
      await screen.findByText('Romaneio 123.pdf');
      savedRef.current = true;
      unmount();
      await act(async () => { await Promise.resolve(); });
      expect(bridge.removeForCarga).not.toHaveBeenCalled();
    });
  });
});

describe('Seção "Anexos" — corridas', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { cleanup(); delete (window as any).electron; vi.restoreAllMocks(); });

  it('formulário de carga nova fechado DURANTE a cópia apaga a pasta reservada quando a cópia termina', async () => {
    const bridge = installBridge();
    const handlers = makeHandlers();
    let finishCopy!: (added: any[]) => void;
    handlers.handleAddCargaAttachments.mockImplementation(() => new Promise((resolve) => { finishCopy = resolve; }));
    const { unmount } = renderSection({ handlers, isNewCarga: true, cargaId: 'crg-novo' });
    fireEvent.click(await screen.findByText('Adicionar PDF'));
    unmount();                                   // usuário clicou em Cancelar com a cópia ainda rodando
    expect(bridge.removeForCarga).not.toHaveBeenCalled();
    await act(async () => { finishCopy([A1]); await Promise.resolve(); });
    await waitFor(() => expect(bridge.removeForCarga).toHaveBeenCalledWith('crg-novo'));
  });

  it('se a carga for salva enquanto a cópia termina, a pasta fica', async () => {
    const bridge = installBridge();
    const handlers = makeHandlers();
    let finishCopy!: (added: any[]) => void;
    handlers.handleAddCargaAttachments.mockImplementation(() => new Promise((resolve) => { finishCopy = resolve; }));
    const { unmount, savedRef } = renderSection({ handlers, isNewCarga: true, cargaId: 'crg-novo' });
    fireEvent.click(await screen.findByText('Adicionar PDF'));
    unmount();
    savedRef.current = true;                     // a carga foi salva antes de a cópia acabar
    await act(async () => { finishCopy([A1]); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(bridge.removeForCarga).not.toHaveBeenCalled();
  });

  it('um PDF adicionado antes da listagem inicial voltar não some da tela', async () => {
    installBridge();
    const handlers = makeHandlers();
    let finishList!: (list: any[]) => void;
    handlers.loadCargaAttachments.mockImplementation(() => new Promise((resolve) => { finishList = resolve; }));
    handlers.handleAddCargaAttachments.mockResolvedValue([A2]);
    renderSection({ handlers });
    fireEvent.click(await screen.findByText('Adicionar PDF'));
    await screen.findByText('DANFE 456.pdf');
    await act(async () => { finishList([A1]); await Promise.resolve(); });
    expect(screen.getByText('Romaneio 123.pdf')).toBeTruthy();
    expect(screen.getByText('DANFE 456.pdf')).toBeTruthy();
  });
});
