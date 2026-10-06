import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableCargas } from '../components/TableCargas';
import { ATTACHMENTS_CHANGED_EVENT } from '../utils/cargaAttachments';

const cargas = [
  { id: 'c-com', date: '2026-10-05', product: 'Pinus', quantityTons: 10, valuePerTon: 100, totalValue: 1000 },
  { id: 'c-um', date: '2026-10-04', product: 'Eucalipto', quantityTons: 5, valuePerTon: 100, totalValue: 500 },
  { id: 'c-sem', date: '2026-10-03', product: 'Cavaco', quantityTons: 2, valuePerTon: 100, totalValue: 200 },
] as any[];

const renderTable = (lockedMonths: string[] = []) =>
  render(<TableCargas records={cargas} searchTerm="" onDelete={vi.fn()} onAdd={vi.fn()} onUpdateRecord={vi.fn()} lockedMonths={lockedMonths} />);

function installSummary(initial: Record<string, number>) {
  let current = initial;
  const summary = vi.fn(async () => ({ ok: true, data: current }));
  (window as any).electron = { isElectron: true, attachments: { summary } };
  return { summary, set: (next: Record<string, number>) => { current = next; } };
}

afterEach(() => { cleanup(); delete (window as any).electron; vi.clearAllMocks(); });

describe('TableCargas — indicador de anexos', () => {
  it('mostra clipe com a quantidade só nas cargas que têm anexos', async () => {
    installSummary({ 'c-com': 3, 'c-um': 1 });
    renderTable();
    await waitFor(() => expect(screen.getAllByTestId('attachment-indicator')).toHaveLength(2));
    const [first, second] = screen.getAllByTestId('attachment-indicator');
    expect(first.textContent).toBe('3');
    expect(first.getAttribute('title')).toBe('3 anexos PDF');
    expect(second.textContent).toBe('1');
    expect(second.getAttribute('title')).toBe('1 anexo PDF');
  });

  it('sem anexos (ou fora do Electron) a tabela fica exatamente como é hoje', async () => {
    const without = renderTable().container.innerHTML;
    cleanup();
    installSummary({});
    const { container } = renderTable();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryAllByTestId('attachment-indicator')).toHaveLength(0);
    expect(container.innerHTML).toBe(without);
  });

  it('atualiza quando os anexos mudam', async () => {
    const bridge = installSummary({});
    renderTable();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryAllByTestId('attachment-indicator')).toHaveLength(0);
    bridge.set({ 'c-sem': 2 });
    act(() => { window.dispatchEvent(new Event(ATTACHMENTS_CHANGED_EVENT)); });
    await waitFor(() => expect(screen.getByTestId('attachment-indicator').textContent).toBe('2'));
  });

  it('cargas de mês trancado também mostram o indicador, sem mudar o bloqueio de edição', async () => {
    installSummary({ 'c-com': 1 });
    renderTable(['2026-10']);
    await screen.findByTestId('attachment-indicator');
    expect((screen.getAllByTitle('Editar registro')[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('falha ao ler a contagem não quebra a tabela', async () => {
    (window as any).electron = { isElectron: true, attachments: { summary: vi.fn(async () => { throw new Error('x'); }) } };
    renderTable();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Registro de Cargas (3)')).toBeTruthy();
  });
});

describe('TableCargas — contagens fora de ordem', () => {
  afterEach(() => { cleanup(); delete (window as any).electron; });

  it('uma resposta antiga que chega depois da nova não sobrescreve a contagem', async () => {
    const resolvers: Array<(v: any) => void> = [];
    (window as any).electron = { isElectron: true, attachments: { summary: vi.fn(() => new Promise((resolve) => { resolvers.push(resolve); })) } };
    renderTable();                                              // 1ª leitura (inicial)
    act(() => { window.dispatchEvent(new Event(ATTACHMENTS_CHANGED_EVENT)); }); // 2ª leitura (mudança)
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => { resolvers[1]({ ok: true, data: { 'c-com': 2 } }); });   // a nova responde primeiro
    await act(async () => { resolvers[0]({ ok: true, data: { 'c-com': 9 } }); });   // a antiga chega depois
    expect(screen.getByTestId('attachment-indicator').textContent).toBe('2');
  });
});
