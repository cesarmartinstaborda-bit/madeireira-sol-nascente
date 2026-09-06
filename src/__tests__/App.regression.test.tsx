import { createHash } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';

const cloud = vi.hoisted(() => ({ listener: null as null | ((key: string, data: any) => void), unsubscribe: vi.fn(), upsert: vi.fn(), settings: vi.fn(), restore: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock('../utils/firebaseSync', () => ({
  subscribeToFirestore: (listener: typeof cloud.listener) => { cloud.listener = listener; return cloud.unsubscribe; },
  checkAndSeedFirestoreIfEmpty: vi.fn().mockResolvedValue(false),
  upsertFirestoreRecord: cloud.upsert, deleteFirestoreRecord: vi.fn(),
  syncFirestoreSettings: cloud.settings, restoreFirestoreAuthoritatively: cloud.restore,
  isFirebaseConfigured: () => true,
  getFirebaseSyncState: () => ({ isConfigured: false, status: 'NOT_CONFIGURED', lastSuccessfulSyncAt: null }),
  testFirebaseConnection: vi.fn().mockResolvedValue({ success: false, message: 'Sem conexão de teste' }),
}));
// Header continua deslogado (getCurrentGoogleUser → null); onFirebaseUser emite
// um usuário só para o useKlabinDatabase liberar a assinatura do Firestore.
vi.mock('../utils/googleAuth', () => ({ getCurrentGoogleUser: () => null, onFirebaseUser: (cb: any) => { cb({ uid: 'test-user', email: 'cesarmartinstaborda@gmail.com' }); return () => {}; }, initAuth: () => () => {}, googleSignIn: vi.fn(), googleSignOut: vi.fn(), getAccessToken: async () => null }));
vi.mock('@/assets/icon.png', () => ({ default: '/test-icon.png' }));
import App from '../App';
import * as storage from '../utils/storage';

const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));
const navigate = (name: RegExp) => fireEvent.click(within(document.querySelector('aside')!).getByRole('button', { name }));
function fingerprint(name: string) {
  // DOM/styles and form values characterize the pre-refactor UI without huge HTML snapshots.
  expect({
    html: createHash('sha256').update(document.body.innerHTML).digest('hex'),
    text: document.body.textContent,
    fields: [...document.querySelectorAll('input,select,textarea')].map((el) => ({ value: (el as HTMLInputElement).value, checked: (el as HTMLInputElement).checked })),
  }).toMatchSnapshot(name);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
  localStorage.clear();
  localStorage.setItem('klabin_base_app_database_v1', JSON.stringify(regressionDatabase()));
  vi.clearAllMocks();
  cloud.restore.mockResolvedValue({ success: true });
});
afterEach(() => { cleanup(); if (vi.isMockFunction(storage.exportTableCSV)) vi.mocked(storage.exportTableCSV).mockRestore(); vi.useRealTimers(); });

describe('App — contratos entre abas', () => {
  it('mantém DOM, estilos e valores de todas as telas e subabas', () => {
    render(<App />);
    fingerprint('dashboard');
    navigate(/^Klabin/); fingerprint('cargas');
    click(/Depósitos Klabin/); fingerprint('depositos');
    navigate(/Clientes & Produtos/); fingerprint('vendas');
    click(/Quitadas/); fingerprint('vendas quitadas');
    click(/Cadastro de Clientes/); fingerprint('clientes');
    click(/Catálogo de Produtos/); fingerprint('produtos');
    navigate(/Gestão de Motoristas/); fingerprint('motoristas');
    navigate(/Configurações e Ajustes/); fingerprint('empresa');
    for (const tab of ['Klabin', 'Fretes', 'Ciclos', 'Dados & Backup', 'Google Drive', 'Aplicativo']) {
      fireEvent.click(within(document.querySelector('main')!).getByRole('button', { name: tab })); fingerprint(`config ${tab}`);
    }
  });

  it('preserva modais e rascunhos de configurações entre subabas', () => {
    render(<App />);
    navigate(/Clientes & Produtos/); click('Nova Venda'); fingerprint('modal venda');
    click('Cancelar'); click(/Cadastro de Clientes/); click('Cadastrar Cliente'); fingerprint('modal cliente');
    click('Cancelar');
    navigate(/Configurações e Ajustes/);
    const name = screen.getByDisplayValue('Madeireira Sol Nascente');
    fireEvent.change(name, { target: { value: 'Rascunho local' } });
    click('Fretes'); click('Empresa');
    expect(screen.getByDisplayValue('Rascunho local')).toBeTruthy();
    act(() => cloud.listener!('Settings', { appSettings: { ...regressionDatabase().appSettings, company: { name: 'Empresa remota' } } }));
    expect(screen.getByDisplayValue('Empresa remota')).toBeTruthy();
  });

  it('preserva seleção Klabin ao sair e voltar, mas reinicia Clientes/Produtos após desmontagem', () => {
    render(<App />);
    navigate(/^Klabin/); click(/Depósitos Klabin/);
    navigate(/Clientes & Produtos/); click(/Catálogo de Produtos/);
    navigate(/^Klabin/);
    expect(screen.getByRole('button', { name: /Depósitos Klabin/ }).className).toContain('mac-segmented-item-active');
    navigate(/Clientes & Produtos/);
    expect(screen.getByRole('button', { name: /Clientes & Vendas/ }).className).toContain('mac-segmented-item-active');
    expect(screen.getByPlaceholderText('Buscar em pendentes...')).toBeTruthy();
    expect(localStorage.getItem('app_last_active_table')).toBe('Clientes_Produtos');
  });

  it('recebe snapshot remoto e atualiza saldo e outras abas, persistindo sem criar backup', () => {
    const view = render(<App />);
    act(() => cloud.listener!('Depositos_Klabin', [{ id: 'd2', date: '2026-08-24', value: 2000 }]));
    expect(JSON.parse(localStorage.getItem('klabin_base_app_database_v1')!).Depositos_Klabin[0].id).toBe('d2');
    expect(localStorage.getItem('klabin_base_app_auto_backups_v1')).toBeNull();
    navigate(/^Klabin/); click(/Depósitos Klabin/);
    expect(screen.getAllByText(/2\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.800,00/).length).toBeGreaterThan(0);
    view.unmount(); expect(cloud.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('cadastros de produto e cliente ficam disponíveis em cargas e vendas', () => {
    render(<App />);
    navigate(/Clientes & Produtos/); click(/Catálogo de Produtos/); click('Novo Produto');
    fireEvent.change(screen.getByPlaceholderText('Ex: Eucalipto Tora'), { target: { value: 'Produto Novo' } });
    click('Salvar Produto');
    expect(JSON.parse(localStorage.getItem('klabin_base_app_database_v1')!).Produtos).toHaveLength(2);
    click(/Clientes & Vendas/); click(/Cadastro de Clientes/); click('Cadastrar Cliente');
    fireEvent.change(screen.getByPlaceholderText('Ex: Madeireira Vale do Sol'), { target: { value: 'Cliente Novo' } });
    fireEvent.submit(document.querySelector('form')!);
    click(/Lançamento de Vendas Diretas/); click('Nova Venda');
    expect(screen.getByRole('option', { name: 'Cliente Novo' })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Produto Novo/ })).toBeTruthy();
    click('Cancelar');
    navigate(/^Klabin/); click('Adicionar Carga');
    expect(screen.getByRole('option', { name: /Produto Novo/ })).toBeTruthy();
    click('Salvar Carga');
    expect(JSON.parse(localStorage.getItem('klabin_base_app_database_v1')!).Cargas).toHaveLength(2);
    navigate(/Painel Consolidado/);
    expect(screen.getByText('Últimas Movimentações Operacionais')).toBeTruthy();
  });

  it('quitação e reversão de venda persistem ao navegar e recarregar', () => {
    const view = render(<App />);
    navigate(/Clientes & Produtos/);
    fireEvent.click(screen.getByTitle('Clique para marcar como PAGO / QUITADO'));
    expect(JSON.parse(localStorage.getItem('klabin_base_app_database_v1')!).Vendas[0].status).toBe('PAID');
    navigate(/^Klabin/); navigate(/Clientes & Produtos/); click(/Quitadas/);
    fireEvent.click(screen.getByTitle('Reverter esta venda para Pendente'));
    click('Reverter para pendente');
    expect(JSON.parse(localStorage.getItem('klabin_base_app_database_v1')!).Vendas[0].status).toBe('PENDING');
    view.unmount(); render(<App />); navigate(/Clientes & Produtos/);
    expect(screen.getByTitle('Clique para marcar como PAGO / QUITADO')).toBeTruthy();
  });

  it.each([true, false])('restauração preserva backup anterior, atualiza abas e trata resultado remoto %s', async (success) => {
    const restored = regressionDatabase(); restored.Depositos_Klabin[0].value = 5000;
    localStorage.setItem('klabin_base_app_auto_backups_v1', JSON.stringify([{ filename: 'historico.json', timestamp: '2026-08-30T12:00:00Z', data: restored }]));
    cloud.restore.mockImplementationOnce(async () => {
      const backups = JSON.parse(localStorage.getItem('klabin_base_app_auto_backups_v1')!);
      expect(backups[0].data.Depositos_Klabin[0].value).toBe(1000);
      expect(JSON.parse(localStorage.getItem('klabin_base_app_database_v1')!).Depositos_Klabin[0].value).toBe(5000);
      return { success };
    });
    render(<App />); navigate(/Configurações e Ajustes/); click('Dados & Backup'); click('Restaurar');
    expect(cloud.restore).not.toHaveBeenCalled();
    click('Restaurar backup');
    await waitFor(() => expect(cloud.restore).toHaveBeenCalledTimes(1));
    if (!success) expect(await screen.findByText(/Os dados foram restaurados localmente/)).toBeTruthy();
    navigate(/^Klabin/); click(/Depósitos Klabin/);
    expect(screen.getAllByText(/5\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4\.800,00/).length).toBeGreaterThan(0);
  });

  it('salva configurações preservando demais seções e sincroniza o mesmo contrato', () => {
    render(<App />); navigate(/Configurações e Ajustes/);
    const name = screen.getByDisplayValue('Madeireira Sol Nascente');
    fireEvent.change(name, { target: { value: 'Empresa Alterada' } });
    fireEvent.submit(name.closest('form')!);
    const settings = JSON.parse(localStorage.getItem('klabin_base_app_database_v1')!).appSettings;
    expect(settings.company.name).toBe('Empresa Alterada');
    expect(settings.freightRatePerTon).toBe(15);
    expect(settings.cycles.lockedMonths).toEqual([]);
    expect(cloud.settings).toHaveBeenCalledWith({ appSettings: settings });
    navigate(/^Klabin/);
    expect(screen.getAllByText('Empresa Alterada').length).toBeGreaterThan(0);
  });

  it('exportação CSV segue a aba selecionada e conserva as colunas locais', () => {
    const exportCSV = vi.spyOn(storage, 'exportTableCSV').mockImplementation(() => {});
    render(<App />);
    navigate(/^Klabin/); click('CSV'); click(/Depósitos Klabin/); click('CSV');
    navigate(/Clientes & Produtos/); click('CSV');
    navigate(/Gestão de Motoristas/); click('CSV');
    expect(exportCSV.mock.calls.map(([table, records, columns]) => ({ table, ids: records.map(record => record.id), columns }))).toMatchSnapshot();
  });

  it('restaura somente módulos válidos na preferência LAST_USED', () => {
    localStorage.setItem('app_startup_preference', 'LAST_USED');
    localStorage.setItem('app_last_active_table', 'Klabin');
    const view = render(<App />);
    expect(screen.getByRole('button', { name: /Cargas de Madeira/ })).toBeTruthy();
    view.unmount();
    localStorage.setItem('app_last_active_table', 'inexistente');
    render(<App />);
    expect(screen.getByText('Últimas Movimentações Operacionais')).toBeTruthy();
  });
});
