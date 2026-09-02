import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableMotoristas } from '../components/TableMotoristas';

afterEach(cleanup);

const noop = vi.fn();

const motoristas = [
  { id: 'm2', name: 'Carlos Oliveira', licensePlate: 'XYZ-5678', status: 'ACTIVE' },
  { id: 'm1', name: 'João Silva', licensePlate: 'ABC-1234', status: 'ACTIVE' },
  { id: 'm3', name: 'Pedro Santos', licensePlate: 'MNO-9012', status: 'ACTIVE' },
];

const carga = (id: string, date: string, extra: Record<string, unknown> = {}) => ({
  id,
  date,
  product: 'Pinus',
  quantityTons: 10,
  totalValue: 1000,
  freightPayable: 'YES',
  freightCost: 150,
  freightStatus: 'PENDING',
  ...extra,
});

const venda = (id: string, date: string, extra: Record<string, unknown> = {}) => ({
  id,
  date,
  clientId: 'c1',
  clientName: 'Cliente',
  product: 'Eucalipto',
  quantity: 5,
  unitPrice: 100,
  totalValue: 500,
  status: 'PENDING',
  notes: '',
  createdAt: `${date}T13:45:00.000Z`,
  freightPayable: 'YES',
  freightCost: 80,
  freightStatus: 'PENDING',
  ...extra,
});

/** Every driver block on the "Contas de Frete por Motorista" tab. */
const cards = () =>
  screen.getAllByRole('heading', { level: 3 }).map((heading) => ({
    nome: heading.textContent ?? '',
    card: heading.closest('.glass-card-static') as HTMLElement,
  }));

/** Freight dates of one block, read from the first cell of each row. */
const datasDoCard = (card: HTMLElement) =>
  within(card)
    .getAllByRole('row')
    .slice(1) // skip the header row
    .map((row) => row.querySelectorAll('td')[0]?.textContent?.trim() ?? '');

const paraIso = (data: string) => {
  const [dia, mes, ano] = data.split('/');
  return `${ano}-${mes}-${dia}`;
};

const estaDecrescente = (datas: string[]) =>
  datas.every((data, index) => index === 0 || paraIso(datas[index - 1]) >= paraIso(data));

const renderTela = (props: { cargas: unknown[]; vendas: unknown[]; searchTerm?: string }) =>
  render(
    <TableMotoristas
      cargas={props.cargas as any}
      vendas={props.vendas as any}
      motoristas={motoristas as any}
      freightRatePerTon={15}
      searchTerm={props.searchTerm ?? ''}
      onPayFreight={noop}
      onRevertFreight={noop}
      onToggleSingleFreight={noop}
      onAddMotorista={noop}
      onUpdateMotorista={noop}
      onDeleteMotorista={noop}
    />
  );

describe('Contas de Frete por Motorista', () => {
  it('desenha um único card por motorista, mesmo com driverId órfão de um cadastro apagado', () => {
    // The same physical driver reaches the screen two ways: an old Carga still
    // carrying the id of a deleted Motorista, and a Venda that only has the
    // plate. Both render under the same label, so two blocks read as one block
    // whose dates jump back up in the middle.
    renderTela({
      cargas: [carga('c1', '2026-08-26', { driverId: 'motorista-apagado', driverPlate: 'QRS-3344' })],
      vendas: [venda('v1', '2026-08-20', { driverPlate: 'QRS-3344' })],
    });

    const nomes = cards().map((c) => c.nome);
    expect(nomes).toEqual([...new Set(nomes)]);
    expect(nomes.filter((nome) => nome.includes('QRS-3344'))).toHaveLength(1);
  });

  it('ordena as linhas de cada motorista da data mais recente para a mais antiga', () => {
    renderTela({
      cargas: [
        carga('c1', '2026-03-10', { driverId: 'm1' }),
        carga('c2', '2026-08-27', { driverId: 'm1' }),
        carga('c3', '2026-01-05', { driverId: 'm1', freightStatus: 'PAID', freightPaidAt: '2026-02-02' }),
        carga('c4', '2026-06-15', { driverId: 'm2' }),
      ],
      vendas: [
        venda('v1', '2026-05-22', { driverId: 'm1' }),
        venda('v2', '2026-09-01', { driverId: 'm2' }),
      ],
    });

    for (const { nome, card } of cards()) {
      const datas = datasDoCard(card);
      expect(datas.length).toBeGreaterThan(0);
      expect(estaDecrescente(datas), `card de ${nome}: ${datas.join(', ')}`).toBe(true);
    }
  });

  it('mantém juntas as linhas do mesmo dia, sem separar CARGA de VENDA', () => {
    renderTela({
      cargas: [
        carga('c1', '2026-08-26', { driverId: 'm1' }),
        carga('c2', '2026-08-20', { driverId: 'm1' }),
      ],
      vendas: [venda('v1', '2026-08-26', { driverId: 'm1' })],
    });

    const [{ card }] = cards();
    expect(datasDoCard(card)).toEqual(['26/08/2026', '26/08/2026', '20/08/2026']);
  });

  it('lista os motoristas com o frete mais recente no topo', () => {
    renderTela({
      cargas: [
        carga('c1', '2026-02-10', { driverId: 'm2' }),
        carga('c2', '2026-09-15', { driverId: 'm3' }),
        carga('c3', '2026-05-04', { driverId: 'm1' }),
      ],
      vendas: [],
    });

    expect(cards().map((c) => c.nome)).toEqual([
      'Pedro Santos / MNO-9012',
      'João Silva / ABC-1234',
      'Carlos Oliveira / XYZ-5678',
    ]);
  });

  it('preserva a ordem quando a busca filtra os motoristas', () => {
    renderTela({
      cargas: [
        carga('c1', '2026-03-01', { driverId: 'm1' }),
        carga('c2', '2026-07-01', { driverId: 'm1' }),
        carga('c3', '2026-09-01', { driverId: 'm2' }),
      ],
      vendas: [],
      searchTerm: 'João',
    });

    const encontrados = cards();
    expect(encontrados).toHaveLength(1);
    expect(datasDoCard(encontrados[0].card)).toEqual(['01/07/2026', '01/03/2026']);
  });
});
