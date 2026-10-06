import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordModal } from '../components/RecordModal';

const A1 = { id: 'aaaaaaaa-1111-4111-8111-111111111111', fileName: 'Romaneio 123.pdf', sizeBytes: 2048, addedAt: '2026-10-05T10:00:00.000Z' };

const baseProps = {
  isOpen: true,
  tableType: 'Cargas' as const,
  onClose: vi.fn(),
  produtos: [{ id: 'p1', name: 'Pinus Teste', unitOfMeasure: 'ton', referencePrice: 100, status: 'ACTIVE' }] as any,
  clientes: [],
  motoristas: [],
  freightRatePerTon: 15,
};

function makeHandlers(existing: any[] = []) {
  return {
    loadCargaAttachments: vi.fn(async () => existing),
    handleAddCargaAttachments: vi.fn(async () => [A1] as any[]),
    handleRemoveCargaAttachment: vi.fn(async () => true),
    handleOpenCargaAttachment: vi.fn(async () => true),
    handleExportCargaAttachment: vi.fn(async () => true),
  };
}

let bridge: { removeForCarga: ReturnType<typeof vi.fn> };
beforeEach(() => {
  bridge = { removeForCarga: vi.fn(async () => ({ ok: true, data: true })) };
  (window as any).electron = { isElectron: true, attachments: bridge };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { cleanup(); delete (window as any).electron; vi.clearAllMocks(); vi.restoreAllMocks(); });

const submit = () => fireEvent.submit(document.querySelector('form')!);

describe('RecordModal — seção Anexos', () => {
  it('carga nova: os PDFs anexados antes de salvar ficam na pasta do id que a carga recebe ao ser salva', async () => {
    const handlers = makeHandlers();
    const onSave = vi.fn(() => true);
    const onClose = vi.fn();
    render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} onClose={onClose} attachmentHandlers={handlers as any} isDateLocked={() => false} />);

    fireEvent.click(await screen.findByText('Adicionar PDF'));
    await screen.findByText('Romaneio 123.pdf');
    const cargaIdUsedByAttachments = (handlers.handleAddCargaAttachments.mock.calls[0] as any[])[0];
    expect(cargaIdUsedByAttachments).toMatch(/^crg-/);

    submit();
    const saved = (onSave.mock.calls[0] as any[])[0];
    expect(saved.id).toBe(cargaIdUsedByAttachments); // vínculo correto depois que a carga existe
    expect(onClose).toHaveBeenCalled();
  });

  it('carga nova salva com anexos não perde a pasta quando o formulário fecha', async () => {
    const handlers = makeHandlers();
    const onSave = vi.fn(() => true);
    const { rerender } = render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    fireEvent.click(await screen.findByText('Adicionar PDF'));
    await screen.findByText('Romaneio 123.pdf');
    submit();
    rerender(<RecordModal {...baseProps} isOpen={false} recordToEdit={null} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    await act(async () => { await Promise.resolve(); });
    expect(bridge.removeForCarga).not.toHaveBeenCalled();
  });

  it('carga nova cancelada (fechar sem salvar) apaga a pasta reservada', async () => {
    const handlers = makeHandlers();
    const onSave = vi.fn(() => true);
    const { rerender } = render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    fireEvent.click(await screen.findByText('Adicionar PDF'));
    await screen.findByText('Romaneio 123.pdf');
    const reservedId = (handlers.handleAddCargaAttachments.mock.calls[0] as any[])[0];
    rerender(<RecordModal {...baseProps} isOpen={false} recordToEdit={null} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    await waitFor(() => expect(bridge.removeForCarga).toHaveBeenCalledWith(reservedId));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('salvar recusado (mês trancado/validação): o formulário segue aberto, os anexos ficam e só são descartados se fechar sem salvar', async () => {
    const handlers = makeHandlers();
    const onSave = vi.fn(() => false);
    const { rerender } = render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    fireEvent.click(await screen.findByText('Adicionar PDF'));
    await screen.findByText('Romaneio 123.pdf');
    submit();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Romaneio 123.pdf')).toBeTruthy();   // continua na tela
    expect(bridge.removeForCarga).not.toHaveBeenCalled();         // nada apagado enquanto aberto
    const reservedId = (handlers.handleAddCargaAttachments.mock.calls[0] as any[])[0];
    rerender(<RecordModal {...baseProps} isOpen={false} recordToEdit={null} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    await waitFor(() => expect(bridge.removeForCarga).toHaveBeenCalledWith(reservedId)); // fechou sem salvar
  });

  it('carga nova sem anexo continua como hoje: id crg-…, nada no disco', async () => {
    const onSave = vi.fn(() => true);
    render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} attachmentHandlers={makeHandlers() as any} isDateLocked={() => false} />);
    submit();
    expect((onSave.mock.calls[0] as any[])[0].id).toMatch(/^crg-/);
    expect(bridge.removeForCarga).not.toHaveBeenCalled();
  });

  it('cada abertura de carga nova reserva um id diferente', async () => {
    const handlers = makeHandlers();
    const onSave = vi.fn(() => true);
    const { rerender } = render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    submit();
    rerender(<RecordModal {...baseProps} isOpen={false} recordToEdit={null} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    rerender(<RecordModal {...baseProps} isOpen={true} recordToEdit={null} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    submit();
    const [first, second] = onSave.mock.calls.map((c: any[]) => c[0].id);
    expect(first).not.toBe(second);
  });

  it('edição: lista os anexos existentes e mantém o id da carga ao salvar', async () => {
    const handlers = makeHandlers([A1]);
    const onSave = vi.fn(() => true);
    const carga = { id: 'crg-existente', date: '2026-10-05', product: 'Pinus Teste', productId: 'p1', quantityTons: 10, valuePerTon: 100, totalValue: 1000 };
    render(<RecordModal {...baseProps} recordToEdit={carga} onSave={onSave} attachmentHandlers={handlers as any} isDateLocked={() => false} />);
    expect(await screen.findByText('Romaneio 123.pdf')).toBeTruthy();
    expect(handlers.loadCargaAttachments).toHaveBeenCalledWith('crg-existente');
    submit();
    const saved = (onSave.mock.calls[0] as any[])[0];
    expect(saved.id).toBe('crg-existente');
    expect('attachments' in saved).toBe(false); // anexos não vão no registro da carga
  });

  it('trocar a data para um mês trancado desabilita adicionar e excluir', async () => {
    const handlers = makeHandlers([A1]);
    const carga = { id: 'crg-existente', date: '2026-10-05', product: 'Pinus Teste', productId: 'p1', quantityTons: 10, valuePerTon: 100, totalValue: 1000 };
    render(<RecordModal {...baseProps} recordToEdit={carga} onSave={vi.fn()} attachmentHandlers={handlers as any} isDateLocked={(d) => Boolean(d && d.startsWith('2026-08'))} />);
    await screen.findByText('Romaneio 123.pdf');
    expect((screen.getByText('Adicionar PDF').closest('button') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2026-08-10' } });
    expect((screen.getByText('Adicionar PDF').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Excluir Romaneio 123.pdf') as HTMLButtonElement).disabled).toBe(true);
  });

  it('formulário de depósito não tem a seção, e sem handlers a carga também não (comportamento atual)', () => {
    const { unmount } = render(<RecordModal {...baseProps} tableType="Depositos_Klabin" recordToEdit={null} onSave={vi.fn()} attachmentHandlers={makeHandlers() as any} isDateLocked={() => false} />);
    expect(screen.queryByTestId('carga-attachments')).toBeNull();
    unmount();
    render(<RecordModal {...baseProps} recordToEdit={null} onSave={vi.fn()} />);
    expect(screen.queryByTestId('carga-attachments')).toBeNull();
  });
});
