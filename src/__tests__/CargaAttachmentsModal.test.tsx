import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableCargas } from '../components/TableCargas';
import { CargaAttachmentsModal } from '../components/CargaAttachmentsModal';
import { AttachmentHandlersContext } from '../hooks/AttachmentHandlersContext';

const A1 = { id: 'aaaaaaaa-1111-4111-8111-111111111111', fileName: 'Romaneio 123.pdf', sizeBytes: 2048, addedAt: '2026-10-05T10:00:00.000Z' };
const carga = { id: 'c-1', date: '2026-08-10', product: 'Pinus', quantityTons: 10, valuePerTon: 100, totalValue: 1000 } as any;

function makeHandlers() {
  return {
    loadCargaAttachments: vi.fn(async () => [A1]),
    handleAddCargaAttachments: vi.fn(async () => [] as any[]),
    handleRemoveCargaAttachment: vi.fn(async () => true),
    handleOpenCargaAttachment: vi.fn(async () => true),
    handleExportCargaAttachment: vi.fn(async () => true),
  };
}
const installBridge = (counts: Record<string, number> = { 'c-1': 1 }) => {
  (window as any).electron = { isElectron: true, attachments: { summary: vi.fn(async () => ({ ok: true, data: counts })) } };
};

describe('Janela "Anexos da carga" (clipe da tabela)', () => {
  beforeEach(() => { installBridge(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { cleanup(); delete (window as any).electron; vi.restoreAllMocks(); });

  it('mês trancado: lista, abre e exporta; adicionar e excluir ficam bloqueados', async () => {
    const handlers = makeHandlers();
    render(<CargaAttachmentsModal carga={carga} locked handlers={handlers as any} onClose={vi.fn()} />);
    expect(await screen.findByText('Romaneio 123.pdf')).toBeTruthy();
    expect((screen.getByText('Adicionar PDF').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Excluir Romaneio 123.pdf') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Abrir Romaneio 123.pdf'));
    fireEvent.click(screen.getByLabelText('Exportar Romaneio 123.pdf'));
    expect(handlers.handleOpenCargaAttachment).toHaveBeenCalledWith('c-1', A1.id);
    expect(handlers.handleExportCargaAttachment).toHaveBeenCalledWith('c-1', A1.id);
    expect(screen.getByText(/Mês trancado/)).toBeTruthy();
  });

  it('mês aberto: adicionar e excluir liberados; fechar chama onClose', async () => {
    const onClose = vi.fn();
    render(<CargaAttachmentsModal carga={carga} locked={false} handlers={makeHandlers() as any} onClose={onClose} />);
    await screen.findByText('Romaneio 123.pdf');
    expect((screen.getByText('Adicionar PDF').closest('button') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText('Excluir Romaneio 123.pdf') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('na tabela, o clipe de uma carga de mês trancado abre a janela com os anexos (edição segue bloqueada)', async () => {
    const handlers = makeHandlers();
    render(
      <AttachmentHandlersContext.Provider value={handlers as any}>
        <TableCargas records={[carga]} searchTerm="" onDelete={vi.fn()} onAdd={vi.fn()} onUpdateRecord={vi.fn()} lockedMonths={['2026-08']} />
      </AttachmentHandlersContext.Provider>
    );
    const clip = await screen.findByTestId('attachment-indicator');
    expect(clip.tagName).toBe('BUTTON');
    expect((screen.getByTitle('Editar registro') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(clip);
    expect(await screen.findByText('Romaneio 123.pdf')).toBeTruthy();
    expect((screen.getByText('Adicionar PDF').closest('button') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Fechar'));
    await waitFor(() => expect(screen.queryByText('Romaneio 123.pdf')).toBeNull());
  });

  it('sem provedor (testes/telas isoladas) o indicador continua apenas informativo', async () => {
    render(<TableCargas records={[carga]} searchTerm="" onDelete={vi.fn()} onAdd={vi.fn()} onUpdateRecord={vi.fn()} />);
    const clip = await screen.findByTestId('attachment-indicator');
    expect(clip.tagName).toBe('SPAN');
  });
});
