// Utility functions for formatting numbers, currency (BRL), dates, CNPJ, license plates

export function formatBRL(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  // If string contains ISO time or 'T', extract the YYYY-MM-DD part first
  const cleanDateStr = dateString.split('T')[0];
  // Handle YYYY-MM-DD
  const parts = cleanDateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year.length === 4) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }
  // Handle DD/MM/YYYY
  const slashParts = cleanDateStr.split('/');
  if (slashParts.length === 3) {
    return dateString;
  }
  return dateString;
}

/**
 * Normalizes any date value to ISO 8601 format (YYYY-MM-DD).
 * Converts legacy DD/MM/YYYY or timestamp strings to strict YYYY-MM-DD.
 */
export function normalizeIsoDate(dateVal?: string | Date | null): string {
  if (!dateVal) return new Date().toISOString().slice(0, 10);

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return new Date().toISOString().slice(0, 10);
    return dateVal.toISOString().slice(0, 10);
  }

  const str = String(dateVal).trim();
  if (!str) return new Date().toISOString().slice(0, 10);

  // If already YYYY-MM-DD or ISO timestamp starting with YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  // Handle DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [day, month, year] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try parsing with Date constructor
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Normalizes a full ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ) for createdAt/paidAt fields.
 */
export function normalizeIsoTimestamp(dateVal?: string | Date | null): string {
  if (!dateVal) return new Date().toISOString();

  if (dateVal instanceof Date) {
    return dateVal.toISOString();
  }

  const str = String(dateVal).trim();
  if (!str) return new Date().toISOString();

  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str;
  }

  const normalizedDate = normalizeIsoDate(str);
  return `${normalizedDate}T00:00:00.000Z`;
}

/**
 * Checks if notes field contains keywords suggesting payment
 */
export function hasPaymentKeywordsInNotes(notes?: string): boolean {
  if (!notes || typeof notes !== 'string') return false;
  const paymentRegex = /\b(pago|quitado|pix|comprovante|paga|liquidado|recibo|transferido)\b/i;
  return paymentRegex.test(notes);
}

export function formatCNPJ(cnpj: string): string {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj; // Return as is if incomplete
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function formatLicensePlate(plate: string): string {
  if (!plate) return '';
  const cleaned = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleaned.length === 7) {
    // ABC1D23 (Mercosul) or ABC1234 (Old)
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  return plate.toUpperCase();
}
