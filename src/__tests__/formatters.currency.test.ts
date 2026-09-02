import { describe, expect, it } from 'vitest';
import { formatBRLCurrencyInput, formatCurrency, parseBRLCurrency } from '../utils/formatters';
import { calcKlabinBalance } from '../utils/klabinBalance';

describe('parseBRLCurrency', () => {
  it.each([
    ['86.900,40', 86900.4],
    ['86900,40', 86900.4],
    ['1.000,00', 1000],
    ['1000,00', 1000],
    ['300,00', 300],
    ['15,00', 15],
    ['0,50', 0.5],
    ['86,90', 86.9],
    ['1', 1],
    ['1000', 1000],
    ['1.000', 1000],
  ])('converte %s para %s', (input, expected) => {
    expect(parseBRLCurrency(input)).toBe(expected);
  });

  it('preserva valores numéricos vindos da persistência', () => {
    expect(parseBRLCurrency(86900.4)).toBe(86900.4);
  });

  it('rejeita separadores ambíguos ou inválidos', () => {
    expect(parseBRLCurrency('8.6.900,40')).toBeNaN();
    expect(parseBRLCurrency('86,900,40')).toBeNaN();
  });
});

describe('exibição e totais BRL', () => {
  it('formata o valor salvo para campo de edição e apresentação', () => {
    expect(formatBRLCurrencyInput(86900.4)).toBe('86.900,40');
    expect(formatCurrency(86900.4)).toBe('R$ 86.900,40');
  });

  it('usa exatamente o valor numérico do depósito no total e no saldo', () => {
    const result = calcKlabinBalance({
      cargas: [],
      depositos: [{ id: 'dep-1', date: '2026-08-27', value: parseBRLCurrency('86.900,40') }] as any,
    });
    expect(result.totalDepositos).toBe(86900.4);
    expect(result.saldo).toBe(86900.4);
    expect(formatCurrency(result.totalDepositos)).toBe('R$ 86.900,40');
  });
});
