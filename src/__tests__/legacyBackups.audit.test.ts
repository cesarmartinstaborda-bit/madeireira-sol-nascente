import { readFileSync } from 'node:fs';
import { beforeEach, expect, it } from 'vitest';
import { validateAndSanitizeBackupJSON, saveDatabase, loadDatabase, sanitizeDatabase } from '../utils/storage';
beforeEach(() => localStorage.clear());
it.each(['0230', '0231'])('backup anterior %s continua válido e faz round-trip local sem migração', time => {
  const legacy = JSON.parse(readFileSync(`qa-evidence-2026-08-26/Madeireira_Backup_2026-08-26_${time}.json`, 'utf8'));
  const result = validateAndSanitizeBackupJSON(legacy);
  expect(result.isValid).toBe(true);
  const db = result.sanitizedDb!;
  saveDatabase(db, { createBackup: false });
  expect(loadDatabase()).toEqual(db);
  expect(sanitizeDatabase(db)).toEqual(db);
  for (const collection of ['Cargas', 'Depositos_Klabin', 'Vendas', 'Clientes', 'Produtos', 'Motoristas'] as const) {
    expect(db[collection]?.map(r => r.id)).toEqual(legacy[collection]?.map((r: { id: string }) => r.id));
  }
});
