import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordModal } from '../components/RecordModal';
import { regressionDatabase } from './fixtures/regressionDatabase';
import { sanitizeDatabase } from '../utils/storage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const motoristas = [{ id: 'm1', name: 'Motorista Teste', licensePlate: 'ABC-1234', status: 'ACTIVE' }] as any;
const baseProps = {
  isOpen: true,
  tableType: 'Cargas' as const,
  onClose: vi.fn(),
  produtos: [{ id: 'p1', name: 'Pinus Teste', unitOfMeasure: 'ton', referencePrice: 100, status: 'ACTIVE' }] as any,
  clientes: [],
  motoristas,
  freightRatePerTon: 15,
};

const NO_DRIVER = { driverId: undefined, motoristaId: undefined, driverPlate: undefined, licensePlate: undefined };

const sanitizedCarga = (overrides: Record<string, unknown>) =>
  sanitizeDatabase({
    ...regressionDatabase(),
    Cargas: [{ ...regressionDatabase().Cargas[0], quantityTons: 40, totalValue: 4000, ...overrides }],
  }).Cargas[0];

const saveUnchanged = (recordToEdit: unknown, props: Record<string, unknown> = {}) => {
  const onSave = vi.fn(() => true);
  render(<RecordModal {...baseProps} {...props} recordToEdit={recordToEdit} onSave={onSave} />);
  fireEvent.submit(document.querySelector('form')!);
  return (onSave.mock.calls[0] as any[])[0];
};

describe('RecordModal — carga sem motorista não gera frete', () => {
  it('editar carga sem motorista e salvar sem alterar mantém sem motorista e sem frete', () => {
    const recordToEdit = sanitizedCarga({ ...NO_DRIVER, freightCost: 0 });
    const saved = saveUnchanged(recordToEdit);
    expect(saved.driverId).toBeUndefined();
    expect(saved.motoristaId).toBeUndefined();
    expect(saved.licensePlate).toBeUndefined();
    expect(saved.driverPlate).toBe('');
    expect(saved).toMatchObject({ freightPayable: 'NO', freightCost: 0 });
  });

  it('o resultado não depende do que o formulário mostrava antes', () => {
    const onSave = vi.fn(() => true);
    const comMotorista = sanitizedCarga({ id: 'c-com', freightCost: 450 });
    const semMotorista = sanitizedCarga({ id: 'c-sem', ...NO_DRIVER, freightCost: 0 });
    const { rerender } = render(<RecordModal {...baseProps} recordToEdit={comMotorista} onSave={onSave} />);
    rerender(<RecordModal {...baseProps} recordToEdit={semMotorista} onSave={onSave} />);
    fireEvent.submit(document.querySelector('form')!);
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({ id: 'c-sem', freightPayable: 'NO', freightCost: 0 });
  });

  it('sem motorista, o custo de frete não aparece; ao selecionar motorista, aparece com a tarifa', () => {
    render(<RecordModal {...baseProps} recordToEdit={null} onSave={vi.fn()} />);
    expect(screen.queryByText('Custo Frete (R$)')).toBeNull();
    fireEvent.change(screen.getByDisplayValue('Selecione um motorista cadastrado...'), { target: { value: 'm1' } });
    expect(screen.getByText('Custo Frete (R$)')).toBeTruthy();
    expect(screen.getByDisplayValue('600,00')).toBeTruthy();
  });

  it('o formulário não oferece mais a opção "Frete a Pagar?"', () => {
    render(<RecordModal {...baseProps} recordToEdit={sanitizedCarga({ freightCost: 777 })} onSave={vi.fn()} />);
    expect(screen.queryByText('Frete a Pagar?')).toBeNull();
  });

  it('nova carga sem motorista é salva sem frete', () => {
    expect(saveUnchanged(null)).toMatchObject({ freightPayable: 'NO', freightCost: 0 });
  });
});

describe('RecordModal — carga com motorista mantém o comportamento', () => {
  it('motorista cadastrado: editar e salvar preserva motorista, frete e valor', () => {
    const saved = saveUnchanged(sanitizedCarga({ freightCost: 777 }));
    expect(saved).toMatchObject({ driverId: 'm1', licensePlate: 'ABC-1234', freightPayable: 'YES', freightCost: 777 });
  });

  it('motorista avulso (texto livre): editar e salvar preserva o frete', () => {
    const recordToEdit = sanitizedCarga({ ...NO_DRIVER, driverPlate: 'Zé Avulso / XYZ-9999', freightCost: 500 });
    const saved = saveUnchanged(recordToEdit);
    expect(saved).toMatchObject({ driverPlate: 'Zé Avulso / XYZ-9999', freightPayable: 'YES', freightCost: 500 });
  });

  it('nova carga com motorista selecionado gera o frete padrão', () => {
    const onSave = vi.fn(() => true);
    render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} />);
    fireEvent.change(screen.getByDisplayValue('Selecione um motorista cadastrado...'), { target: { value: 'm1' } });
    fireEvent.submit(document.querySelector('form')!);
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({ driverId: 'm1', freightPayable: 'YES', freightCost: 600 });
  });

  it('retirar o motorista de uma carga que tinha frete zera o frete ao salvar', () => {
    const onSave = vi.fn(() => true);
    render(<RecordModal {...baseProps} recordToEdit={sanitizedCarga({ driverPlate: undefined, freightCost: 777 })} onSave={onSave} />);
    fireEvent.change(screen.getByDisplayValue(/Motorista Teste — Placa/), { target: { value: '' } });
    fireEvent.submit(document.querySelector('form')!);
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({ freightPayable: 'NO', freightCost: 0 });
  });

  it('motorista avulso digitado em carga nova gera frete pela tarifa', () => {
    const onSave = vi.fn(() => true);
    render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText('Ou digite Motorista / Placa avulsa...'), { target: { value: 'Zé Avulso / XYZ-9999' } });
    fireEvent.submit(document.querySelector('form')!);
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({ driverPlate: 'Zé Avulso / XYZ-9999', freightPayable: 'YES', freightCost: 600 });
  });

  it('custo de frete ajustado à mão é o valor gravado', () => {
    const onSave = vi.fn(() => true);
    render(<RecordModal {...baseProps} recordToEdit={sanitizedCarga({ freightCost: 777 })} onSave={onSave} />);
    fireEvent.change(screen.getByDisplayValue('777,00'), { target: { value: '800,00' } });
    fireEvent.submit(document.querySelector('form')!);
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({ freightPayable: 'YES', freightCost: 800 });
  });

  it('carga antiga com motorista gravada sem frete passa a gerar frete pela tarifa ao ser salva, e a tela mostra esse valor', () => {
    const onSave = vi.fn(() => true);
    const recordToEdit = sanitizedCarga({ freightPayable: 'NO', freightCost: 0 });
    render(<RecordModal {...baseProps} recordToEdit={recordToEdit} onSave={onSave} />);
    expect(screen.getByDisplayValue('600,00')).toBeTruthy();
    fireEvent.submit(document.querySelector('form')!);
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({ driverId: 'm1', freightPayable: 'YES', freightCost: 600 });
  });

  it('carga Pro Cabos com motorista continua sem frete e sem campo de custo', () => {
    const onSave = vi.fn(() => true);
    const recordToEdit = sanitizedCarga({ proCabos: true, proCabosLaborRatePerTon: 115 });
    render(<RecordModal {...baseProps} recordToEdit={recordToEdit} onSave={onSave} />);
    expect(screen.queryByText('Custo Frete (R$)')).toBeNull();
    fireEvent.submit(document.querySelector('form')!);
    expect((onSave.mock.calls[0] as any[])[0]).toMatchObject({ driverId: 'm1', proCabos: true, freightPayable: 'NO', freightCost: 0 });
  });
});

describe('RecordModal — frete já pago não some ao salvar', () => {
  const expectBlocked = (recordToEdit: unknown, act?: () => void) => {
    const onSave = vi.fn(() => true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<RecordModal {...baseProps} recordToEdit={recordToEdit} onSave={onSave} />);
    act?.();
    fireEvent.submit(document.querySelector('form')!);
    expect(onSave).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('já foi pago'));
    alertSpy.mockRestore();
  };

  it('carga antiga sem motorista com frete quitado não pode ser salva sem antes reverter o pagamento', () => {
    expectBlocked(sanitizedCarga({ ...NO_DRIVER, freightCost: 600, freightStatus: 'PAID', freightPaidAt: '2026-08-25T12:00:00Z' }));
  });

  it('retirar o motorista de carga com frete quitado é bloqueado', () => {
    expectBlocked(
      sanitizedCarga({ driverPlate: undefined, freightCost: 777, freightStatus: 'PAID', freightPaidAt: '2026-08-25T12:00:00Z' }),
      () => fireEvent.change(screen.getByDisplayValue(/Motorista Teste — Placa/), { target: { value: '' } })
    );
  });

  it('carga com motorista e frete quitado continua editável e mantém a quitação', () => {
    const saved = saveUnchanged(sanitizedCarga({ freightCost: 777, freightStatus: 'PAID', freightPaidAt: '2026-08-25T12:00:00Z' }));
    expect(saved).toMatchObject({ freightPayable: 'YES', freightCost: 777, freightStatus: 'PAID' });
  });

  it('carga sem frete que tem situação PAID residual não é bloqueada', () => {
    const saved = saveUnchanged(sanitizedCarga({ ...NO_DRIVER, freightPayable: 'NO', freightCost: 0, freightStatus: 'PAID' }));
    expect(saved).toMatchObject({ freightPayable: 'NO', freightCost: 0 });
  });
});
