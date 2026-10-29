import { MaoDeObraClienteRecord, MaoDeObraLancamentoRecord, MaoDeObraProdutoRecord } from '../types';
import { formatBRL, normalizeIsoDate, normalizeIsoTimestamp } from './formatters';

function toNullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toNullableTimestamp(value: unknown): string | null {
  return toNullableText(value) ? normalizeIsoTimestamp(String(value)) : null;
}

const isRecordWithId = (r: any): boolean =>
  Boolean(r) && typeof r === 'object' && typeof r.id === 'string' && Boolean(r.id.trim());

/** Normaliza lançamentos salvos por qualquer versão; campos ausentes viram `null`. */
export function sanitizeMaoDeObraLancamentos(raw: unknown): MaoDeObraLancamentoRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecordWithId).map((r: any) => {
    const status = r.status === 'PAID' ? 'PAID' : 'PENDING';
    const totalValue = toNullableNumber(r.totalValue);
    return {
      ...r,
      id: r.id.trim(),
      clientId: toNullableText(r.clientId),
      clientName: toNullableText(r.clientName),
      productId: toNullableText(r.productId),
      productName: toNullableText(r.productName),
      date: toNullableText(r.date) ? normalizeIsoDate(r.date) : null,
      quantityTons: toNullableNumber(r.quantityTons),
      pricePerTon: toNullableNumber(r.pricePerTon),
      totalValue,
      totalValueManual: totalValue !== null && r.totalValueManual === true,
      status,
      paidAt: status === 'PAID' ? toNullableTimestamp(r.paidAt) : null,
      createdAt: toNullableTimestamp(r.createdAt),
    };
  });
}

export function sanitizeMaoDeObraClientes(raw: unknown): MaoDeObraClienteRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r: any) => isRecordWithId(r) && toNullableText(r.name))
    .map((r: any) => ({ ...r, id: r.id.trim(), name: r.name.trim(), createdAt: toNullableTimestamp(r.createdAt) }));
}

export function sanitizeMaoDeObraProdutos(raw: unknown): MaoDeObraProdutoRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r: any) => isRecordWithId(r) && toNullableText(r.name))
    .map((r: any) => ({
      ...r,
      id: r.id.trim(),
      name: r.name.trim(),
      pricePerTon: toNullableNumber(r.pricePerTon),
      createdAt: toNullableTimestamp(r.createdAt),
    }));
}

/** Toneladas × preço por tonelada, ou `null` quando falta um dos dois. */
export function calcMaoDeObraTotal(quantityTons: number | null, pricePerTon: number | null): number | null {
  if (quantityTons === null || pricePerTon === null) return null;
  return Math.round(quantityTons * pricePerTon * 100) / 100;
}

/**
 * Lê um número digitado no padrão brasileiro ("12", "12,5", "1.234,567", "1.500").
 * Ponto em grupos de três dígitos é milhar, como no campo de valor; vazio = `null`;
 * texto inválido ou negativo = `NaN`.
 */
export function parseDecimalBR(text: string): number | null {
  const clean = text.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!clean) return null;
  if (!/^\d[\d.,]*$/.test(clean)) return NaN;
  const normalized = clean.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(clean)
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  if ((normalized.match(/\./g) || []).length > 1) return NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Formata para edição em campo de texto, sem milhar, para reler exatamente o mesmo número. */
export function formatDecimalInput(value: number | null, maxDecimals = 2): string {
  if (value === null) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
    useGrouping: false,
  }).format(value);
}

export function formatTons(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value);
}

/** Valor ausente aparece como travessão, nunca como R$ 0,00. */
export function formatOptionalBRL(value: number | null): string {
  return value === null ? '—' : formatBRL(value);
}

export function splitMaoDeObraLancamentos(records: MaoDeObraLancamentoRecord[]) {
  return {
    pending: records.filter((r) => r.status !== 'PAID'),
    paid: records.filter((r) => r.status === 'PAID'),
  };
}

/** Totais de uma lista: toneladas somam o que foi informado; valor soma só os conhecidos. */
export function sumMaoDeObra(records: MaoDeObraLancamentoRecord[]) {
  let tons = 0;
  let value = 0;
  let withoutValue = 0;
  for (const r of records) {
    if (r.quantityTons !== null) tons += r.quantityTons;
    if (r.totalValue !== null) value += r.totalValue;
    else withoutValue += 1;
  }
  return {
    tons: Math.round(tons * 1000) / 1000,
    value: Math.round(value * 100) / 100,
    withoutValue,
  };
}
