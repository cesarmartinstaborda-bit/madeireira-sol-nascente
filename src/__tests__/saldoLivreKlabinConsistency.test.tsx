import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KlabinDatabase } from '../types';
import { formatBRL } from '../utils/formatters';

vi.mock('../utils/firebaseSync', () => ({
  subscribeToFirestore: () => () => {},
  checkAndSeedFirestoreIfEmpty: vi.fn().mockResolvedValue(false),
  flushPendingFirestoreUpserts: vi.fn().mockResolvedValue(undefined),
  upsertFirestoreRecord: vi.fn(),
  deleteFirestoreRecord: vi.fn(),
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

const generateKlabinStatementPdf = vi.fn((..._args: any[]) => true);
vi.mock('../utils/pdfGenerator', () => ({
  generateKlabinStatementPdf: (...args: any[]) => generateKlabinStatementPdf(...args),
}));

import App from '../App';

const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));
const navigate = (name: RegExp) => fireEvent.click(within(document.querySelector('aside')!).getByRole('button', { name }));

/**
 * Duas competências: Julho/2026 aberta, Agosto/2026 trancada desde o início.
 * Saldo correto (só competência aberta): 500 - 150 = R$ 350,00.
 * Saldo do bug antigo (banco inteiro): (500+1000) - (150+200) = R$ 1.150,00.
 */
function twoCompetencyDatabase(lockedMonths: string[]): KlabinDatabase {
  return {
    Cargas: [
      { id: 'c-jul', date: '2026-07-10', product: 'Pinus Teste', productId: 'p1', quantityTons: 1, valuePerTon: 150, totalValue: 150, deductFromBalance: true, driverId: 'm1', driverPlate: 'Motorista Teste - ABC-1234', freightPayable: 'NO', freightCost: 0, freightStatus: 'PENDING' },
      { id: 'c-ago', date: '2026-08-20', product: 'Pinus Teste', productId: 'p1', quantityTons: 1, valuePerTon: 200, totalValue: 200, deductFromBalance: true, driverId: 'm1', driverPlate: 'Motorista Teste - ABC-1234', freightPayable: 'NO', freightCost: 0, freightStatus: 'PENDING' },
    ],
    Depositos_Klabin: [
      { id: 'd-jul', date: '2026-07-11', value: 500, notes: '' },
      { id: 'd-ago', date: '2026-08-21', value: 1000, notes: '' },
    ],
    Frete: [],
    Clientes: [],
    Produtos: [{ id: 'p1', name: 'Pinus Teste', unitOfMeasure: 'ton', referencePrice: 100, status: 'ACTIVE', createdAt: '2026-07-01T12:00:00Z' }],
    Motoristas: [{ id: 'm1', name: 'Motorista Teste', licensePlate: 'ABC-1234', status: 'ACTIVE', createdAt: '2026-07-01T12:00:00Z' }],
    Vendas: [],
    appSettings: { freightRatePerTon: 15, company: { name: 'Madeireira Sol Nascente', city: 'Curitiba', state: 'PR' }, cycles: { lockedMonths } },
  } as unknown as KlabinDatabase;
}

// getByText normaliza o texto do DOM (NBSP -> espaço normal) mas compara com a
// string do matcher tal como ela é — por isso removemos o NBSP que formatBRL usa
// entre "R$" e o número, senão a comparação falha mesmo com o valor certo na tela.
const noBreakSpace = (s: string) => s.replace(/ /g, ' ');
const OPEN_ONLY = noBreakSpace(formatBRL(350));
const WHOLE_DATABASE_BUG_VALUE = noBreakSpace(formatBRL(1150));
const ALL_OPEN = noBreakSpace(formatBRL(1150)); // mesmo número de WHOLE_DATABASE_BUG_VALUE, mas correto quando nada está trancado

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

describe('Saldo Livre Klabin — mesma fonte em todos os consumidores', () => {
  it('Header, card do Klabin e Configurações mostram o mesmo valor, ignorando a competência trancada', () => {
    localStorage.setItem('klabin_base_app_database_v1', JSON.stringify(twoCompetencyDatabase(['2026-08'])));
    render(<App />);

    // O valor do bug (banco inteiro) não deve aparecer em lugar nenhum da UI.
    expect(screen.queryAllByText(WHOLE_DATABASE_BUG_VALUE)).toHaveLength(0);

    // Cabeçalho (sempre montado).
    const header = document.querySelector('header')!;
    expect(within(header).getByText(OPEN_ONLY)).toBeTruthy();

    // Card do módulo Klabin.
    navigate(/^Klabin/);
    expect(screen.getAllByText(OPEN_ONLY).length).toBeGreaterThanOrEqual(2); // header + card

    // PDF de extrato do módulo: só a competência aberta (julho) deve ser passada.
    click('Gerar Extrato PDF');
    expect(generateKlabinStatementPdf).toHaveBeenCalledTimes(1);
    const pdfArgs = generateKlabinStatementPdf.mock.calls[0][0];
    expect(pdfArgs.cargas.map((c: any) => c.id)).toEqual(['c-jul']);
    expect(pdfArgs.depositos.map((d: any) => d.id)).toEqual(['d-jul']);

    // Configurações > aba Klabin.
    navigate(/Configurações e Ajustes/);
    click('Klabin');
    expect(screen.getAllByText(OPEN_ONLY).length).toBeGreaterThanOrEqual(2); // header + painel de config
    expect(screen.queryAllByText(WHOLE_DATABASE_BUG_VALUE)).toHaveLength(0);
  });

  it('destrancar a competência de agosto atualiza o saldo em todos os lugares ao mesmo tempo', () => {
    localStorage.setItem('klabin_base_app_database_v1', JSON.stringify(twoCompetencyDatabase(['2026-08'])));
    render(<App />);

    const header = document.querySelector('header')!;
    expect(within(header).getByText(OPEN_ONLY)).toBeTruthy();

    // Reabre agosto via Configurações > Ciclos (mesmo fluxo real do usuário).
    navigate(/Configurações e Ajustes/);
    click('Ciclos');
    const [monthSelect, yearSelect] = screen.getAllByRole('combobox');
    fireEvent.change(monthSelect, { target: { value: '08' } });
    fireEvent.change(yearSelect, { target: { value: '2026' } });
    click('Reabrir ciclo');
    const confirmButtons = screen.getAllByRole('button', { name: 'Reabrir ciclo' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    // Com tudo aberto, o saldo correto passa a ser a soma das duas competências.
    expect(within(header).getByText(ALL_OPEN)).toBeTruthy();

    navigate(/^Klabin/);
    expect(screen.getAllByText(ALL_OPEN).length).toBeGreaterThanOrEqual(2); // header + card
  }, 15000);
});
