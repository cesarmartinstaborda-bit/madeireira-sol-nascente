import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableCargas } from '../components/TableCargas';
import { TableDepositos } from '../components/TableDepositos';
import { GestaoClientesDashboard } from '../components/GestaoClientesDashboard';
import { TableMotoristas } from '../components/TableMotoristas';
import { DashboardOverview } from '../components/DashboardOverview';

afterEach(cleanup);

const noop = vi.fn();
const displayedDates = () => screen.getAllByText(/^\d{2}\/\d{2}\/\d{4}$/).map((node) => node.textContent);

describe('listagens operacionais com data', () => {
  it('ordena Cargas depois do filtro e reposiciona após edição', () => {
    const records = [
      { id: 'c20', date: '2026-08-20', product: 'Pinus', quantityTons: 1, totalValue: 330 },
      { id: 'c26', date: '2026-08-26', product: 'Pinus', quantityTons: 1, totalValue: 330 },
      { id: 'c24', date: '2026-08-24', product: 'Pinus', quantityTons: 1, totalValue: 330 },
    ] as any;
    const props = { searchTerm: '', onDelete: noop, onAdd: noop, onUpdateRecord: noop };
    const view = render(<TableCargas {...props} records={records} />);
    expect(displayedDates()).toEqual(['26/08/2026', '24/08/2026', '20/08/2026']);
    view.rerender(<TableCargas {...props} records={records.map((r: any) => r.id === 'c20' ? { ...r, date: '2026-08-27' } : r)} />);
    expect(displayedDates()).toEqual(['27/08/2026', '26/08/2026', '24/08/2026']);
  });

  it('ordena Depósitos, inclusive cadastro retroativo', () => {
    render(<TableDepositos records={[
      { id: 'd26', date: '2026-08-26', value: 1 },
      { id: 'd24', date: '2026-08-24', value: 1 },
      { id: 'd18', date: '2026-08-18', value: 1 },
    ]} searchTerm="" onEdit={noop} onDelete={noop} onAdd={noop} />);
    expect(displayedDates()).toEqual(['26/08/2026', '24/08/2026', '18/08/2026']);
  });

  it('ordena Vendas dentro do agrupamento após o filtro de status', () => {
    const cliente = { id: 'cl1', name: 'Cliente A', contact: '', notes: '', createdAt: '2026-01-01T00:00:00Z' };
    const venda = (id: string, date: string) => ({ id, date, clientId: 'cl1', clientName: 'Cliente A', product: 'Pinus', quantity: 1, unitPrice: 1, totalValue: 1, status: 'PENDING', notes: '', createdAt: `${date}T12:00:00Z` });
    render(<GestaoClientesDashboard clientes={[cliente]} vendas={[venda('v20', '2026-08-20'), venda('v26', '2026-08-26'), venda('v24', '2026-08-24')] as any} produtos={[]} onAddClient={noop} onUpdateClient={noop} onDeleteClient={noop} onAddVenda={noop} onUpdateVenda={noop} onDeleteVenda={noop} onToggleVendaStatus={noop} />);
    expect(displayedDates()).toEqual(['26/08/2026', '24/08/2026', '20/08/2026']);
  });

  it('ordena a tabela derivada de Fretes pela data da carga/venda', () => {
    const motorista = { id: 'm1', name: 'Motorista', licensePlate: 'ABC-1234' };
    const carga = (id: string, date: string) => ({ id, date, driverId: 'm1', product: 'Pinus', quantityTons: 1, totalValue: 1, freightPayable: 'YES', freightCost: 15 });
    render(<TableMotoristas cargas={[carga('c20', '2026-08-20'), carga('c26', '2026-08-26'), carga('c24', '2026-08-24')] as any} vendas={[]} motoristas={[motorista] as any} freightRatePerTon={15} searchTerm="" onPayFreight={noop} onRevertFreight={noop} onToggleSingleFreight={noop} onAddMotorista={noop} onUpdateMotorista={noop} onDeleteMotorista={noop} />);
    expect(displayedDates()).toEqual(['26/08/2026', '24/08/2026', '20/08/2026']);
  });

  it('ordena Últimas Movimentações globalmente antes de limitar a oito itens', () => {
    const carga = (id: string, date: string) => ({ id, date, quantityTons: 1, totalValue: 1 });
    const database = { Cargas: [carga('old', '2026-01-01'), ...Array.from({ length: 8 }, (_, i) => carga(`c${i}`, `2026-08-${String(20 + i).padStart(2, '0')}`))], Depositos_Klabin: [{ id: 'retro', date: '2025-12-31', value: 1 }], Vendas: [], Frete: [] } as any;
    render(<DashboardOverview database={database} onNavigate={noop} onToggleLockMonth={noop} />);
    const section = screen.getByText('Últimas Movimentações Operacionais').parentElement?.parentElement as HTMLElement;
    const dates = within(section).getAllByText(/^\d{2}\/\d{2}\/\d{4}$/).map((node) => node.textContent);
    expect(dates).toEqual(['27/08/2026', '26/08/2026', '25/08/2026', '24/08/2026', '23/08/2026', '22/08/2026', '21/08/2026', '20/08/2026']);
  });
});
