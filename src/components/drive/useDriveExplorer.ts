import { User } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import { KlabinDatabase } from '../../types';
import { generateConsolidatedReportPdf } from '../../utils/consolidatedReportPdf';
import { buildDriveCSVExports } from '../../utils/exports/driveCSVExports';
import { getCurrentGoogleUser, googleSignIn, googleSignOut, initAuth, } from '../../utils/googleAuth';
import { deleteDriveFile, downloadDriveFileText, DRIVE_FOLDERS, DriveFileItem, listDriveFiles, uploadBackupToDrive, uploadFileToDrive } from '../../utils/googleDrive';
import { validateAndSanitizeBackupJSON } from '../../utils/storage';

export interface GoogleDriveExplorerProps {
  database: KlabinDatabase;
  onRestoreDatabase: (restoredDb: KlabinDatabase) => void;
  onShowToast: (message: string) => void;
}


/** Keeps state and effects mounted for the same lifetime as GoogleDriveExplorer. */
export function useDriveExplorer({
  database,
  onRestoreDatabase,
  onShowToast,
}: GoogleDriveExplorerProps) {
  const [user, setUser] = useState<User | null>(() => getCurrentGoogleUser());
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isExportingCSVs, setIsExportingCSVs] = useState<boolean>(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [isUploadingCustom, setIsUploadingCustom] = useState<boolean>(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<DriveFileItem | null>(null);
  const [restoreConfirmTarget, setRestoreConfirmTarget] = useState<DriveFileItem | null>(null);
  const [appFolderId, setAppFolderId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'BACKUPS' | 'DOCS'>('ALL');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Auth listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, authToken) => {
        setUser(authUser);
        setToken(authToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch files whenever user is authenticated
  useEffect(() => {
    if (user && token) {
      loadDriveData();
    } else {
      setFiles([]);
      setAppFolderId(null);
    }
  }, [user, token]);

  const loadDriveData = async () => {
    setIsLoadingFiles(true);
    try {
      setAppFolderId(DRIVE_FOLDERS.backups);

      // Cloud files span the backup and generated-report destinations.
      const [backupFiles, reportFiles] = await Promise.all([
        listDriveFiles({ folderId: DRIVE_FOLDERS.backups }),
        listDriveFiles({ folderId: DRIVE_FOLDERS.desktop }),
      ]);
      const filesById = new Map(
        [...backupFiles, ...reportFiles].map((file) => [file.id, file])
      );
      setFiles(
        [...filesById.values()].sort((a, b) =>
          (b.modifiedTime || '').localeCompare(a.modifiedTime || '')
        )
      );
    } catch (err: any) {
      console.error('[GoogleDrive] Erro ao carregar arquivos:', err);
      onShowToast(`Erro no Google Drive: ${err.message || 'Falha ao sincronizar'}`);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        onShowToast(`Conectado ao Google Drive como ${result.user.email}`);
      }
    } catch (err: any) {
      if (
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/cancelled-popup-request'
      ) {
        console.warn('[GoogleDrive] Aviso no login:', err);
        onShowToast(`Falha na autenticação: ${err.message || 'Verifique sua conexão'}`);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      setUser(null);
      setToken(null);
      setFiles([]);
      onShowToast('Desconectado do Google Drive.');
    } catch (err: any) {
      console.error('[GoogleDrive] Erro ao desconectar:', err);
    }
  };

  // Perform full database backup to Drive
  const handleCreateCloudBackup = async () => {
    if (!user || !token) {
      onShowToast('Conecte sua conta Google primeiro.');
      return;
    }

    setIsBackingUp(true);
    try {
      const created = await uploadBackupToDrive(database);
      onShowToast(`Backup salvo com sucesso no Google Drive: ${created.name}`);
      await loadDriveData();
    } catch (err: any) {
      console.error('[GoogleDrive] Erro no backup:', err);
      onShowToast(`Erro ao salvar backup: ${err.message || 'Falha na conexão'}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Export operational CSV tables to Drive
  const handleExportCSVsToDrive = async () => {
    if (!user || !token) {
      onShowToast('Conecte sua conta Google primeiro.');
      return;
    }

    setIsExportingCSVs(true);
    try {
      const folderId = DRIVE_FOLDERS.backups;
      const now = new Date().toISOString().slice(0, 10);

      const tablesToExport = buildDriveCSVExports(database, now);

      for (const table of tablesToExport) {
        await uploadFileToDrive({
          name: table.name,
          content: table.csv,
          mimeType: 'text/csv; charset=UTF-8',
          folderId,
          description: `Planilha CSV gerada pelo sistema em ${now}`,
        });
      }

      onShowToast(`${tablesToExport.length} tabelas CSV exportadas para o Google Drive!`);
      await loadDriveData();
    } catch (err: any) {
      console.error('[GoogleDrive] Erro ao exportar CSVs:', err);
      onShowToast(`Erro ao exportar planilhas: ${err.message}`);
    } finally {
      setIsExportingCSVs(false);
    }
  };

  // Generate a single consolidated PDF report (executive summary + all tables) and upload it to Drive
  const handleGenerateConsolidatedReport = async () => {
    if (!user || !token) {
      onShowToast('Conecte sua conta Google primeiro.');
      return;
    }

    setIsGeneratingReport(true);
    try {
      const { blob, filename } = generateConsolidatedReportPdf(database);
      const created = await uploadFileToDrive({
        name: filename,
        content: blob,
        mimeType: 'application/pdf',
        folderId: DRIVE_FOLDERS.desktop,
        description: 'Relatório consolidado (resumo executivo + tabelas) gerado pelo sistema',
      });

      onShowToast(`Relatório consolidado "${created.name || filename}" salvo no Google Drive!`);
      await loadDriveData();
    } catch (err: any) {
      console.error('[GoogleDrive] Erro ao gerar relatório consolidado:', err);
      onShowToast(`Erro ao gerar relatório: ${err.message || 'Falha na conexão'}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Upload arbitrary custom file (receipt, invoice, document)
  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !token) return;

    setIsUploadingCustom(true);
    try {
      const folderId = DRIVE_FOLDERS.backups;
      await uploadFileToDrive({
        name: file.name,
        content: file,
        mimeType: file.type || 'application/octet-stream',
        folderId,
        description: `Arquivo anexado via sistema Madeireira Sol Nascente`,
      });

      onShowToast(`Arquivo "${file.name}" enviado com sucesso para o Google Drive!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDriveData();
    } catch (err: any) {
      console.error('[GoogleDrive] Erro ao subir arquivo:', err);
      onShowToast(`Erro no upload: ${err.message}`);
    } finally {
      setIsUploadingCustom(false);
    }
  };

  // Restore database from Drive JSON file
  const handleConfirmRestore = async () => {
    if (!restoreConfirmTarget) return;

    try {
      const jsonText = await downloadDriveFileText(restoreConfirmTarget.id);
      const parsed = JSON.parse(jsonText);
      const dbPayload = parsed.database || parsed;

      const validation = validateAndSanitizeBackupJSON(dbPayload);
      if (!validation.isValid || !validation.sanitizedDb) {
        onShowToast(`Falha ao restaurar backup: ${validation.errorMessage || 'Formato de arquivo inválido.'}`);
        return;
      }
      onRestoreDatabase(validation.sanitizedDb);
      onShowToast(`Banco de dados restaurado com sucesso a partir de "${restoreConfirmTarget.name}"!`);
      setRestoreConfirmTarget(null);
    } catch (err: any) {
      console.error('[GoogleDrive] Erro ao restaurar:', err);
      onShowToast(`Falha ao restaurar backup: ${err.message}`);
    }
  };

  // Delete file from Drive (with user confirmation requirement)
  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;

    try {
      await deleteDriveFile(deleteConfirmTarget.id);
      onShowToast(`Arquivo "${deleteConfirmTarget.name}" removido do Google Drive.`);
      setFiles((prev) => prev.filter((f) => f.id !== deleteConfirmTarget.id));
      setDeleteConfirmTarget(null);
    } catch (err: any) {
      console.error('[GoogleDrive] Erro ao excluir:', err);
      onShowToast(`Erro ao excluir: ${err.message}`);
    }
  };

  // Filter files
  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      !searchQuery ||
      file.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'BACKUPS') {
      return file.name.endsWith('.json') || file.mimeType.includes('json');
    }
    if (activeFilter === 'DOCS') {
      return !file.name.endsWith('.json') && !file.mimeType.includes('json');
    }
    return true;
  });


  return {
    user,
    token,
    isAuthLoading,
    handleSignIn,
    handleSignOut,
    handleCreateCloudBackup,
    isBackingUp,
    handleExportCSVsToDrive,
    isExportingCSVs,
    handleGenerateConsolidatedReport,
    isGeneratingReport,
    fileInputRef,
    handleCustomFileUpload,
    isUploadingCustom,
    filteredFiles,
    setActiveFilter,
    activeFilter,
    searchQuery,
    setSearchQuery,
    loadDriveData,
    isLoadingFiles,
    setRestoreConfirmTarget,
    setDeleteConfirmTarget,
    deleteConfirmTarget,
    handleConfirmDelete,
    restoreConfirmTarget,
    handleConfirmRestore,
  };
}
