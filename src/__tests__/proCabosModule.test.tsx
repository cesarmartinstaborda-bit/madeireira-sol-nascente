import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';

const firebase = vi.hoisted(() => ({ upsert: vi.fn(), remove: vi.fn() }));
vi.mock('../utils/firebaseSync', () => ({
  subscribeToFirestore: () => () => {},
  checkAndSeedFirestoreIfEmpty: vi.fn().mockResolvedValue(false),
  flushPendingFirestoreUpserts: vi.fn().mockResolvedValue(undefined),
  upsertFirestoreRecord: firebase.upsert,
  deleteFirestoreRecord: firebase.remove,
  syncFirestoreSettings: vi.fn(),
  restoreFirestoreAuthoritatively: vi.fn().mockResolvedValue({ success: true }),
  isFirebaseConfigured: () => true,
  getFirebaseSyncState: () => ({ isConfigured: false, status: 'NOT_CONFIGURED', lastSuccessfulSyncAt: null }),
  testFirebaseConnection: vi.fn().mockResolvedValue({ success: false, message: 'Sem conexão de teste' }),
}));
vi.mock('../utils/googleAuth', () => ({
  getCurrentGoogleUser: () => null,
  onFirebaseUser: (cb: any) => { cb({ uid: 'test-user', email: 'cesarmartinstaborda@gmail.com' }); return () => {}; },
  initAuth: () => () => {},
  googleSignIn: vi.fn(),
  googleSignOut: vi.fn(),
  getAccessToken: async () => null,
}));
vi.mock('@/assets/icon.png', () => ({ default: '/test-icon.png' }));
vi.mock('../utils/pdfGenerator', () => ({ generateKlabinStatementPdf: vi.fn(() => true) }));

import App from '../App';
import { RecordModal } from '../components/RecordModal';
import { calcProCabosOutstanding, splitProCabosCargas } from '../utils/proCabos';
import { sanitizeDatabase } from '../utils/storage';

const DB_KEY = 'klabin_base_app_database_v1';
const aside = () => within(document.querySelector('aside')!);
const navigate = (name: RegExp) => fireEvent.click(aside().getByRole('button', { name }));
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));
const saldoDevedor = () => screen.getByText('Saldo Devedor Pro Cabos').parentElement!.textContent!;
const storedCarga = (id: string) => JSON.parse(localStorage.getItem(DB_KEY)!).Cargas.find((c: any) => c.id === id);

const base = () => regressionDatabase().Cargas[0];
// pc1: 40 t × (200 + 115) = 12.600,00 · pc2: 10 t × (100 + 100) = 2.000,00 (tarifa antiga gravada)
const seedDatabase = (lockedMonths: string[] = []) => {
  const db: any = regressionDatabase();
  db.Cargas = [
    base(),
    { ...base(), id: 'pc1', date: '2026-08-25', quantityTons: 40, valuePerTon: 200, totalValue: 8000, proCabos: true, proCabosLaborRatePerTon: 115 },
    { ...base(), id: 'pc2', date: '2026-08-10', quantityTons: 10, valuePerTon: 100, totalValue: 1000, proCabos: true, proCabosLaborRatePerTon: 100 },
  ];
  db.appSettings.cycles.lockedMonths = lockedMonths;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Pro Cabos — situação financeira (regra)', () => {
  it('carga Pro Cabos sem situação gravada é em aberto; a situação só existe em carga Pro Cabos', () => {
    seedDatabase();
    const cargas = sanitizeDatabase(JSON.parse(localStorage.getItem(DB_KEY)!)).Cargas;
    expect(cargas.find((c) => c.id === 'pc1')!.proCabosStatus).toBe('PENDING');
    expect(cargas.find((c) => c.id === 'c1')).not.toHaveProperty('proCabosStatus');
    expect(splitProCabosCargas(cargas).open.map((c) => c.id)).toEqual(['pc1', 'pc2']);
    expect(calcProCabosOutstanding(cargas)).toBe(14600);
  });

  it('carga quitada sai do saldo devedor', () => {
    seedDatabase();
    const cargas = sanitizeDatabase(JSON.parse(localStorage.getItem(DB_KEY)!)).Cargas
      .map((c) => (c.id === 'pc1' ? { ...c, proCabosStatus: 'PAID' as const } : c));
    expect(splitProCabosCargas(cargas).paid.map((c) => c.id)).toEqual(['pc1']);
    expect(calcProCabosOutstanding(cargas)).toBe(2000);
  });

  it('marcar → pagar → desmarcar → remarcar: a situação antiga não sobrevive e a nova marcação começa em aberto', () => {
    seedDatabase();
    const raw: any = JSON.parse(localStorage.getItem(DB_KEY)!);
    const pago = { ...raw.Cargas.find((c: any) => c.id === 'pc1'), proCabosStatus: 'PAID' };
    // Desmarcada: como o Firestore grava com merge, o documento remoto ainda traz o 'PAID' antigo.
    const desmarcada = sanitizeDatabase({ ...raw, Cargas: [{ ...pago, proCabos: false }] }).Cargas[0];
    expect(desmarcada.proCabos).toBe(false);
    expect(desmarcada).not.toHaveProperty('proCabosStatus');
    expect(calcProCabosOutstanding([desmarcada])).toBe(0);

    const onSave = vi.fn(() => true);
    render(<RecordModal isOpen tableType="Cargas" onClose={vi.fn()} produtos={[]} clientes={[]} motoristas={[]} freightRatePerTon={15} recordToEdit={desmarcada} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText(/Carga da Pro Cabos/));
    fireEvent.submit(document.querySelector('form')!);
    const remarcada = (onSave.mock.calls[0] as any[])[0];
    expect(remarcada).toMatchObject({ proCabos: true, proCabosStatus: 'PENDING' });
    expect(calcProCabosOutstanding(sanitizeDatabase({ ...raw, Cargas: [remarcada] }).Cargas)).toBe(12600);
  });

  it('editar uma carga quitada pelo cadastro da Klabin mantém a quitação; marcação nova começa em aberto', () => {
    seedDatabase();
    const sanitized = sanitizeDatabase(JSON.parse(localStorage.getItem(DB_KEY)!)).Cargas;
    const props = { isOpen: true, tableType: 'Cargas' as const, onClose: vi.fn(), produtos: [], clientes: [], motoristas: [], freightRatePerTon: 15 };

    const onSavePaid = vi.fn(() => true);
    render(<RecordModal {...props} recordToEdit={{ ...sanitized.find((c) => c.id === 'pc1')!, proCabosStatus: 'PAID' }} onSave={onSavePaid} />);
    fireEvent.submit(document.querySelector('form')!);
    expect((onSavePaid.mock.calls[0] as any[])[0]).toMatchObject({ id: 'pc1', proCabos: true, proCabosStatus: 'PAID' });
    cleanup();

    const onSaveNew = vi.fn(() => true);
    render(<RecordModal {...props} recordToEdit={{ ...sanitized.find((c) => c.id === 'c1')!, proCabosStatus: 'PAID' }} onSave={onSaveNew} />);
    fireEvent.click(screen.getByLabelText(/Carga da Pro Cabos/));
    fireEvent.submit(document.querySelector('form')!);
    expect((onSaveNew.mock.calls[0] as any[])[0]).toMatchObject({ id: 'c1', proCabos: true, proCabosStatus: 'PENDING' });
  });
});

describe('Módulo Pro Cabos', () => {
  it('fica na Sidebar logo abaixo de Klabin e acima de Clientes & Produtos, com as cargas em aberto no contador', () => {
    seedDatabase();
    render(<App />);
    const labels = aside().getAllByRole('button').map((b) => b.textContent || '');
    const klabin = labels.findIndex((t) => t.startsWith('Klabin'));
    expect(labels[klabin + 1]).toMatch(/^Pro Cabos/);
    expect(labels[klabin + 2]).toMatch(/^Clientes & Produtos/);
    expect(labels[klabin + 1]).toMatch(/2$/);
  });

  it('mostra só cargas Pro Cabos, em ordem de data decrescente, sem criar nem exportar', () => {
    seedDatabase();
    render(<App />);
    navigate(/^Pro Cabos/);
    expect(screen.getByText('Módulo Pro Cabos', { selector: 'h1, h2' })).toBeTruthy();
    expect(saldoDevedor()).toContain('14.600,00');
    expect(screen.getByText('Cargas em Aberto (2)')).toBeTruthy();
    const rows = screen.getAllByRole('row').slice(1).map((r) => r.textContent || '');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('25/08/2026');
    expect(rows[0]).toContain('12.600,00');
    expect(rows[1]).toContain('10/08/2026');
    expect(rows[1]).toContain('2.000,00');
    expect(screen.queryByRole('button', { name: /Adicionar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /CSV/i })).toBeNull();
    expect(screen.queryByTitle('Editar registro')).toBeNull();
    expect(screen.queryByTitle('Excluir registro')).toBeNull();
  });

  it('"Pago" tira a carga de Em aberto e do saldo, persiste e sincroniza; "Reverter" desfaz', () => {
    seedDatabase();
    const { unmount } = render(<App />);
    navigate(/^Pro Cabos/);

    fireEvent.click(screen.getAllByRole('button', { name: 'Pago' })[0]);
    expect(saldoDevedor()).toContain('2.000,00');
    expect(screen.getByText('Cargas em Aberto (1)')).toBeTruthy();
    expect(aside().getByRole('button', { name: /^Pro Cabos/ }).textContent).toMatch(/1$/);
    expect(firebase.upsert).toHaveBeenLastCalledWith('cargas', expect.objectContaining({ id: 'pc1', proCabosStatus: 'PAID' }));
    expect(storedCarga('pc1').proCabosStatus).toBe('PAID');

    click(/^Quitados/);
    expect(screen.getByText('Cargas Quitadas (1)')).toBeTruthy();
    expect(screen.getAllByRole('row')[1].textContent).toContain('12.600,00');

    // Reinício do aplicativo: o estado vem do armazenamento local.
    unmount();
    render(<App />);
    navigate(/^Pro Cabos/);
    expect(saldoDevedor()).toContain('2.000,00');
    click(/^Quitados/);
    expect(screen.getByText('Cargas Quitadas (1)')).toBeTruthy();

    click('Reverter');
    expect(saldoDevedor()).toContain('14.600,00');
    expect(screen.getByText('Nenhuma carga quitada.')).toBeTruthy();
    expect(firebase.upsert).toHaveBeenLastCalledWith('cargas', expect.objectContaining({ id: 'pc1', proCabosStatus: 'PENDING' }));
    expect(storedCarga('pc1').proCabosStatus).toBe('PENDING');
    click(/^Em aberto/);
    expect(screen.getByText('Cargas em Aberto (2)')).toBeTruthy();
  });

  it('quitar na Pro Cabos não altera o saldo, o frete nem os valores da carga na Klabin', () => {
    seedDatabase();
    render(<App />);
    const before = JSON.parse(localStorage.getItem(DB_KEY)!).Cargas.find((c: any) => c.id === 'pc1');
    const headerBefore = document.querySelector('header')!.textContent;
    navigate(/^Pro Cabos/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Pago' })[0]);
    const { proCabosStatus, ...after } = storedCarga('pc1');
    const { proCabosStatus: _ignored, ...beforeRest } = before;
    expect(proCabosStatus).toBe('PAID');
    expect(after).toEqual(beforeRest);
    navigate(/^Klabin/);
    expect(screen.getByText('Registro de Cargas (3)')).toBeTruthy();
    navigate(/^Pro Cabos/);
    expect(document.querySelector('header')!.textContent!.replace('Módulo Pro Cabos', '')).toContain(
      headerBefore!.match(/Saldo Livre Klabin[^A-Za-z]*/)![0]
    );
  });

  it('excluir a carga na Klabin a remove da Pro Cabos e do saldo devedor', () => {
    seedDatabase();
    render(<App />);
    navigate(/^Klabin/);
    const row = screen.getAllByRole('row').find((r) => (r.textContent || '').includes('25/08/2026'))!;
    fireEvent.click(within(row).getByTitle('Excluir registro'));
    click('Confirmar Exclusão');
    navigate(/^Pro Cabos/);
    expect(saldoDevedor()).toContain('2.000,00');
    expect(screen.getByText('Cargas em Aberto (1)')).toBeTruthy();
  });

  it('desmarcar a carga na Klabin a tira da Pro Cabos', () => {
    seedDatabase();
    render(<App />);
    navigate(/^Klabin/);
    const row = screen.getAllByRole('row').find((r) => (r.textContent || '').includes('10/08/2026'))!;
    fireEvent.click(within(row).getByTitle('Editar registro'));
    fireEvent.click(screen.getByLabelText(/Carga da Pro Cabos/));
    click(/Salvar Carga/);
    navigate(/^Pro Cabos/);
    expect(saldoDevedor()).toContain('12.600,00');
    expect(screen.getByText('Cargas em Aberto (1)')).toBeTruthy();
  });

  it('carga de mês trancado compõe o saldo devedor e pode ser quitada e revertida, alterando só a situação', () => {
    seedDatabase(['2026-08']);
    const { unmount } = render(<App />);
    const before = storedCarga('pc1');
    navigate(/^Pro Cabos/);
    expect(saldoDevedor()).toContain('14.600,00');
    expect(screen.getByText('Cargas em Aberto (2)')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Pago' }) as HTMLButtonElement[];
    expect(buttons.every((b) => !b.disabled)).toBe(true);

    fireEvent.click(buttons[0]);
    expect(saldoDevedor()).toContain('2.000,00');
    expect(firebase.upsert).toHaveBeenLastCalledWith('cargas', expect.objectContaining({ id: 'pc1', proCabosStatus: 'PAID' }));
    const { proCabosStatus, ...after } = storedCarga('pc1');
    const { proCabosStatus: _ignored, ...beforeRest } = before;
    expect(proCabosStatus).toBe('PAID');
    expect(after).toEqual(beforeRest);

    unmount();
    render(<App />);
    navigate(/^Pro Cabos/);
    click(/^Quitados/);
    click('Reverter');
    expect(saldoDevedor()).toContain('14.600,00');
    expect(storedCarga('pc1').proCabosStatus).toBe('PENDING');
  });

  it('mês trancado continua protegendo os dados da carga: Klabin não a lista e o Histórico não deixa editar nem excluir', () => {
    seedDatabase(['2026-08']);
    render(<App />);
    navigate(/^Klabin/);
    expect(screen.getByText('Registro de Cargas (0)')).toBeTruthy();
    navigate(/^Histórico/);
    fireEvent.click(screen.getAllByRole('button').find((b) => /08\/2026|agosto/i.test(b.textContent || ''))!);
    const edits = screen.getAllByTitle('Editar registro') as HTMLButtonElement[];
    const deletes = screen.getAllByTitle('Excluir registro') as HTMLButtonElement[];
    expect(edits.length).toBeGreaterThan(0);
    expect([...edits, ...deletes].every((b) => b.disabled)).toBe(true);
  });
});
