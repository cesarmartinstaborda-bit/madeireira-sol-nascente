import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableMotoristas } from '../components/TableMotoristas';

afterEach(cleanup);

const noop = vi.fn();

const motoristas = [
  { id: 'm1', name: 'João Silva', licensePlate: 'ABC-1234', status: 'ACTIVE' },
];

const carga = (id: string, date: string, extra: Record<string, unknown> = {}) => ({
  id,
  date,
  product: 'Pinus',
  quantityTons: 10,
  totalValue: 1000,
  driverId: 'm1',
  freightPayable: 'YES',
  freightCost: 150,
  freightStatus: 'PENDING',
  ...extra,
});

const renderTela = (
  props: {
    cargas: unknown[];
    vendas?: unknown[];
    lockedMonths?: string[];
    onToggleSingleFreight?: (type: 'CARGA' | 'VENDA', id: string) => void;
  }
) =>
  render(
    <TableMotoristas
      cargas={props.cargas as any}
      vendas={(props.vendas ?? []) as any}
      motoristas={motoristas as any}
      freightRatePerTon={15}
      searchTerm=""
      lockedMonths={props.lockedMonths}
      onPayFreight={noop}
      onRevertFreight={noop}
      onToggleSingleFreight={(props.onToggleSingleFreight ?? noop) as any}
      onAddMotorista={noop}
      onUpdateMotorista={noop}
      onDeleteMotorista={noop}
    />
  );

const goToTab = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));

/** The three values in the metrics bar (Total Geral / Pendentes / Quitados). */
const metricValues = () =>
  Array.from(document.querySelectorAll('.glass-card .font-mono')).map((el) => el.textContent?.trim() ?? '');

describe('Gestão de Motoristas — abas de fretes pendentes x quitados', () => {
  it('mostra o frete pendente só na aba de pendentes e o quitado só em "Fretes Quitados"', () => {
    renderTela({
      cargas: [
        carga('c1', '2026-08-26'),
        carga('c2', '2026-07-15', { freightStatus: 'PAID', freightPaidAt: '2026-07-20' }),
      ],
    });

    // Aba padrão = pendentes
    expect(screen.getByText('26/08/2026')).toBeTruthy();
    expect(screen.queryByText('15/07/2026')).toBeNull();

    goToTab('Fretes Quitados');
    expect(screen.getByText('15/07/2026')).toBeTruthy();
    expect(screen.queryByText('26/08/2026')).toBeNull();

    goToTab('Contas de Frete por Motorista');
    expect(screen.getByText('26/08/2026')).toBeTruthy();
    expect(screen.queryByText('15/07/2026')).toBeNull();
  });

  it('a aba "Fretes Quitados" tem ação "Reverter para Pendente" por linha que chama onToggleSingleFreight', () => {
    const onToggleSingleFreight = vi.fn();
    renderTela({
      cargas: [carga('c2', '2026-07-15', { freightStatus: 'PAID', freightPaidAt: '2026-07-20' })],
      onToggleSingleFreight,
    });

    goToTab('Fretes Quitados');
    const btn = screen.getByRole('button', { name: 'Reverter para Pendente' });
    fireEvent.click(btn);
    expect(onToggleSingleFreight).toHaveBeenCalledWith('CARGA', 'c2');

    // Na aba de pendentes o rótulo continua "Alternar Status"
    goToTab('Contas de Frete por Motorista');
    expect(screen.queryByRole('button', { name: 'Reverter para Pendente' })).toBeNull();
  });

  it('um motorista sem fretes quitados não aparece na aba "Fretes Quitados"', () => {
    renderTela({ cargas: [carga('c1', '2026-08-26')] });

    goToTab('Fretes Quitados');
    expect(screen.getByText('Nenhum frete quitado encontrado.')).toBeTruthy();
    expect(screen.queryByText('João Silva / ABC-1234')).toBeNull();
  });

  it('os indicadores (Total Geral / Pendentes / Quitados) não mudam ao trocar de aba', () => {
    renderTela({
      cargas: [
        carga('c1', '2026-08-26'),
        carga('c2', '2026-07-15', { freightStatus: 'PAID', freightPaidAt: '2026-07-20' }),
      ],
    });

    const pendingTabMetrics = metricValues();
    goToTab('Fretes Quitados');
    expect(metricValues()).toEqual(pendingTabMetrics);
    // total geral = 300, pendente = 150, quitado = 150 → nenhum é zero
    expect(pendingTabMetrics.every((v) => v.length > 0)).toBe(true);
  });

  it('conta no badge somente quitados de competências abertas e mantém o histórico fechado', () => {
    const props = {
      cargas: [
        carga('closed', '2026-08-25', { freightStatus: 'PAID', freightPaidAt: '2026-08-26' }),
        carga('open', '2026-09-02', { freightStatus: 'PAID', freightPaidAt: '2026-09-03' }),
      ],
      lockedMonths: ['2026-08'],
    };
    const view = renderTela(props);

    expect(screen.getByRole('button', { name: 'Fretes Quitados (1)' })).toBeTruthy();
    goToTab('Fretes Quitados');
    expect(screen.getByText('25/08/2026')).toBeTruthy();
    expect(screen.getByText('02/09/2026')).toBeTruthy();

    view.rerender(
      <TableMotoristas
        cargas={props.cargas as any}
        vendas={[]}
        motoristas={motoristas as any}
        freightRatePerTon={15}
        searchTerm=""
        lockedMonths={[]}
        onPayFreight={noop}
        onRevertFreight={noop}
        onToggleSingleFreight={noop}
        onAddMotorista={noop}
        onUpdateMotorista={noop}
        onDeleteMotorista={noop}
      />
    );
    expect(screen.getByRole('button', { name: 'Fretes Quitados (2)' })).toBeTruthy();
  });
});
