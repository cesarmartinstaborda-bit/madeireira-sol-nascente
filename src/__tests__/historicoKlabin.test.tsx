import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';

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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
  localStorage.clear();
  localStorage.setItem('klabin_base_app_database_v1', JSON.stringify(regressionDatabase()));
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Drives the real Ciclos UI to lock or unlock 2026-08 (the month of the fixture's carga/depósito). */
function toggleAugustCycle(action: 'Fechar ciclo' | 'Reabrir ciclo') {
  navigate(/Configurações e Ajustes/);
  click('Ciclos');
  const [monthSelect, yearSelect] = screen.getAllByRole('combobox');
  fireEvent.change(monthSelect, { target: { value: '08' } });
  fireEvent.change(yearSelect, { target: { value: '2026' } });
  click(action);
  // Confirmation modal reuses the same label as the trigger button.
  const confirmButtons = screen.getAllByRole('button', { name: action });
  fireEvent.click(confirmButtons[confirmButtons.length - 1]);
}

describe('Histórico — separação por competência do módulo Klabin', () => {
  it('some do Klabin e aparece no Histórico ao trancar o mês, e volta ao destrancar', () => {
    render(<App />);

    // Antes de trancar: registros e contadores no Klabin, Histórico vazio.
    navigate(/^Klabin/);
    expect(screen.getByText('Registro de Cargas (1)')).toBeTruthy();
    click(/Depósitos Klabin/);
    expect(screen.getAllByText('Depósitos Klabin (1)').length).toBeGreaterThan(0);
    expect(within(document.querySelector('aside')!).getByRole('button', { name: /^Klabin/ }).textContent).toContain('2');
    expect(within(document.querySelector('aside')!).getByRole('button', { name: /^Histórico/ }).textContent).not.toMatch(/Histórico.*[1-9]/);

    navigate(/^Histórico/);
    expect(screen.getByText(/Nenhuma competência encerrada/)).toBeTruthy();

    // Tranca Agosto/2026.
    toggleAugustCycle('Fechar ciclo');

    // Klabin não mostra mais os registros de agosto, e o contador reflete só competências abertas.
    // (a subaba permanece em Depósitos, herdada da navegação anterior ao módulo.)
    navigate(/^Klabin/);
    expect(screen.getByText('Nenhum depósito cadastrado.')).toBeTruthy();
    click(/Cargas de Madeira/);
    expect(screen.getByText('Nenhuma carga encontrada.')).toBeTruthy();
    expect(within(document.querySelector('aside')!).getByRole('button', { name: /^Klabin/ }).textContent).not.toMatch(/[1-9]/);

    // Histórico agora lista a competência fechada com os totais corretos.
    navigate(/^Histórico/);
    expect(within(document.querySelector('aside')!).getByRole('button', { name: /^Histórico/ }).textContent).toContain('2');
    const card = screen.getByText('Agosto de 2026').closest('button')!;
    expect(within(card).getByText('R$ 800,00')).toBeTruthy(); // saldo da competência: 1000 depósito - 200 abatido
    fireEvent.click(card);
    expect(screen.getByText('Registro de Cargas (1)')).toBeTruthy();
    expect(screen.getAllByText('Depósitos Klabin (1)').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Adicionar Carga' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Novo Depósito' })).toBeNull();

    // PDF da competência usa apenas os registros de agosto e leva o rótulo do mês.
    click('Gerar PDF da Competência');
    expect(generateKlabinStatementPdf).toHaveBeenCalledTimes(1);
    const pdfArgs = generateKlabinStatementPdf.mock.calls[0][0];
    expect(pdfArgs.cargas).toHaveLength(1);
    expect(pdfArgs.depositos).toHaveLength(1);
    expect(pdfArgs.periodKey).toBe('2026-08');
    expect(pdfArgs.periodLabel).toBe('Agosto de 2026');

    // Destranca o mês: os registros voltam automaticamente para o Klabin.
    toggleAugustCycle('Reabrir ciclo');
    navigate(/^Klabin/);
    expect(screen.getByText('Registro de Cargas (1)')).toBeTruthy();
    expect(within(document.querySelector('aside')!).getByRole('button', { name: /^Klabin/ }).textContent).toContain('2');
    navigate(/^Histórico/);
    expect(screen.getByText(/Nenhuma competência encerrada/)).toBeTruthy();
  }, 15000);

  it('o PDF do próprio módulo Klabin usa somente os registros de competências abertas', () => {
    render(<App />);
    toggleAugustCycle('Fechar ciclo');

    navigate(/^Klabin/);
    click('Gerar Extrato PDF');
    expect(generateKlabinStatementPdf).toHaveBeenCalledTimes(1);
    const pdfArgs = generateKlabinStatementPdf.mock.calls[0][0];
    expect(pdfArgs.cargas).toHaveLength(0);
    expect(pdfArgs.depositos).toHaveLength(0);
  });
});
