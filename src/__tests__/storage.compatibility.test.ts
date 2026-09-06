import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';
import { sanitizeDatabase, validateAndSanitizeBackupJSON, loadDatabase, saveDatabase, generateCSVString, createAutoBackup, getAutoBackups } from '../utils/storage';
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-06T12:00:00Z')); localStorage.clear(); });
afterEach(() => vi.useRealTimers());
it('mantém normalização, campos legados, relações por nome e registros inválidos', () => {
  const raw: any = regressionDatabase();
  raw.Cargas[0] = { ...raw.Cargas[0], date: '20/08/2026', productId: '', driverId: '', freightCost: undefined, freightPayable: 'SIM', deductFromBalance: 'NO', totalValue: 0, extraLegacy: 'preservado' };
  raw.Cargas.push(null, { product: '', quantityTons: 1 });
  raw.Vendas[0] = { ...raw.Vendas[0], clientId: '', productId: '', status: 'CANCELLED' };
  raw.appSettings.companyName = 'Nome legado';
  expect(sanitizeDatabase(raw)).toMatchSnapshot();
  expect(validateAndSanitizeBackupJSON({ Cargas: raw.Cargas })).toMatchSnapshot();
  expect(validateAndSanitizeBackupJSON([]).isValid).toBe(false);
});
it('preserva ida e volta do banco e backups sem duplicação, com limite de cinco', () => {
  const db = regressionDatabase(); saveDatabase(db);
  expect(loadDatabase()).toEqual(sanitizeDatabase(db));
  for (let i = 0; i < 7; i++) {
    vi.setSystemTime(new Date(`2026-09-06T12:0${i}:00Z`));
    db.Depositos_Klabin[0].value = 1000 + i;
    createAutoBackup(db, { force: true });
  }
  expect(getAutoBackups()).toHaveLength(5);
  createAutoBackup(db, { force: true });
  expect(getAutoBackups()).toHaveLength(5);
  expect(getAutoBackups()[0].data.Depositos_Klabin[0].value).toBe(1006);
});
it('preserva CSV com BOM, aspas, quebras e campos vazios', () => {
  expect(generateCSVString([{ name: 'A,"B"\nC', value: null }], [{ key: 'name', label: 'Nome' }, { key: 'value', label: 'Valor' }])).toBe('\uFEFF"Nome","Valor"\n"A,""B""\nC",""');
  expect(generateCSVString([], [])).toBe('');
});
