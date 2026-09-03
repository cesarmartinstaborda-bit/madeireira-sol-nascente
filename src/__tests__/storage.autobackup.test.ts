import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal localStorage shim so this suite does not depend on the test env
// providing one. Installed before importing storage.ts (which touches it at
// call time, not import time, but keep it deterministic).
class MemoryStorage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
}
if (typeof (globalThis as any).localStorage === 'undefined') {
  vi.stubGlobal('localStorage', new MemoryStorage());
}

const { createAutoBackup, getAutoBackups } = await import('../utils/storage');
const { initialKlabinData } = await import('../data/initialData');

const clone = (o: unknown) => JSON.parse(JSON.stringify(o));
const withDriver = (id: string) => {
  const db = clone(initialKlabinData);
  db.Motoristas = [...(db.Motoristas || []), { id, name: `T-${id}`, licensePlate: 'AAA0A00', status: 'ACTIVE' }];
  return db;
};

beforeEach(() => localStorage.clear());

describe('createAutoBackup — throttle', () => {
  it('grava a 1ª vez e ignora a 2ª chamada (sem force) dentro do intervalo', () => {
    createAutoBackup(clone(initialKlabinData), { force: true });
    const count = getAutoBackups().length;
    expect(count).toBeGreaterThan(0);

    createAutoBackup(withDriver('ignored'), {}); // conteúdo diferente, mas dentro do intervalo
    expect(getAutoBackups().length).toBe(count);
    expect(getAutoBackups()[0].data.Motoristas.some((m: any) => m.id === 'ignored')).toBe(false);
  });

  it('com force: true grava mesmo dentro do intervalo', () => {
    createAutoBackup(clone(initialKlabinData), { force: true });
    createAutoBackup(withDriver('kept'), { force: true });
    expect(getAutoBackups()[0].data.Motoristas.some((m: any) => m.id === 'kept')).toBe(true);
  });
});
