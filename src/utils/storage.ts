import { KlabinDatabase, AppSettings } from '../types';
import { initialKlabinData } from '../data/initialData';
import { normalizeIsoDate, normalizeIsoTimestamp } from './formatters';

const STORAGE_KEY = 'klabin_base_app_database_v1';
const AUTO_BACKUPS_KEY = 'klabin_base_app_auto_backups_v1';

export interface AutoBackupEntry {
  filename: string;
  timestamp: string;
  data: KlabinDatabase;
}

/**
 * Returns list of auto backups stored in localStorage (max 10, newest first)
 */
export function getAutoBackups(): AutoBackupEntry[] {
  try {
    const raw = localStorage.getItem(AUTO_BACKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse auto backups:', err);
    return [];
  }
}

/**
 * Saves a timestamped backup copy and maintains only the last 10 backups
 */
function createAutoBackup(cleanData: KlabinDatabase): void {
  try {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    const filename = `Klabin_Backup_${YYYY}-${MM}-${DD}_${hh}${mm}.json`;
    const newEntry: AutoBackupEntry = {
      filename,
      timestamp: now.toISOString(),
      data: cleanData,
    };

    const currentBackups = getAutoBackups();

    // Filter out if exact timestamp filename exists, or prepend new one
    const updatedBackups = [newEntry, ...currentBackups.filter((b) => b.filename !== filename)];

    // Keep max 10 backups
    const trimmedBackups = updatedBackups.slice(0, 10);

    localStorage.setItem(AUTO_BACKUPS_KEY, JSON.stringify(trimmedBackups));
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

/**
 * Sanitizes the database object by removing corrupt/phantom entries from Cargas, Depositos, Clientes, Vendas, Produtos
 */
export function sanitizeDatabase(rawDb: any): KlabinDatabase {
  if (!rawDb || typeof rawDb !== 'object') {
    return {
      Cargas: [],
      Depositos_Klabin: [],
      Clientes: [],
      Vendas: [],
      Produtos: [],
    };
  }

  // 1. Sanitize & Normalize Produtos first so we have the products lookup map
  const rawProdutos = Array.isArray(rawDb.Produtos) ? rawDb.Produtos : [];
  const cleanProdutos = rawProdutos.filter((p: any) => {
    if (!p || typeof p !== 'object') return false;
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    const price = Number(p.referencePrice);
    return Boolean(name) && !isNaN(price);
  });

  // Map product names to IDs for fast lookup
  const productNameToIdMap = new Map<string, string>();
  cleanProdutos.forEach((p: any) => {
    if (p.id && p.name) {
      productNameToIdMap.set(p.name.toLowerCase().trim(), p.id);
    }
  });

  // 2. Sanitize & Normalize Clientes
  const rawClientes = Array.isArray(rawDb.Clientes) ? rawDb.Clientes : [];
  const cleanClientes = rawClientes.filter((cli: any) => {
    if (!cli || typeof cli !== 'object') return false;
    const name = typeof cli.name === 'string' ? cli.name.trim() : '';
    return Boolean(name);
  });

  // Map client names to IDs for fast lookup
  const clientNameToIdMap = new Map<string, string>();
  cleanClientes.forEach((cli: any) => {
    if (cli.id && cli.name) {
      clientNameToIdMap.set(cli.name.toLowerCase().trim(), cli.id);
    }
  });

  // 2b. Sanitize & Normalize Motoristas
  const rawMotoristas = Array.isArray(rawDb.Motoristas) ? rawDb.Motoristas : [];
  const cleanMotoristas = rawMotoristas
    .filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      const name = typeof m.name === 'string' ? m.name.trim() : '';
      const licensePlate = typeof m.licensePlate === 'string' ? m.licensePlate.trim() : '';
      return Boolean(name) || Boolean(licensePlate);
    })
    .map((m: any) => ({
      ...m,
      name: (m.name || '').trim(),
      licensePlate: (m.licensePlate || '').trim().toUpperCase(),
      trailerPlate: m.trailerPlate ? String(m.trailerPlate).trim().toUpperCase() : undefined,
      phone: m.phone ? String(m.phone).trim() : undefined,
      status: m.status === 'INACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const),
      createdAt: normalizeIsoTimestamp(m.createdAt || new Date().toISOString()),
    }));

  // Map motorista plates and names to IDs
  const motoristaMap = new Map<string, string>();
  cleanMotoristas.forEach((m: any) => {
    if (m.id) {
      if (m.licensePlate) motoristaMap.set(m.licensePlate.toLowerCase(), m.id);
      if (m.name) motoristaMap.set(m.name.toLowerCase(), m.id);
    }
  });

  // 3. Sanitize & Normalize Cargas
  const rawCargas = Array.isArray(rawDb.Cargas) ? rawDb.Cargas : [];
  const cleanCargas = rawCargas
    .filter((c: any) => {
      if (!c || typeof c !== 'object') return false;
      const supplier = typeof c.supplier === 'string' ? c.supplier.trim() : '';
      const invoiceNumber = typeof c.invoiceNumber === 'string' ? c.invoiceNumber.trim() : '';
      const product = typeof c.product === 'string' ? c.product.trim() : '';
      const quantityTons = Number(c.quantityTons);
      const valuePerTon = Number(c.valuePerTon);

      if (!product) return false;
      if (isNaN(quantityTons) || quantityTons <= 0) return false;
      if (isNaN(valuePerTon) || valuePerTon <= 0) return false;

      // PURGE MOCK/TEST ENTRIES (e.g., "XXX", "00000", "00", "TEST", "TESTE")
      const supplierUpper = supplier ? supplier.toUpperCase() : '';
      const invoiceUpper = invoiceNumber.toUpperCase();

      const invalidInvoices = ['XXX', '00', '000', '0000', '00000', 'TEST', 'TESTE'];
      const invalidSuppliers = ['00', '0', '000', 'TEST', 'TESTE'];

      if (invoiceUpper && (invalidInvoices.includes(invoiceUpper) || /^0+$/.test(invoiceUpper))) return false;
      if (supplierUpper && (invalidSuppliers.includes(supplierUpper) || /^0+$/.test(supplierUpper))) return false;

      return true;
    })
    .map((c: any) => {
      // Convert deductFromBalance to normalized boolean
      const deductBool =
        c.deductFromBalance === true ||
        c.deductFromBalance === 'YES' ||
        c.deductFromBalance === 'SIM';

      // Convert freightPayable to normalized boolean
      const freightBool =
        c.freightPayable === true ||
        c.freightPayable === 'YES' ||
        c.freightPayable === 'SIM' ||
        c.freightPayable === undefined;

      // Standardize freightStatus enum
      const freightStatus = c.freightStatus === 'PAID' ? 'PAID' : 'PENDING';

      // Attach relational productId if available, or try name match with fallback aliases
      let productId = typeof c.productId === 'string' ? c.productId.trim() : '';
      if (!productId && c.product) {
        const pNorm = String(c.product).toLowerCase().trim();
        productId = productNameToIdMap.get(pNorm) || '';
        if (!productId) {
          if (pNorm.includes('eucalipto')) productId = productNameToIdMap.get('tora de eucalipto') || productNameToIdMap.get('eucalipto') || productNameToIdMap.get('tora eucalipto') || '';
          if (pNorm.includes('pinus')) productId = productNameToIdMap.get('tora de pinus') || productNameToIdMap.get('pinus taeda') || productNameToIdMap.get('pinus') || '';
          if (pNorm.includes('cavaco')) productId = productNameToIdMap.get('cavaco de madeira') || productNameToIdMap.get('cavaco') || '';
        }
      }

      // Freight cost fallback enforcement
      let freightCost = c.freightCost !== undefined && c.freightCost !== null ? Number(c.freightCost) : NaN;
      if (isNaN(freightCost)) {
        const qty = Number(c.quantityTons) || 0;
        freightCost = freightBool ? Number((qty * 15).toFixed(2)) : 0;
      }

      // Relational driverId resolution
      let driverId = typeof c.driverId === 'string' ? c.driverId.trim() : (typeof c.motoristaId === 'string' ? c.motoristaId.trim() : '');
      if (!driverId && (c.driverPlate || c.licensePlate)) {
        const plateNorm = (c.licensePlate || '').trim().toLowerCase();
        const driverNorm = (c.driverPlate || '').trim().toLowerCase();
        if (plateNorm && motoristaMap.has(plateNorm)) {
          driverId = motoristaMap.get(plateNorm)!;
        } else if (driverNorm && motoristaMap.has(driverNorm)) {
          driverId = motoristaMap.get(driverNorm)!;
        } else if (driverNorm) {
          cleanMotoristas.forEach((m: any) => {
            if (!driverId && m.id) {
              if (m.licensePlate && driverNorm.includes(m.licensePlate.toLowerCase())) driverId = m.id;
              if (!driverId && m.name && driverNorm.includes(m.name.toLowerCase())) driverId = m.id;
            }
          });
        }
      }

      // Normalize ISO dates
      const date = normalizeIsoDate(c.date);
      const createdAt = normalizeIsoTimestamp(c.createdAt || date);
      const freightPaidAt = c.freightPaidAt ? normalizeIsoTimestamp(c.freightPaidAt) : undefined;

      const cargaObj: any = {
        ...c,
        supplier: 'Klabin',
        date,
        deductFromBalance: deductBool ? true : false,
        freightPayable: freightBool ? true : false,
        freightCost,
        freightStatus,
        createdAt,
      };

      if (productId) cargaObj.productId = productId;
      else delete cargaObj.productId;

      if (driverId) {
        cargaObj.driverId = driverId;
        cargaObj.motoristaId = driverId;
      } else {
        delete cargaObj.driverId;
        delete cargaObj.motoristaId;
      }

      if (freightPaidAt) cargaObj.freightPaidAt = freightPaidAt;
      else delete cargaObj.freightPaidAt;

      return cargaObj;
    });

  // 4. Sanitize Depositos_Klabin
  const rawDepositos = Array.isArray(rawDb.Depositos_Klabin) ? rawDb.Depositos_Klabin : [];
  const cleanDepositos = rawDepositos
    .filter((d: any) => {
      if (!d || typeof d !== 'object') return false;
      const val = Number(d.value);
      return !isNaN(val) && val > 0 && Boolean(d.date);
    })
    .map((d: any) => {
      const date = normalizeIsoDate(d.date);
      const createdAt = normalizeIsoTimestamp(d.createdAt || date);

      return {
        ...d,
        date,
        createdAt,
      };
    });

  // 5. Sanitize & Normalize Vendas
  const rawVendas = Array.isArray(rawDb.Vendas) ? rawDb.Vendas : [];
  const cleanVendas = rawVendas
    .filter((v: any) => {
      if (!v || typeof v !== 'object') return false;
      const qty = Number(v.quantity);
      const clientName = typeof v.clientName === 'string' ? v.clientName.trim() : '';
      const clientId = typeof v.clientId === 'string' ? v.clientId.trim() : '';
      return !isNaN(qty) && qty > 0 && (Boolean(clientName) || Boolean(clientId));
    })
    .map((v: any) => {
      // Attach relational clientId if missing
      let clientId = typeof v.clientId === 'string' ? v.clientId.trim() : '';
      const clientName = typeof v.clientName === 'string' ? v.clientName.trim() : '';

      if (!clientId && clientName) {
        clientId = clientNameToIdMap.get(clientName.toLowerCase().trim()) || '';
      }

      // Attach relational productId if missing
      let productId = typeof v.productId === 'string' ? v.productId.trim() : '';
      const prodName = typeof v.product === 'string' ? v.product.trim() : '';
      if (!productId && prodName) {
        productId = productNameToIdMap.get(prodName.toLowerCase().trim()) || '';
      }

      // Standardize status enum ("PENDING" | "PAID" | "CANCELLED")
      let status: 'PENDING' | 'PAID' | 'CANCELLED' = 'PENDING';
      if (v.status === 'PAID') status = 'PAID';
      else if (v.status === 'CANCELLED') status = 'CANCELLED';

      const date = normalizeIsoDate(v.date);
      const createdAt = normalizeIsoTimestamp(v.createdAt || date);
      const paidAt = v.paidAt ? normalizeIsoTimestamp(v.paidAt) : undefined;

      return {
        ...v,
        date,
        clientId: clientId || undefined,
        productId: productId || undefined,
        status,
        paidAt,
        createdAt,
      };
    });

  const customLogo = typeof rawDb?.customLogo === 'string' && rawDb.customLogo.trim() ? rawDb.customLogo : undefined;

  const rawRate = Number(rawDb?.appSettings?.freightRatePerTon);
  const appSettings: AppSettings = {
    freightRatePerTon: !isNaN(rawRate) && rawRate > 0 ? rawRate : 15,
    companyName: typeof rawDb?.appSettings?.companyName === 'string' && rawDb.appSettings.companyName.trim()
      ? rawDb.appSettings.companyName.trim()
      : 'Madeireira Sol Nascente',
  };

  const finalMotoristas = cleanMotoristas.length > 0 
    ? cleanMotoristas 
    : (Array.isArray(initialKlabinData.Motoristas) ? initialKlabinData.Motoristas : []);

  return {
    customLogo,
    appSettings,
    Cargas: cleanCargas,
    Depositos_Klabin: cleanDepositos,
    Clientes: cleanClientes,
    Vendas: cleanVendas,
    Produtos: cleanProdutos,
    Motoristas: finalMotoristas,
  };
}

/**
 * Validates imported backup JSON schema and initializes missing entity arrays gracefully as []
 */
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
      saveDatabase(defaultClean);
      return defaultClean;
    }
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeDatabase(parsed);
    saveDatabase(sanitized);
    return sanitized;
  } catch (error) {
    console.error('Failed to load database from localStorage:', error);
    const fallback = sanitizeDatabase(initialKlabinData);
    return fallback;
  }
}

export function saveDatabase(data: KlabinDatabase): void {
  try {
    const clean = sanitizeDatabase(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    createAutoBackup(clean);
  } catch (error) {
    console.error('Failed to save database to localStorage:', error);
  }
}

export function resetDatabaseToDefault(): KlabinDatabase {
  const defaultClean = sanitizeDatabase(initialKlabinData);
  saveDatabase(defaultClean);
  return defaultClean;
}

export function exportDatabaseJSON(data: KlabinDatabase): void {
  // Clean & normalize core entities for JSON export
  const cleanExport = sanitizeDatabase(data);
  const jsonStr = JSON.stringify(cleanExport, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Klabin_Base_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTableCSV<T extends Record<string, any>>(
  tableName: string,
  records: T[],
  columns: { key: keyof T; label: string }[]
): void {
  if (!records || records.length === 0) return;

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

  const csvContent = '\uFEFF' + [headers, ...rows].join('\n'); // Add BOM for Excel UTF-8
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Klabin_${tableName}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
