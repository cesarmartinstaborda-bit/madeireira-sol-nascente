import { describe, expect, it } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';
import { toFirestoreCollectionName } from '../utils/firebaseSync';
import {
  calcMaoDeObraTotal,
  formatDecimalInput,
  parseDecimalBR,
  sanitizeMaoDeObraLancamentos,
  splitMaoDeObraLancamentos,
  sumMaoDeObra,
} from '../utils/maoDeObra';
import { sanitizeDatabase } from '../utils/storage';

const lancamento = (over: Record<string, unknown> = {}) =>
  sanitizeMaoDeObraLancamentos([{ id: 'l1', status: 'PENDING', ...over }])[0];

describe('Mão de Obra — regras', () => {
  it('calcula toneladas × preço só quando há os dois', () => {
    expect(calcMaoDeObraTotal(12, 150)).toBe(1800);
    expect(calcMaoDeObraTotal(12.345, 150)).toBe(1851.75);
    expect(calcMaoDeObraTotal(12, null)).toBeNull();
    expect(calcMaoDeObraTotal(null, 150)).toBeNull();
    expect(calcMaoDeObraTotal(0, 150)).toBe(0);
  });

  it('lê números no padrão brasileiro e recusa texto inválido ou negativo', () => {
    expect(parseDecimalBR('12')).toBe(12);
    expect(parseDecimalBR('12,5')).toBe(12.5);
    expect(parseDecimalBR('1.234,567')).toBe(1234.567);
    expect(parseDecimalBR('1.500')).toBe(1500);
    expect(parseDecimalBR('1.5')).toBe(1.5);
    expect(parseDecimalBR(formatDecimalInput(1234.5678, 6))).toBe(1234.5678);
    expect(parseDecimalBR('  ')).toBeNull();
    expect(parseDecimalBR('abc')).toBeNaN();
    expect(parseDecimalBR('-3')).toBeNaN();
  });

  it('totais somam toneladas de todos e valor só dos lançamentos com valor conhecido', () => {
    const records = [
      lancamento({ id: 'a', quantityTons: 12, totalValue: 1800 }),
      lancamento({ id: 'b', quantityTons: 3.5 }),
      lancamento({ id: 'c', totalValue: 200 }),
      lancamento({ id: 'd', quantityTons: 1, totalValue: 150, status: 'PAID', paidAt: '2026-09-01T10:00:00.000Z' }),
    ];
    const { pending, paid } = splitMaoDeObraLancamentos(records);
    expect(sumMaoDeObra(pending)).toEqual({ tons: 15.5, value: 2000, withoutValue: 1 });
    expect(sumMaoDeObra(paid)).toEqual({ tons: 1, value: 150, withoutValue: 0 });
  });

  it('normaliza lançamentos parciais: ausências viram null, nunca zero', () => {
    const only = lancamento({ quantityTons: '12', clientName: '  ', totalValue: undefined, extra: 'mantido' });
    expect(only).toMatchObject({
      id: 'l1',
      clientId: null,
      clientName: null,
      productId: null,
      productName: null,
      date: null,
      quantityTons: 12,
      pricePerTon: null,
      totalValue: null,
      totalValueManual: false,
      status: 'PENDING',
      paidAt: null,
      extra: 'mantido',
    });
    expect(lancamento({ status: 'X', paidAt: '2026-09-01T10:00:00.000Z' })).toMatchObject({ status: 'PENDING', paidAt: null });
    expect(lancamento({ date: '05/09/2026' }).date).toBe('2026-09-05');
    expect(sanitizeMaoDeObraLancamentos([null, { status: 'PAID' }, 'x'])).toEqual([]);
    expect(sanitizeMaoDeObraLancamentos(sanitizeMaoDeObraLancamentos([only]))).toEqual([only]);
  });

  it('banco antigo sem o módulo carrega listas vazias e mantém o restante intacto', () => {
    const legacy: any = regressionDatabase();
    const clean = sanitizeDatabase(legacy);
    expect(clean.MaoDeObra_Lancamentos).toEqual([]);
    expect(clean.MaoDeObra_Clientes).toEqual([]);
    expect(clean.MaoDeObra_Produtos).toEqual([]);
    expect(clean.Cargas).toHaveLength(legacy.Cargas.length);
    expect(clean.Clientes).toEqual(sanitizeDatabase(legacy).Clientes);
  });

  it('cadastros sem nome são descartados; preço ausente fica null', () => {
    const clean = sanitizeDatabase({
      ...regressionDatabase(),
      MaoDeObra_Clientes: [{ id: 'c1', name: ' Serraria ' }, { id: 'c2', name: '' }],
      MaoDeObra_Produtos: [{ id: 'p1', name: 'Descarga' }, { id: 'p2', name: 'Carga', pricePerTon: 150 }],
    });
    expect(clean.MaoDeObra_Clientes).toEqual([{ id: 'c1', name: 'Serraria', createdAt: null }]);
    expect(clean.MaoDeObra_Produtos!.map((p) => p.pricePerTon)).toEqual([null, 150]);
  });

  it('coleções do Firestore da Mão de Obra não se confundem com clientes/produtos de vendas', () => {
    expect(toFirestoreCollectionName('maoDeObraClientes')).toBe('maoDeObraClientes');
    expect(toFirestoreCollectionName('maoDeObraProdutos')).toBe('maoDeObraProdutos');
    expect(toFirestoreCollectionName('maoDeObraLancamentos')).toBe('maoDeObraLancamentos');
    expect(toFirestoreCollectionName('clientes')).toBe('clientes');
    expect(toFirestoreCollectionName('Produtos')).toBe('produtos');
  });
});
