import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoricoDashboard } from '../components/HistoricoDashboard';
import { CargaRecord, DepositoKlabinRecord } from '../types';

afterEach(cleanup);

const noop = vi.fn();

const carga = (id: string, date: string, totalValue: number): CargaRecord => ({
  id,
  date,
  quantityTons: 1,
  totalValue,
  deductFromBalance: true,
});

const deposito = (id: string, date: string, value: number): DepositoKlabinRecord => ({
  id,
  date,
  value,
});

describe('HistoricoDashboard — múltiplas competências e competência sem registros', () => {
  it('lista cada competência trancada com seus próprios totais, mais recente primeiro', () => {
    render(
      <HistoricoDashboard
        cargas={[carga('c1', '2026-07-10', 100), carga('c2', '2026-08-10', 200)]}
        depositos={[deposito('d1', '2026-07-11', 500), deposito('d2', '2026-08-11', 1000)]}
        lockedMonths={['2026-07', '2026-08']}
        onDeleteCarga={noop}
        onUpdateCargaRecord={noop}
        onDeleteDeposito={noop}
        onUpdateDepositoRecord={noop}
      />
    );

    const cards = screen.getAllByRole('button').filter((btn) => /de 2026/.test(btn.textContent || ''));
    expect(cards.map((c) => c.textContent?.match(/^\w+ de 2026/)?.[0])).toEqual([
      'Agosto de 2026',
      'Julho de 2026',
    ]);

    const augustCard = screen.getByText('Agosto de 2026').closest('button')!;
    expect(within(augustCard).getByText('R$ 800,00')).toBeTruthy(); // 1000 depósito - 200 abatido

    const julyCard = screen.getByText('Julho de 2026').closest('button')!;
    expect(within(julyCard).getByText('R$ 400,00')).toBeTruthy(); // 500 depósito - 100 abatido
  });

  it('mostra uma competência trancada sem nenhuma carga ou depósito com totais zerados', () => {
    render(
      <HistoricoDashboard
        cargas={[]}
        depositos={[]}
        lockedMonths={['2026-06']}
        onDeleteCarga={noop}
        onUpdateCargaRecord={noop}
        onDeleteDeposito={noop}
        onUpdateDepositoRecord={noop}
      />
    );

    const card = screen.getByText('Junho de 2026').closest('button')!;
    expect(within(card).getByText('R$ 0,00')).toBeTruthy();
    expect(within(card).getAllByText('0')).toHaveLength(2); // contagem de cargas e de depósitos, ambas zeradas
  });
});
