import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GestaoClientesDashboard } from '../components/GestaoClientesDashboard';

afterEach(cleanup);

const noop = vi.fn();
const cliente = { id: 'cl1', name: 'Cliente A', contact: '', notes: '', createdAt: '2026-01-01T00:00:00Z' };
const venda = (id: string, date: string) => ({
  id,
  date,
  clientId: 'cl1',
  clientName: 'Cliente A',
  product: 'Pinus',
  quantity: 1,
  unitPrice: 100,
  totalValue: 100,
  status: 'PAID',
  paidAt: `${date}T12:00:00Z`,
  notes: '',
  createdAt: `${date}T12:00:00Z`,
});

const renderDashboard = (lockedMonths: string[]) => render(
  <GestaoClientesDashboard
    clientes={[cliente]}
    vendas={[venda('closed', '2026-08-25'), venda('open', '2026-09-02')] as any}
    produtos={[]}
    lockedMonths={lockedMonths}
    onAddClient={noop}
    onUpdateClient={noop}
    onDeleteClient={noop}
    onAddVenda={noop}
    onUpdateVenda={noop}
    onDeleteVenda={noop}
    onToggleVendaStatus={noop}
  />
);

describe('contagem de quitados por competência aberta', () => {
  it('exclui competências fechadas do badge sem remover vendas do histórico e reage à reabertura', () => {
    const view = renderDashboard(['2026-08']);

    expect(screen.getByRole('button', { name: 'Quitadas (1)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitadas (1)' }));
    expect(screen.getAllByText('25/08/2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('02/09/2026').length).toBeGreaterThan(0);

    view.rerender(
      <GestaoClientesDashboard
        clientes={[cliente]}
        vendas={[venda('closed', '2026-08-25'), venda('open', '2026-09-02')] as any}
        produtos={[]}
        lockedMonths={[]}
        onAddClient={noop}
        onUpdateClient={noop}
        onDeleteClient={noop}
        onAddVenda={noop}
        onUpdateVenda={noop}
        onDeleteVenda={noop}
        onToggleVendaStatus={noop}
      />
    );
    expect(screen.getByRole('button', { name: 'Quitadas (2)' })).toBeTruthy();
  });
});
