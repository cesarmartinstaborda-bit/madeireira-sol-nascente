// Utility functions for formatting numbers, currency (BRL), dates, CNPJ, license plates

export function formatCurrency(value: number | undefined | null): string {
  return formatBRL(value);
}

/**
 * Converts user-entered Brazilian currency to a plain number.
 * Brazilian input uses dots for thousands and a comma for decimals. A lone
 * dot is accepted as a decimal separator only when it is not valid thousands
 * grouping, which also keeps compatibility with numeric values stringified by
 * older versions of the application.
 */
export function parseBRLCurrency(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value === null || value === undefined) return NaN;

  const normalized = String(value)
    .trim()
    .replace(/R\$/gi, '')
    .replace(/\s/g, '');

  if (!normalized) return NaN;

  const sign = normalized.startsWith('-') ? '-' : '';
  const unsigned = normalized.replace(/^[+-]/, '');
  if (!/^\d[\d.,]*$/.test(unsigned)) return NaN;

  let numericText: string;
  if (unsigned.includes(',')) {
    if ((unsigned.match(/,/g) || []).length !== 1) return NaN;
    const [integerPart, decimalPart] = unsigned.split(',');
    if (decimalPart.length > 2 || !/^\d*$/.test(decimalPart)) return NaN;
    if (integerPart.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(integerPart)) return NaN;
    numericText = `${integerPart.replace(/\./g, '')}.${decimalPart || '0'}`;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) {
    numericText = unsigned.replace(/\./g, '');
  } else {
    if ((unsigned.match(/\./g) || []).length > 1) return NaN;
    numericText = unsigned;
  }

  const parsed = Number(`${sign}${numericText}`);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Formats a stored numeric value for editing in a pt-BR currency input. */
export function formatBRLCurrencyInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(Number(value));
}

export const formatDateBR = formatDate;

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

export function maskCNPJ(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
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

export const MONTH_NAMES_BR = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Checks if a given date string or Date belongs to any locked month (format: YYYY-MM)
 * Ignores time of day (2026-08-01 00:01 and 2026-08-31 23:59 both match 2026-08).
 */
export function isMonthLocked(dateVal?: string | Date | null, lockedMonths?: string[]): boolean {
  if (!dateVal || !Array.isArray(lockedMonths) || lockedMonths.length === 0) {
    return false;
  }
  const iso = normalizeIsoDate(dateVal); // e.g. "2026-08-15"
  if (iso.length < 7) return false;
  const monthKey = iso.slice(0, 7); // e.g. "2026-08"
  return lockedMonths.includes(monthKey);
}

/**
 * Formats a YYYY-MM key into human-readable Portuguese representation (e.g. "2026-08" -> "Agosto de 2026")
 */
export function formatMonthYearBR(monthYearKey: string): string {
  if (!monthYearKey || typeof monthYearKey !== 'string') return '-';
  const parts = monthYearKey.split('-');
  if (parts.length < 2) return monthYearKey;
  const year = parts[0];
  const monthIndex = parseInt(parts[1], 10) - 1;
  if (monthIndex >= 0 && monthIndex < MONTH_NAMES_BR.length) {
    return `${MONTH_NAMES_BR[monthIndex]} de ${year}`;
  }
  return monthYearKey;
}

/**
 * Formats a full ISO timestamp string into human-readable Brazilian date & time (DD/MM/YYYY às HH:mm)
 */
export function formatDateTimeBR(isoString?: string | null): string {
  if (!isoString) return 'Ainda não sincronizado';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Ainda não sincronizado';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return 'Ainda não sincronizado';
  }
}
