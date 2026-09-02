import { describe, expect, it } from 'vitest';
import { dateValueToEpoch, sortByDateDescending } from '../utils/dateSorting';

const sortDates = (dates: string[]) => sortByDateDescending(dates, (date) => date);

describe('sortByDateDescending', () => {
  it('ordena datas brasileiras da mais recente para a mais antiga', () => {
    expect(sortDates(['20/08/2026', '25/08/2026', '24/08/2026', '26/08/2026', '17/08/2026', '19/08/2026']))
      .toEqual(['26/08/2026', '25/08/2026', '24/08/2026', '20/08/2026', '19/08/2026', '17/08/2026']);
  });

  it('ordena corretamente mudanças de mês e de ano', () => {
    expect(sortDates(['31/08/2026', '01/09/2026', '30/08/2026']))
      .toEqual(['01/09/2026', '31/08/2026', '30/08/2026']);
    expect(sortDates(['31/12/2025', '01/01/2026', '30/12/2025']))
      .toEqual(['01/01/2026', '31/12/2025', '30/12/2025']);
  });

  it('posiciona cadastro retroativo pela data operacional, não pela inserção', () => {
    expect(sortDates(['2026-08-26', '2026-08-25', '2026-08-24', '2026-08-18']))
      .toEqual(['2026-08-26', '2026-08-25', '2026-08-24', '2026-08-18']);
  });

  it('preserva estabilidade em datas iguais e aceita createdAt como desempate opcional', () => {
    const records = [
      { id: 'A', date: '26/08/2026', createdAt: '2026-08-27T10:00:00Z' },
      { id: 'B', date: '26/08/2026', createdAt: '2026-08-27T12:00:00Z' },
      { id: 'C', date: '25/08/2026', createdAt: '2026-08-28T12:00:00Z' },
    ];
    expect(sortByDateDescending(records, (r) => r.date).map((r) => r.id)).toEqual(['A', 'B', 'C']);
    expect(sortByDateDescending(records, (r) => r.date, (r) => r.createdAt).map((r) => r.id)).toEqual(['B', 'A', 'C']);
  });

  it('reposiciona imediatamente quando a data editada muda', () => {
    const records = [{ id: 'A', date: '2026-08-20' }, { id: 'B', date: '2026-08-25' }];
    expect(sortByDateDescending(records, (r) => r.date).map((r) => r.id)).toEqual(['B', 'A']);
    const edited = records.map((r) => r.id === 'A' ? { ...r, date: '2026-08-26' } : r);
    expect(sortByDateDescending(edited, (r) => r.date).map((r) => r.id)).toEqual(['A', 'B']);
  });

  it('converte ISO, Date, timestamps numéricos e Firestore Timestamp', () => {
    const expected = Date.UTC(2026, 7, 26);
    expect(dateValueToEpoch('2026-08-26')).toBe(expected);
    expect(dateValueToEpoch('26/08/2026')).toBe(expected);
    expect(dateValueToEpoch(new Date('2026-08-26T00:00:00Z'))).toBe(expected);
    expect(dateValueToEpoch(expected)).toBe(expected);
    expect(dateValueToEpoch({ seconds: expected / 1000, nanoseconds: 0 })).toBe(expected);
    expect(dateValueToEpoch({ toMillis: () => expected })).toBe(expected);
  });
});
