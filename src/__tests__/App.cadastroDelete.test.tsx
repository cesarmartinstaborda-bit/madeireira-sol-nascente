import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';

const cloud = vi.hoisted(() => ({ upsert: vi.fn(), remove: vi.fn() }));
vi.mock('../utils/firebaseSync', () => ({
  subscribeToFirestore: () => () => {},
  checkAndSeedFirestoreIfEmpty: vi.fn().mockResolvedValue(false),
  flushPendingFirestoreUpserts: vi.fn().mockResolvedValue(undefined),
  upsertFirestoreRecord: cloud.upsert, deleteFirestoreRecord: cloud.remove,
  syncFirestoreSettings: vi.fn(), restoreFirestoreAuthoritatively: vi.fn().mockResolvedValue({ success: true }),
  isFirebaseConfigured: () => true,
  getFirebaseSyncState: () => ({ isConfigured: false, status: 'NOT_CONFIGURED', lastSuccessfulSyncAt: null }),
  testFirebaseConnection: vi.fn().mockResolvedValue({ success: false, message: 'Sem conexão de teste' }),
}));
vi.mock('../utils/googleAuth', () => ({ getCurrentGoogleUser: () => null, onFirebaseUser: (cb: any) => { cb({ uid: 'test-user', email: 'cesarmartinstaborda@gmail.com' }); return () => {}; }, initAuth: () => () => {}, googleSignIn: vi.fn(), googleSignOut: vi.fn(), getAccessToken: async () => null }));
vi.mock('@/assets/icon.png', () => ({ default: '/test-icon.png' }));
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
afterEach(() => { cleanup(); vi.useRealTimers(); });

const casos = [
  {
    nome: 'cliente',
    abrir: () => { navigate(/Clientes & Produtos/); click(/Cadastro de Clientes/); },
    botao: 'Excluir cliente',
    titulo: 'Excluir Cliente',
    item: 'Cliente Teste',
  },
  {
    nome: 'produto',
    abrir: () => { navigate(/Clientes & Produtos/); click(/Catálogo de Produtos/); },
    botao: 'Excluir produto',
    titulo: 'Excluir Produto',
    item: 'Pinus Teste',
  },
  {
    nome: 'motorista',
    abrir: () => { navigate(/Gestão de Motoristas/); click(/Cadastro de Motoristas/); },
    botao: 'Excluir motorista',
    titulo: 'Excluir Motorista',
    item: 'Motorista Teste',
  },
];

describe('App — confirmação antes de excluir cliente, produto ou motorista', () => {
  for (const caso of casos) {
    it(`${caso.nome}: cancelar não altera nada`, () => {
      render(<App />);
      caso.abrir();
      cloud.upsert.mockClear();

      fireEvent.click(screen.getAllByTitle(caso.botao)[0]);
      expect(screen.getByText(caso.titulo)).toBeTruthy();
      expect(screen.getByText(new RegExp(`"${caso.item}"`))).toBeTruthy();
      // Nada foi executado só por abrir a confirmação.
      expect(cloud.remove).not.toHaveBeenCalled();
      expect(cloud.upsert).not.toHaveBeenCalled();

      click('Cancelar');
      expect(screen.queryByText(caso.titulo)).toBeNull();
      expect(cloud.remove).not.toHaveBeenCalled();
      expect(cloud.upsert).not.toHaveBeenCalled();
      expect(screen.getAllByTitle(caso.botao).length).toBeGreaterThan(0);
    });

    it(`${caso.nome}: confirmar executa a exclusão atual`, () => {
      render(<App />);
      caso.abrir();
      cloud.upsert.mockClear();

      fireEvent.click(screen.getAllByTitle(caso.botao)[0]);
      click('Confirmar Exclusão');

      expect(screen.queryByText(caso.titulo)).toBeNull();
      // A regra existente decide entre apagar (remove) e inativar por ter histórico (upsert).
      expect(cloud.remove.mock.calls.length + cloud.upsert.mock.calls.length).toBe(1);
    });
  }
});
