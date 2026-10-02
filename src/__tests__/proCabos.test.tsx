import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordModal } from '../components/RecordModal';
import { regressionDatabase } from './fixtures/regressionDatabase';
import { getFreightRecords, getPendingFreightTotal } from '../utils/freightUtils';
import { calcKlabinBalance } from '../utils/klabinBalance';
import {
  PRO_CABOS_LABOR_RATE_PER_TON,
  calcProCabosAmountDue,
  getProCabosCargas,
  getProCabosLaborRate,
  isProCabosCarga,
  sumProCabosAmountDue,
} from '../utils/proCabos';
import { sanitizeDatabase } from '../utils/storage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const proCabosCarga = (overrides: Record<string, unknown> = {}) => ({
  ...regressionDatabase().Cargas[0],
  id: 'pc1',
  quantityTons: 40,
  valuePerTon: 200,
  totalValue: 8000,
  proCabos: true,
  proCabosLaborRatePerTon: 115,
  ...overrides,
});

describe('Pro Cabos — regra de cálculo', () => {
  it('a tarifa vigente de mão de obra é R$ 115,00/t', () => {
    expect(PRO_CABOS_LABOR_RATE_PER_TON).toBe(115);
  });

  it('valor devido = toneladas × (valor unitário Klabin + mão de obra)', () => {
    expect(calcProCabosAmountDue(proCabosCarga() as any)).toBe(40 * (200 + 115));
    expect(calcProCabosAmountDue(proCabosCarga({ quantityTons: 37.48, valuePerTon: 189.9 }) as any)).toBe(11427.65);
  });

  it('arredonda meio centavo para cima, sem resíduo de ponto flutuante', () => {
    expect(calcProCabosAmountDue(proCabosCarga({ quantityTons: 20.05, valuePerTon: 99.9 }) as any)).toBe(4308.75);
    expect(calcProCabosAmountDue(proCabosCarga({ quantityTons: 20.06, valuePerTon: 150.25 }) as any)).toBe(5320.92);
  });

  it('usa a tarifa gravada na carga, não a vigente', () => {
    const antiga = proCabosCarga({ proCabosLaborRatePerTon: 100 });
    expect(getProCabosLaborRate(antiga)).toBe(100);
    expect(calcProCabosAmountDue(antiga as any)).toBe(40 * (200 + 100));
  });

  it('carga não-Pro Cabos não gera valor devido', () => {
    expect(calcProCabosAmountDue(proCabosCarga({ proCabos: false }) as any)).toBe(0);
    expect(calcProCabosAmountDue(regressionDatabase().Cargas[0] as any)).toBe(0);
  });
});

describe('Pro Cabos — persistência e compatibilidade', () => {
  it('carga antiga sem o campo é normalizada como não-Pro Cabos, sem tarifa e com o frete de sempre', () => {
    const [carga] = sanitizeDatabase(regressionDatabase()).Cargas;
    expect(isProCabosCarga(carga)).toBe(false);
    expect(carga.proCabos).toBe(false);
    expect(carga).not.toHaveProperty('proCabosLaborRatePerTon');
    expect(carga.freightPayable).toBe(true);
    expect(carga.freightCost).toBe(30);
  });

  it('carga marcada mantém a flag e a tarifa gravada após sanitizar', () => {
    const raw = regressionDatabase();
    raw.Cargas.push(proCabosCarga({ proCabosLaborRatePerTon: 100 }) as any);
    const carga = sanitizeDatabase(raw).Cargas.find((c) => c.id === 'pc1')!;
    expect(carga.proCabos).toBe(true);
    expect(carga.proCabosLaborRatePerTon).toBe(100);
  });

  it('carga marcada sem tarifa gravada recebe a tarifa vigente', () => {
    const raw = regressionDatabase();
    raw.Cargas.push(proCabosCarga({ proCabosLaborRatePerTon: undefined }) as any);
    const carga = sanitizeDatabase(raw).Cargas.find((c) => c.id === 'pc1')!;
    expect(carga.proCabosLaborRatePerTon).toBe(115);
  });

  it('desmarcar preserva `proCabos: false` explícito para sobrescrever a nuvem', () => {
    const raw = regressionDatabase();
    raw.Cargas.push(proCabosCarga({ proCabos: false }) as any);
    const carga = sanitizeDatabase(raw).Cargas.find((c) => c.id === 'pc1')!;
    expect(carga.proCabos).toBe(false);
  });

  it('sanitizar força carga Pro Cabos a ficar sem frete, mesmo com frete gravado', () => {
    const raw = regressionDatabase();
    raw.Cargas.push(proCabosCarga({ freightPayable: 'YES', freightCost: 600 }) as any);
    const carga = sanitizeDatabase(raw).Cargas.find((c) => c.id === 'pc1')!;
    expect(carga.freightPayable).toBe(false);
    expect(carga.freightCost).toBe(0);
  });
});

describe('Pro Cabos — efeitos sobre Klabin e frete', () => {
  it('não gera valor a pagar para motorista', () => {
    const raw = regressionDatabase();
    const fretePendenteAntes = getPendingFreightTotal(sanitizeDatabase(raw));
    raw.Cargas.push(proCabosCarga({ freightPayable: 'YES', freightCost: 600 }) as any);
    const db = sanitizeDatabase(raw);
    expect(getFreightRecords(db).some((r) => r.id === 'pc1')).toBe(false);
    expect(getPendingFreightTotal(db)).toBe(fretePendenteAntes);
  });

  it('a projeção de frete ignora carga Pro Cabos mesmo sem passar pela sanitização', () => {
    const db = { Cargas: [proCabosCarga({ freightPayable: 'YES', freightCost: 600 })], Vendas: [], Motoristas: [] } as any;
    expect(getFreightRecords(db)).toHaveLength(0);
  });

  it('o abatimento do Saldo Livre Klabin é idêntico com ou sem a marcação', () => {
    const depositos = regressionDatabase().Depositos_Klabin as any;
    const semMarca = sanitizeDatabase({ ...regressionDatabase(), Cargas: [proCabosCarga({ proCabos: false })] }).Cargas;
    const comMarca = sanitizeDatabase({ ...regressionDatabase(), Cargas: [proCabosCarga()] }).Cargas;
    expect(calcKlabinBalance({ cargas: comMarca, depositos })).toEqual(calcKlabinBalance({ cargas: semMarca, depositos }));
    expect(calcKlabinBalance({ cargas: comMarca, depositos }).totalAbatido).toBe(8000);
  });

  it('a projeção deriva das cargas Klabin: edição e exclusão refletem sem cadastro próprio', () => {
    const cargas = sanitizeDatabase({ ...regressionDatabase(), Cargas: [...regressionDatabase().Cargas, proCabosCarga()] }).Cargas;
    expect(getProCabosCargas(cargas).map((c) => c.id)).toEqual(['pc1']);
    expect(sumProCabosAmountDue(cargas)).toBe(12600);

    const editadas = cargas.map((c) => (c.id === 'pc1' ? { ...c, quantityTons: 10 } : c));
    expect(sumProCabosAmountDue(editadas)).toBe(3150);

    expect(sumProCabosAmountDue(cargas.filter((c) => c.id !== 'pc1'))).toBe(0);
  });
});

describe('Pro Cabos — cadastro de carga', () => {
  const produtos = [{ id: 'p1', name: 'Pinus Teste', unitOfMeasure: 'ton', referencePrice: 200, status: 'ACTIVE' }] as any;
  const baseProps = {
    isOpen: true,
    tableType: 'Cargas' as const,
    onClose: vi.fn(),
    produtos,
    clientes: [],
    motoristas: [],
    freightRatePerTon: 15,
  };
  const submit = () => fireEvent.submit(document.querySelector('form')!);
  const checkbox = () => screen.getByLabelText(/Carga da Pro Cabos/) as HTMLInputElement;

  it('vem desmarcada e, assim, salva a carga com o frete de sempre', () => {
    const onSave = vi.fn(() => true);
    render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} />);
    expect(checkbox().checked).toBe(false);
    fireEvent.change(screen.getByPlaceholderText('Ex: João Silva / ABC-1234'), { target: { value: 'João / ABC-1234' } });
    submit();
    const saved = (onSave.mock.calls[0] as any[])[0];
    expect(saved).toMatchObject({ proCabos: false, freightPayable: 'YES', freightCost: 600, totalValue: 8000 });
    expect(saved).not.toHaveProperty('proCabosLaborRatePerTon');
  });

  it('marcada, grava a tarifa vigente na carga e zera o frete do motorista', () => {
    const onSave = vi.fn(() => true);
    render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} />);
    fireEvent.click(checkbox());
    expect(screen.getByText(/Valor devido pela Pro Cabos/).textContent).toContain('12.600,00');
    submit();
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({
      proCabos: true,
      proCabosLaborRatePerTon: 115,
      freightPayable: 'NO',
      freightCost: 0,
      totalValue: 8000,
      deductFromBalance: 'YES',
    });
  });

  it('desmarcar na edição devolve o frete padrão, igual ao que a tela mostra', () => {
    const onSave = vi.fn(() => true);
    const recordToEdit = sanitizeDatabase({ ...regressionDatabase(), Cargas: [proCabosCarga()] }).Cargas[0];
    render(<RecordModal {...baseProps} recordToEdit={recordToEdit} onSave={onSave} />);
    fireEvent.click(checkbox());
    expect(screen.getByDisplayValue('600,00')).toBeTruthy();
    submit();
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({ proCabos: false, freightPayable: 'YES', freightCost: 600 });
  });

  it('não deixa marcar carga cujo frete já foi pago ao motorista', () => {
    const onSave = vi.fn(() => true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const recordToEdit = sanitizeDatabase({
      ...regressionDatabase(),
      Cargas: [proCabosCarga({ proCabos: false, freightStatus: 'PAID', freightPaidAt: '2026-08-25T12:00:00Z' })],
    }).Cargas[0];
    render(<RecordModal {...baseProps} recordToEdit={recordToEdit} onSave={onSave} />);
    fireEvent.click(checkbox());
    submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('já foi pago'));
    alertSpy.mockRestore();
  });

  it('marcação cancelada não reaparece ao reabrir o cadastro de nova carga', () => {
    const onSave = vi.fn(() => true);
    const { rerender } = render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} />);
    fireEvent.click(checkbox());
    rerender(<RecordModal {...baseProps} isOpen={false} recordToEdit={null} onSave={onSave} />);
    rerender(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} />);
    expect(checkbox().checked).toBe(false);
  });

  it('ao editar, mantém a tarifa antiga gravada na carga', () => {
    const onSave = vi.fn(() => true);
    const recordToEdit = sanitizeDatabase({
      ...regressionDatabase(),
      Cargas: [proCabosCarga({ proCabosLaborRatePerTon: 100 })],
    }).Cargas[0];
    render(<RecordModal {...baseProps} recordToEdit={recordToEdit} onSave={onSave} />);
    expect(checkbox().checked).toBe(true);
    submit();
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({ id: 'pc1', proCabos: true, proCabosLaborRatePerTon: 100 });
  });
});
