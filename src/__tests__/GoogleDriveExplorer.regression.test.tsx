import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';
const auth = vi.hoisted(() => ({ listener: null as any, unsubscribe: vi.fn(), signIn: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined) }));
const drive = vi.hoisted(() => ({ list: vi.fn(), upload: vi.fn(), backup: vi.fn(), download: vi.fn(), remove: vi.fn() }));
vi.mock('../utils/googleAuth', () => ({ getCurrentGoogleUser: () => null, initAuth: (listener: any) => { auth.listener = listener; return auth.unsubscribe; }, googleSignIn: auth.signIn, googleSignOut: auth.signOut }));
vi.mock('../utils/googleDrive', async importOriginal => ({ ...await importOriginal<any>(), listDriveFiles: drive.list, uploadFileToDrive: drive.upload, uploadBackupToDrive: drive.backup, downloadDriveFileText: drive.download, deleteDriveFile: drive.remove }));
import { GoogleDriveExplorer } from '../components/GoogleDriveExplorer';
import { DRIVE_FOLDERS } from '../utils/googleDrive';
const toast = vi.fn(); const restore = vi.fn();
const backup = { id: 'b1', name: 'copia.json', mimeType: 'application/json', modifiedTime: '2026-08-20T12:00:00Z' };
const report = { id: 'r1', name: 'relatorio.pdf', mimeType: 'application/pdf', modifiedTime: '2026-08-21T12:00:00Z' };
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));
async function connect() {
  await act(async () => auth.listener({ displayName: 'Pessoa Teste', email: 'teste@example.invalid' }, 'fake-token'));
  await screen.findByText('copia.json');
}
beforeEach(() => {
  vi.clearAllMocks();
  drive.list.mockImplementation(async ({ folderId }) => folderId === DRIVE_FOLDERS.backups ? [backup] : [report, backup]);
  drive.backup.mockResolvedValue({ name: 'nova-copia.json' });
  drive.upload.mockResolvedValue({ name: 'arquivo' });
  drive.download.mockResolvedValue(JSON.stringify({ database: regressionDatabase() }));
  drive.remove.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe('Google Drive — operações da tela com fronteiras simuladas', () => {
  it('preserva login cancelado, lista sem duplicação, filtros, logout e unsubscribe', async () => {
    const view = render(<GoogleDriveExplorer database={regressionDatabase()} onRestoreDatabase={restore} onShowToast={toast} />);
    auth.signIn.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    click('Conectar Google Drive');
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledTimes(1));
    expect(toast).not.toHaveBeenCalled();
    await connect();
    expect(screen.getAllByText('copia.json')).toHaveLength(1);
    const names = [...document.querySelectorAll('tbody tr')].map(row => row.textContent);
    expect(names[0]).toContain('relatorio.pdf');
    fireEvent.change(screen.getByPlaceholderText('Filtrar por nome...'), { target: { value: 'copia' } });
    expect(screen.queryByText('relatorio.pdf')).toBeNull();
    click('Desconectar');
    await screen.findByRole('button', { name: 'Conectar Google Drive' });
    expect(screen.queryByText('copia.json')).toBeNull();
    view.unmount(); expect(auth.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('exporta os cinco CSVs na ordem, pasta e formato existentes e atualiza listagem', async () => {
    render(<GoogleDriveExplorer database={regressionDatabase()} onRestoreDatabase={restore} onShowToast={toast} />); await connect();
    click(/Exportar CSVs Operacionais/);
    await waitFor(() => expect(drive.upload).toHaveBeenCalledTimes(5));
    const calls = drive.upload.mock.calls.map(([args]) => ({ ...args, name: args.name.replace(/\d{4}-\d{2}-\d{2}/g, 'DATE'), description: args.description.replace(/\d{4}-\d{2}-\d{2}/g, 'DATE') }));
    expect(calls).toMatchSnapshot();
    await waitFor(() => expect(drive.list).toHaveBeenCalledTimes(4));
  });
  it('restaura JSON envelopado somente após confirmação e mantém exclusão em duas etapas', async () => {
    render(<GoogleDriveExplorer database={regressionDatabase()} onRestoreDatabase={restore} onShowToast={toast} />); await connect();
    click('Restaurar'); expect(restore).not.toHaveBeenCalled();
    click('Confirmar Restauração');
    await waitFor(() => expect(restore).toHaveBeenCalledTimes(1));
    expect(restore.mock.calls[0][0].Depositos_Klabin[0].value).toBe(1000);
    fireEvent.click(screen.getAllByTitle('Excluir arquivo do Google Drive')[0]);
    expect(drive.remove).not.toHaveBeenCalled(); click('Cancelar');
    fireEvent.click(screen.getAllByTitle('Excluir arquivo do Google Drive')[0]); click('Sim, Excluir Arquivo');
    await waitFor(() => expect(drive.remove).toHaveBeenCalledWith('r1'));
    expect(screen.queryByText('relatorio.pdf')).toBeNull();
  });
  it('informa falha ao restaurar JSON inválido sem alterar banco', async () => {
    drive.download.mockResolvedValueOnce('invalido');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<GoogleDriveExplorer database={regressionDatabase()} onRestoreDatabase={restore} onShowToast={toast} />); await connect();
    click('Restaurar'); click('Confirmar Restauração');
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('Falha ao restaurar backup:')));
    expect(restore).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
