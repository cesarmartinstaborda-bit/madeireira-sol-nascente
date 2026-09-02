import { getAccessToken } from './googleAuth';
import { KlabinDatabase } from '../types';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
}

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const UPLOAD_FIELDS = 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,parents';
const UPLOAD_API_URL = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(UPLOAD_FIELDS)}`;

export const DRIVE_FOLDERS = {
  backups: '1vb-iYAB_zBL2Fq4bmvjNUGeNouxXPUJy',
  desktop: '1F835cA1x6wzGA_eI8WZ28sSK5eEIySQf',
} as const;

/**
 * Ensures authorized headers with access token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Usuário não autenticado no Google. Por favor, conecte sua conta Google.');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * List files from Google Drive (optionally inside a folder or matching a query)
 */
export async function listDriveFiles(options?: {
  folderId?: string;
  query?: string;
  pageSize?: number;
}): Promise<DriveFileItem[]> {
  const headers = await getAuthHeaders();
  const queries: string[] = ['trashed = false'];

  if (options?.folderId) {
    queries.push(`'${options.folderId}' in parents`);
  }
  if (options?.query) {
    queries.push(`(name contains '${options.query}' or fullText contains '${options.query}')`);
  }

  const q = encodeURIComponent(queries.join(' and '));
  const fields = encodeURIComponent('files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, parents)');
  const pageSize = options?.pageSize || 50;

  const url = `${DRIVE_API_URL}/files?q=${q}&fields=${fields}&pageSize=${pageSize}&orderBy=modifiedTime desc`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Erro ao listar arquivos do Drive (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Finds or creates the default folder in Google Drive
 */
export async function getOrCreateFolder(folderName: string = 'Madeireira Sol Nascente'): Promise<string> {
  const headers = await getAuthHeaders();

  // Check if folder exists
  const q = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`);
  const checkUrl = `${DRIVE_API_URL}/files?q=${q}&fields=files(id,name)`;

  const checkRes = await fetch(checkUrl, { headers });
  if (checkRes.ok) {
    const data = await checkRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder if not found
  const createRes = await fetch(`${DRIVE_API_URL}/files`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Pasta do Sistema de Gestão da Madeireira Sol Nascente',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Erro ao criar pasta no Google Drive');
  }

  const created = await createRes.json();
  return created.id;
}

/**
 * Uploads a text or binary file to Google Drive using multipart upload
 */
export async function uploadFileToDrive(options: {
  name: string;
  content: string | Blob;
  mimeType: string;
  folderId?: string;
  description?: string;
}): Promise<DriveFileItem> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autenticação necessária para salvar no Google Drive.');
  }

  const metadata: any = {
    name: options.name,
    mimeType: options.mimeType,
  };

  if (options.folderId) {
    metadata.parents = [options.folderId];
  }
  if (options.description) {
    metadata.description = options.description;
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let body: Blob;
  if (typeof options.content === 'string') {
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${options.mimeType}\r\n\r\n` +
      options.content +
      closeDelimiter;

    body = new Blob([multipartRequestBody], { type: `multipart/related; boundary=${boundary}` });
  } else {
    // Blob/Binary upload
    const metaBlob = new Blob([
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${options.mimeType}\r\n\r\n`
    ], { type: 'text/plain' });

    const endBlob = new Blob([closeDelimiter], { type: 'text/plain' });
    body = new Blob([metaBlob, options.content, endBlob], { type: `multipart/related; boundary=${boundary}` });
  }

  const res = await fetch(UPLOAD_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro no upload para o Google Drive (${res.status})`);
  }

  return await res.json();
}

/**
 * Returns the fixed destination for generated PDFs. This intentionally does
 * not look up a folder by name: the configured Drive folder ID is authoritative.
 */
export async function resolvePdfDriveFolderId(): Promise<{ id: string; usedFallback: boolean }> {
  return { id: DRIVE_FOLDERS.desktop, usedFallback: false };
}

export type PdfAutoUploadStatus = 'uploaded' | 'skipped-no-session' | 'error';

export interface PdfAutoUploadResult {
  status: PdfAutoUploadStatus;
  filename: string;
  fileId?: string;
  usedFallbackFolder?: boolean;
  message?: string;
}

function emitPdfUploadNotice(result: PdfAutoUploadResult): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent<PdfAutoUploadResult>('drive-pdf-autoupload', { detail: result }));
  }
}

/**
 * Best-effort mirror of a freshly generated PDF into the dedicated Drive folder.
 * NEVER throws: if there is no active Drive session, or the upload fails, it
 * resolves with a non-'uploaded' status and emits a discreet
 * 'drive-pdf-autoupload' window event so the UI can show a subtle notice. The
 * local PDF download is expected to have already happened at the call site, so
 * this can never block or break PDF generation.
 */
export async function autoUploadPdfToDrive(blob: Blob, filename: string): Promise<PdfAutoUploadResult> {
  let result: PdfAutoUploadResult;
  try {
    const token = await getAccessToken();
    if (!token) {
      result = {
        status: 'skipped-no-session',
        filename,
        message: 'Sem sessão do Google Drive ativa — upload ignorado.',
      };
      emitPdfUploadNotice(result);
      return result;
    }

    const { id: folderId, usedFallback } = await resolvePdfDriveFolderId();
    const uploaded = await uploadFileToDrive({
      name: filename,
      content: blob,
      mimeType: 'application/pdf',
      folderId,
      description: `PDF gerado automaticamente pelo sistema em ${new Date().toLocaleString('pt-BR')}`,
    });

    result = {
      status: 'uploaded',
      filename,
      fileId: uploaded.id,
      usedFallbackFolder: usedFallback,
    };
  } catch (err: any) {
    result = {
      status: 'error',
      filename,
      message: err?.message || 'Falha desconhecida no upload para o Drive.',
    };
  }

  emitPdfUploadNotice(result);
  return result;
}

/**
 * Uploads a full JSON database backup directly to Google Drive
 */
export async function uploadBackupToDrive(database: KlabinDatabase): Promise<DriveFileItem> {
  const folderId = DRIVE_FOLDERS.backups;
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `Backup_SolNascente_${dateStr}.json`;

  const payload = {
    version: '1.0.0',
    exportTimestamp: now.toISOString(),
    database,
    metadata: {
      generatedBy: 'Madeireira Sol Nascente - Google Drive Sync',
      environment: 'Web / Cloud',
      recordCounts: {
        cargas: database.Cargas?.length || 0,
        depositos: database.Depositos_Klabin?.length || 0,
        clientes: database.Clientes?.length || 0,
        vendas: database.Vendas?.length || 0,
        produtos: database.Produtos?.length || 0,
        motoristas: database.Motoristas?.length || 0,
      },
    },
  };

  const jsonContent = JSON.stringify(payload, null, 2);

  return await uploadFileToDrive({
    name: fileName,
    content: jsonContent,
    mimeType: 'application/json',
    folderId,
    description: `Cópia de segurança gerada automaticamente em ${now.toLocaleString('pt-BR')}`,
  });
}

/**
 * Downloads a file's content as text (e.g. for JSON backup or CSV)
 */
export async function downloadDriveFileText(fileId: string): Promise<string> {
  const headers = await getAuthHeaders();
  const url = `${DRIVE_API_URL}/files/${fileId}?alt=media`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro ao baixar arquivo do Drive (${response.status})`);
  }

  return await response.text();
}

/**
 * Deletes a file on Google Drive
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const url = `${DRIVE_API_URL}/files/${fileId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro ao excluir arquivo no Google Drive (${response.status})`);
  }
}

/**
 * Formats file size in bytes to human readable format
 */
export function formatDriveFileSize(bytesStr?: string | number): string {
  if (!bytesStr) return '—';
  const bytes = Number(bytesStr);
  if (isNaN(bytes) || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
