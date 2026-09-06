import { KlabinDatabase } from '../types';
import { initialKlabinData } from '../data/initialData';
import { sanitizeDatabase } from './storage/sanitizeDatabase';
export { sanitizeDatabase } from './storage/sanitizeDatabase';

const STORAGE_KEY = 'klabin_base_app_database_v1';
const AUTO_BACKUPS_KEY = 'klabin_base_app_auto_backups_v1';

export interface AutoBackupEntry {
  filename: string;
  timestamp: string;
  data: KlabinDatabase;
}

/**
 * Returns list of auto backups stored in localStorage (max 5, newest first).
 * If localStorage has more than 5 backups, immediately prunes and persists the 5 most recent.
 */
export function getAutoBackups(): AutoBackupEntry[] {
  try {
    const raw = localStorage.getItem(AUTO_BACKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Sort by timestamp descending if needed (newest first)
    const sorted = [...parsed].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    // Enforce strict limit of 5 and write back to localStorage if was > 5
    if (sorted.length > 5 || parsed.length > 5) {
      const trimmed = sorted.slice(0, 5);
      localStorage.setItem(AUTO_BACKUPS_KEY, JSON.stringify(trimmed));
      return trimmed;
    }

    return sorted;
  } catch (err) {
    console.error('Failed to parse auto backups:', err);
    return [];
  }
}

/**
 * Generates standard backup filename: Madeireira_Backup_YYYY-MM-DD_HHmm.json
 */
export function formatBackupFilename(date: Date = new Date()): string {
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const DD = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `Madeireira_Backup_${YYYY}-${MM}-${DD}_${hh}${mm}.json`;
}

/**
 * Produces a canonical string representation of database entities for reliable change detection
 */
function getCanonicalDatabaseString(db: KlabinDatabase): string {
  const clean = sanitizeDatabase(db);
  return JSON.stringify({
    appSettings: clean.appSettings,
    customLogo: clean.customLogo,
    Cargas: clean.Cargas,
    Depositos_Klabin: clean.Depositos_Klabin,
    Clientes: clean.Clientes,
    Vendas: clean.Vendas,
    Produtos: clean.Produtos,
    Motoristas: clean.Motoristas,
  });
}

/**
 * Minimum wall-clock gap between two auto-backups. Auto-backup serializes the
 * whole database several times (plus the up-to-5 backup array), so running it on
 * every single mutation froze the UI on large bases. Explicit callers that need
 * an immediate snapshot pass `force: true`.
 */
export const AUTO_BACKUP_MIN_INTERVAL_MS = 90_000;
let lastAutoBackupAt = 0;

/**
 * Saves a timestamped backup copy and maintains only the last 5 backups.
 * Throttled to at most one write per AUTO_BACKUP_MIN_INTERVAL_MS unless forced.
 * Prevents duplicate backups when state is identical to the latest backup.
 */
export function createAutoBackup(cleanData: KlabinDatabase, options: { force?: boolean } = {}): void {
  try {
    const nowMs = Date.now();
    if (!options.force && nowMs - lastAutoBackupAt < AUTO_BACKUP_MIN_INTERVAL_MS) {
      return;
    }
    lastAutoBackupAt = nowMs;

    const clean = sanitizeDatabase(cleanData);
    const currentBackups = getAutoBackups();
    const currentCanonical = getCanonicalDatabaseString(clean);

    // Avoid creating duplicate backup if most recent backup is identical
    if (currentBackups.length > 0) {
      const latestCanonical = getCanonicalDatabaseString(currentBackups[0].data);
      if (latestCanonical === currentCanonical) {
        return;
      }
    }

    const now = new Date();
    const filename = formatBackupFilename(now);
    const newEntry: AutoBackupEntry = {
      filename,
      timestamp: now.toISOString(),
      data: clean,
    };

    // Prepend new entry, remove any collision by same filename, keep strictly max 5
    const updatedBackups = [newEntry, ...currentBackups.filter((b) => b.filename !== filename)].slice(0, 5);

    localStorage.setItem(AUTO_BACKUPS_KEY, JSON.stringify(updatedBackups));
  } catch (error) {
    console.error('Failed to create automatic backup:', error);
  }
}

export interface BackupValidationResult {
  isValid: boolean;
  sanitizedDb?: KlabinDatabase;
  errorMessage?: string;
  warnings?: string[];
}

export function validateAndSanitizeBackupJSON(parsed: any): BackupValidationResult {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      isValid: false,
      errorMessage: 'O arquivo JSON importado não contém um objeto de dados válido.',
    };
  }

  const warnings: string[] = [];

  // Core entities check & fallback
  const coreEntities = ['Cargas', 'Depositos_Klabin', 'Clientes', 'Vendas', 'Produtos', 'Motoristas'];
  for (const entity of coreEntities) {
    if (!Array.isArray(parsed[entity])) {
      parsed[entity] = [];
      warnings.push(`Propriedade "${entity}" não encontrada. Inicializada como lista vazia [].`);
    }
  }

  const sanitizedDb = sanitizeDatabase(parsed);

  const initialCargasCount = parsed.Cargas.length;
  const cleanCargasCount = sanitizedDb.Cargas.length;
  if (initialCargasCount > cleanCargasCount) {
    warnings.push(`${initialCargasCount - cleanCargasCount} registro(s) fantasma/corrompido(s) de Cargas foram removido(s).`);
  }

  return {
    isValid: true,
    sanitizedDb,
    warnings,
  };
}

export function loadDatabase(): KlabinDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaultClean = sanitizeDatabase(initialKlabinData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultClean));
      return defaultClean;
    }
    const parsed = JSON.parse(raw);
    return sanitizeDatabase(parsed);
  } catch (error) {
    console.error('Failed to load database from localStorage:', error);
    return sanitizeDatabase(initialKlabinData);
  }
}

export function saveDatabase(
  data: KlabinDatabase,
  options: { createBackup?: boolean } = {}
): void {
  try {
    const clean = sanitizeDatabase(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    if (options.createBackup) {
      createAutoBackup(clean);
    }
  } catch (error) {
    console.error('Failed to save database to localStorage:', error);
  }
}

export function resetDatabaseToDefault(): KlabinDatabase {
  const defaultClean = sanitizeDatabase(initialKlabinData);
  saveDatabase(defaultClean, { createBackup: false });
  return defaultClean;
}

/**
 * Downloads the exact content and filename of a specific historical backup entry
 */
export function downloadBackupEntry(backup: AutoBackupEntry): void {
  const cleanExport = sanitizeDatabase(backup.data);
  const jsonStr = JSON.stringify(cleanExport, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backup.filename || formatBackupFilename(new Date(backup.timestamp));
  a.click();
  URL.revokeObjectURL(url);
}

export function exportDatabaseJSON(data: KlabinDatabase): void {
  // Clean & normalize core entities for JSON export with standard Madeireira filename
  const cleanExport = sanitizeDatabase(data);
  const jsonStr = JSON.stringify(cleanExport, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = formatBackupFilename(new Date());
  a.click();
  URL.revokeObjectURL(url);
}

export function generateCSVString<T extends Record<string, any>>(
  records: T[],
  columns: { key: keyof T; label: string }[]
): string {
  if (!records || records.length === 0) return '';

  const headers = columns.map((col) => `"${col.label}"`).join(',');
  const rows = records.map((record) => {
    return columns
      .map((col) => {
        const rawVal = record[col.key];
        const val = rawVal === undefined || rawVal === null ? '' : rawVal;
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      })
      .join(',');
  });

  return '\uFEFF' + [headers, ...rows].join('\n');
}

export function exportTableCSV<T extends Record<string, any>>(
  tableName: string,
  records: T[],
  columns: { key: keyof T; label: string }[]
): void {
  if (!records || records.length === 0) return;

  const csvContent = generateCSVString(records, columns);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Klabin_${tableName}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
