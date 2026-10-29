import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';

const firebase = vi.hoisted(() => ({ upsert: vi.fn(), remove: vi.fn(), restore: vi.fn() }));
vi.mock('../utils/firebaseSync', () => ({
  subscribeToFirestore: () => () => {},
  checkAndSeedFirestoreIfEmpty: vi.fn().mockResolvedValue(false),
  flushPendingFirestoreUpserts: vi.fn().mockResolvedValue(undefined),
  upsertFirestoreRecord: firebase.upsert,
  deleteFirestoreRecord: firebase.remove,
  syncFirestoreSettings: vi.fn(),
  restoreFirestoreAuthoritatively: firebase.restore,
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

const DB_KEY = 'klabin_base_app_database_v1';
const stored = () => JSON.parse(localStorage.getItem(DB_KEY)!);
const storedLancamentos = (): any[] => stored().MaoDeObra_Lancamentos;
const aside = () => within(document.querySelector('aside')!);
const novoForm = () => within(screen.getByRole('form', { name: 'Novo lançamento' }));
const editForm = () => within(screen.getByRole('form', { name: 'Editar lançamento' }));
const tab = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const cardText = (label: string) => screen.getByText(label).parentElement!.textContent!;

const seed = (extra: Record<string, unknown> = {}, lockedMonths: string[] = []) => {
  const db: any = { ...regressionDatabase(), ...extra };
  db.appSettings.cycles.lockedMonths = lockedMonths;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

const openModule = () => {
  render(<App />);
  fireEvent.click(aside().getByRole('button', { name: /^Mão de Obra/ }));
};

const cadastrarClienteEProduto = () => {
  tab(/^Cadastro/);
  type(screen.getByLabelText('Nome do cliente *'), 'Serraria Boa Vista');
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar cliente' }));
  type(screen.getByLabelText('Nome do produto *'), 'Descarga de tora');
  type(screen.getByLabelText('Preço por t (R$)'), '150,00');
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar produto' }));
  tab(/^Principal/);
  return { clientId: stored().MaoDeObra_Clientes[0].id, productId: stored().MaoDeObra_Produtos[0].id };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
  localStorage.clear();
  vi.clearAllMocks();
  firebase.restore.mockResolvedValue({ success: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Módulo Mão de Obra', () => {
  it('aparece no menu logo abaixo de Klabin e abre na aba Principal', () => {
    seed();
    openModule();
    const labels = aside().getAllByRole('button').map((b) => b.textContent || '');
    const klabin = labels.findIndex((t) => t.startsWith('Klabin'));
    expect(labels[klabin + 1]).toMatch(/^Mão de Obra/);
    expect(screen.getByText('Módulo Mão de Obra', { selector: 'h1, h2' })).toBeTruthy();
    expect(screen.getByText('Nenhum lançamento pendente.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /CSV/i })).toBeNull();
  });

  it('registra só toneladas, sem cliente, produto, data ou valor, e sem mostrar R$ 0,00 no lançamento', () => {
    seed();
    openModule();
    type(novoForm().getByLabelText('Toneladas'), '12,5');
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));

    const [l] = storedLancamentos();
    expect(l).toMatchObject({
      quantityTons: 12.5, clientId: null, productId: null, date: null, totalValue: null, status: 'PENDING', paidAt: null,
    });
    expect(l.id).toMatch(/^mob-/);
    expect(firebase.upsert).toHaveBeenLastCalledWith('maoDeObraLancamentos', expect.objectContaining({ id: l.id, quantityTons: 12.5 }));
    const row = screen.getAllByRole('row')[1].textContent!;
    expect(row).toContain('12,50');
    expect(row).not.toMatch(/R\$\s0,00/);
    expect(cardText('Toneladas pendentes')).toContain('12,50 t');
    expect(cardText('Valor pendente conhecido')).toContain('1 lançamento(s) sem valor informado');
    expect(aside().getByRole('button', { name: /^Mão de Obra/ }).textContent).toMatch(/1$/);
  });

  it('aceita outras combinações de campos e recusa só o lançamento totalmente vazio', () => {
    seed();
    openModule();
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));
    expect(screen.getByRole('alert').textContent).toContain('Preencha pelo menos um campo');
    expect(storedLancamentos()).toEqual([]);

    type(novoForm().getByLabelText('Data'), '2026-09-02');
    type(novoForm().getByLabelText('Valor total (R$)'), '300,00');
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));
    expect(storedLancamentos()[0]).toMatchObject({ date: '2026-09-02', quantityTons: null, totalValue: 300, totalValueManual: true });
  });

  it('usa clientes e produtos do cadastro e calcula 12 t × R$ 150,00/t = R$ 1.800,00', () => {
    seed();
    openModule();
    const { clientId, productId } = cadastrarClienteEProduto();
    type(novoForm().getByLabelText('Cliente'), clientId);
    type(novoForm().getByLabelText('Produto'), productId);
    type(novoForm().getByLabelText('Toneladas'), '12');
    expect((novoForm().getByLabelText('Valor total (R$)') as HTMLInputElement).value).toBe('1.800,00');
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));

    expect(storedLancamentos()[0]).toMatchObject({
      clientId, clientName: 'Serraria Boa Vista', productId, productName: 'Descarga de tora',
      quantityTons: 12, pricePerTon: 150, totalValue: 1800, totalValueManual: false,
    });
    expect(firebase.upsert).toHaveBeenCalledWith('maoDeObraClientes', expect.objectContaining({ name: 'Serraria Boa Vista' }));
    expect(firebase.upsert).toHaveBeenCalledWith('maoDeObraProdutos', expect.objectContaining({ pricePerTon: 150 }));
    expect(cardText('Valor pendente conhecido')).toMatch(/R\$\s1\.800,00/);
    // Lançamento rápido: cliente e produto ficam selecionados para o próximo registro.
    expect((novoForm().getByLabelText('Produto') as HTMLSelectElement).value).toBe(productId);
    expect((novoForm().getByLabelText('Toneladas') as HTMLInputElement).value).toBe('');
  });

  it('preserva valor e preço gravados quando o preço do produto muda depois', () => {
    seed();
    openModule();
    const { productId } = cadastrarClienteEProduto();
    type(novoForm().getByLabelText('Produto'), productId);
    type(novoForm().getByLabelText('Toneladas'), '12');
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));

    tab(/^Cadastro/);
    fireEvent.click(screen.getByTitle('Editar produto'));
    type(screen.getByLabelText('Preço por t (R$)'), '200,00');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar produto' }));
    expect(stored().MaoDeObra_Produtos[0].pricePerTon).toBe(200);
    expect(storedLancamentos()[0]).toMatchObject({ pricePerTon: 150, totalValue: 1800 });

    // Editar as toneladas recalcula com o preço gravado no lançamento, não com o novo.
    tab(/^Principal/);
    fireEvent.click(screen.getByTitle('Editar lançamento'));
    expect((editForm().getByLabelText('Valor total (R$)') as HTMLInputElement).value).toBe('1.800,00');
    type(editForm().getByLabelText('Toneladas'), '10');
    fireEvent.click(editForm().getByRole('button', { name: 'Salvar lançamento' }));
    expect(storedLancamentos()[0]).toMatchObject({ quantityTons: 10, pricePerTon: 150, totalValue: 1500 });
  });

  it('valor digitado manualmente não é sobrescrito pelo cálculo', () => {
    seed();
    openModule();
    const { productId } = cadastrarClienteEProduto();
    type(novoForm().getByLabelText('Produto'), productId);
    type(novoForm().getByLabelText('Toneladas'), '12');
    type(novoForm().getByLabelText('Valor total (R$)'), '2.000,00');
    type(novoForm().getByLabelText('Toneladas'), '13');
    expect((novoForm().getByLabelText('Valor total (R$)') as HTMLInputElement).value).toBe('2.000,00');
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));
    expect(storedLancamentos()[0]).toMatchObject({ quantityTons: 13, totalValue: 2000, totalValueManual: true });

    fireEvent.click(screen.getByTitle('Editar lançamento'));
    type(editForm().getByLabelText('Toneladas'), '20');
    fireEvent.click(editForm().getByRole('button', { name: 'Salvar lançamento' }));
    expect(storedLancamentos()[0]).toMatchObject({ quantityTons: 20, totalValue: 2000, totalValueManual: true });
  });

  it('lançamento só com toneladas ganha produto e valor calculado na edição', () => {
    seed();
    openModule();
    type(novoForm().getByLabelText('Toneladas'), '12');
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));
    const { productId } = cadastrarClienteEProduto();

    fireEvent.click(screen.getByTitle('Editar lançamento'));
    type(editForm().getByLabelText('Produto'), productId);
    expect((editForm().getByLabelText('Valor total (R$)') as HTMLInputElement).value).toBe('1.800,00');
    fireEvent.click(editForm().getByRole('button', { name: 'Salvar lançamento' }));
    expect(storedLancamentos()).toHaveLength(1);
    expect(storedLancamentos()[0]).toMatchObject({ productId, quantityTons: 12, pricePerTon: 150, totalValue: 1800, status: 'PENDING' });
  });

  it('exclui com confirmação e remove do Firestore', () => {
    seed({ MaoDeObra_Lancamentos: [{ id: 'mob-1', quantityTons: 5, status: 'PENDING' }] });
    openModule();
    fireEvent.click(screen.getByTitle('Excluir lançamento'));
    expect(storedLancamentos()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar|^Excluir$/ }));
    expect(storedLancamentos()).toEqual([]);
    expect(firebase.remove).toHaveBeenCalledWith('maoDeObraLancamentos', 'mob-1');
  });

  it('quita e reverte sem alterar, duplicar ou excluir os dados do lançamento', () => {
    const original = {
      id: 'mob-1', clientId: null, clientName: 'Cliente Antigo', productId: null, productName: 'Serviço',
      date: '2026-09-01', quantityTons: 8, pricePerTon: 150, totalValue: 1200, totalValueManual: false,
      status: 'PENDING', paidAt: null, createdAt: '2026-09-01T10:00:00.000Z',
    };
    seed({ MaoDeObra_Lancamentos: [original, { id: 'mob-2', quantityTons: 2, status: 'PENDING' }] });
    openModule();
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0]);

    const paid = storedLancamentos().find((l) => l.id === 'mob-1');
    expect(storedLancamentos()).toHaveLength(2);
    expect(paid).toEqual({ ...original, status: 'PAID', paidAt: '2026-09-06T12:00:00.000Z' });
    expect(firebase.upsert).toHaveBeenLastCalledWith('maoDeObraLancamentos', expect.objectContaining({ id: 'mob-1', status: 'PAID' }));
    expect(cardText('Toneladas pendentes')).toContain('2,00 t');

    tab(/^Quitados/);
    const row = screen.getAllByRole('row')[1].textContent!;
    expect(row).toContain('Cliente Antigo');
    expect(row).toMatch(/R\$\s1\.200,00/);
    expect(row).toContain('06/09/2026');
    expect(cardText('Toneladas quitadas')).toContain('8,00 t');
    expect(cardText('Valor quitado conhecido')).toMatch(/R\$\s1\.200,00/);
    expect(screen.queryByTitle('Excluir lançamento')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reverter' }));
    expect(storedLancamentos().find((l) => l.id === 'mob-1')).toEqual(original);
    expect(screen.getByText('Nenhum lançamento quitado.')).toBeTruthy();
  });

  it('quita lançamento sem valor financeiro', () => {
    seed({ MaoDeObra_Lancamentos: [{ id: 'mob-1', quantityTons: 4, status: 'PENDING' }] });
    openModule();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(storedLancamentos()[0]).toMatchObject({ status: 'PAID', totalValue: null });
    tab(/^Quitados/);
    expect(cardText('Valor quitado conhecido')).toContain('1 lançamento(s) sem valor informado');
  });

  it('mantém lançamentos, cadastros e quitação ao fechar e reabrir o app', () => {
    seed();
    openModule();
    cadastrarClienteEProduto();
    type(novoForm().getByLabelText('Toneladas'), '7');
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    cleanup();

    openModule();
    expect(screen.getByRole('button', { name: /^Quitados \(1\)/ })).toBeTruthy();
    tab(/^Cadastro/);
    expect(screen.getByText('Serraria Boa Vista')).toBeTruthy();
    expect(screen.getByText('R$ 150,00')).toBeTruthy();
  });

  it('bloqueia editar e excluir lançamento de mês trancado, mas permite quitar', () => {
    seed({ MaoDeObra_Lancamentos: [{ id: 'mob-1', date: '2026-08-10', quantityTons: 3, status: 'PENDING' }] }, ['2026-08']);
    openModule();
    expect((screen.getByTitle('Editar lançamento') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTitle('Excluir lançamento') as HTMLButtonElement).disabled).toBe(true);
    type(novoForm().getByLabelText('Data'), '2026-08-15');
    type(novoForm().getByLabelText('Toneladas'), '1');
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));
    expect(storedLancamentos()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(storedLancamentos()[0].status).toBe('PAID');
  });

  it('restaurar backup anterior ao módulo mantém os dados da Mão de Obra', async () => {
    const lancamento = { id: 'mob-1', quantityTons: 9, status: 'PENDING' };
    seed({ MaoDeObra_Lancamentos: [lancamento], MaoDeObra_Clientes: [{ id: 'mobcli-1', name: 'Serraria' }] });
    const legacy: any = regressionDatabase();
    legacy.Depositos_Klabin[0].value = 5000;
    localStorage.setItem('klabin_base_app_auto_backups_v1', JSON.stringify([{ filename: 'antigo.json', timestamp: '2026-08-30T12:00:00Z', data: legacy }]));

    render(<App />);
    fireEvent.click(aside().getByRole('button', { name: /Configurações e Ajustes/ }));
    tab(/Dados & Backup/);
    tab(/^Restaurar$/);
    tab(/^Restaurar backup$/);
    await waitFor(() => expect(firebase.restore).toHaveBeenCalledTimes(1));

    const restored = firebase.restore.mock.calls[0][0];
    expect(restored.Depositos_Klabin[0].value).toBe(5000);
    expect(restored.MaoDeObra_Lancamentos).toEqual([expect.objectContaining({ id: 'mob-1', quantityTons: 9 })]);
    expect(restored.MaoDeObra_Clientes).toEqual([expect.objectContaining({ id: 'mobcli-1' })]);
    expect(storedLancamentos()).toEqual([expect.objectContaining({ id: 'mob-1' })]);
  });

  it('abrir e salvar sem mudanças não altera o lançamento, mesmo acima de mil toneladas', () => {
    const original = {
      id: 'mob-1', clientId: null, clientName: null, productId: 'mobprod-x', productName: 'Serviço',
      date: '2026-09-01', quantityTons: 1234.5678, pricePerTon: 150, totalValue: 185185.17, totalValueManual: false,
      status: 'PENDING', paidAt: null, createdAt: '2026-09-01T10:00:00.000Z',
    };
    seed({ MaoDeObra_Lancamentos: [original] });
    openModule();
    fireEvent.click(screen.getByTitle('Editar lançamento'));
    expect((editForm().getByLabelText('Toneladas') as HTMLInputElement).value).toBe('1234,5678');
    expect((editForm().getByLabelText('Valor total (R$)') as HTMLInputElement).value).toBe('185.185,17');
    fireEvent.click(editForm().getByRole('button', { name: 'Salvar lançamento' }));
    expect(storedLancamentos()[0]).toEqual(original);
  });

  it('lançamento antigo sem preço gravado já mostra no formulário o valor que será salvo', () => {
    seed({
      MaoDeObra_Produtos: [{ id: 'mobprod-1', name: 'Descarga', pricePerTon: 150 }],
      MaoDeObra_Lancamentos: [{ id: 'mob-1', productId: 'mobprod-1', productName: 'Descarga', quantityTons: 2, status: 'PENDING' }],
    });
    openModule();
    fireEvent.click(screen.getByTitle('Editar lançamento'));
    expect((editForm().getByLabelText('Valor total (R$)') as HTMLInputElement).value).toBe('300,00');
    fireEvent.click(editForm().getByRole('button', { name: 'Salvar lançamento' }));
    expect(storedLancamentos()[0]).toMatchObject({ pricePerTon: 150, totalValue: 300, totalValueManual: false });
  });

  it('apagar o valor manual volta ao cálculo automático; "1.500" t é lido como mil e quinhentas', () => {
    seed();
    openModule();
    const { productId } = cadastrarClienteEProduto();
    type(novoForm().getByLabelText('Produto'), productId);
    type(novoForm().getByLabelText('Toneladas'), '1.500');
    expect((novoForm().getByLabelText('Valor total (R$)') as HTMLInputElement).value).toBe('225.000,00');
    type(novoForm().getByLabelText('Valor total (R$)'), '10,00');
    type(novoForm().getByLabelText('Valor total (R$)'), '');
    expect((novoForm().getByLabelText('Valor total (R$)') as HTMLInputElement).value).toBe('225.000,00');
    fireEvent.click(novoForm().getByRole('button', { name: 'Lançar' }));
    expect(storedLancamentos()[0]).toMatchObject({ quantityTons: 1500, totalValue: 225000, totalValueManual: false });
  });
});
