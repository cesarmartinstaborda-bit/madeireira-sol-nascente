import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordModal } from '../components/RecordModal';

const baseProps = {
  isOpen: true,
  tableType: 'Depositos_Klabin' as const,
  onClose: vi.fn(),
  produtos: [],
  clientes: [],
  motoristas: [],
  freightRatePerTon: 15,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RecordModal - depósito em BRL', () => {
  it('cria R$ 86.900,40 armazenando o número 86900.40', () => {
    const onSave = vi.fn(() => true);
    render(<RecordModal {...baseProps} recordToEdit={null} onSave={onSave} />);

    const input = screen.getByLabelText('Valor do Depósito (R$) *') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('decimal');
    fireEvent.change(input, { target: { value: '86.900,40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Depósito' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ value: 86900.4 }));
  });

  it('reabre formatado e edita para 87150.75', () => {
    const onSave = vi.fn(() => true);
    render(
      <RecordModal
        {...baseProps}
        recordToEdit={{ id: 'dep-1', date: '2026-08-27', value: 86900.4, notes: '' }}
        onSave={onSave}
      />
    );

    const input = screen.getByLabelText('Valor do Depósito (R$) *') as HTMLInputElement;
    expect(input.value).toBe('86.900,40');
    fireEvent.change(input, { target: { value: '87.150,75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Depósito' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'dep-1', value: 87150.75 }));
  });
});
