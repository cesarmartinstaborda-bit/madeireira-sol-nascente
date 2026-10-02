import autoTable from 'jspdf-autotable';
import { AppSettings, CargaRecord, DepositoKlabinRecord } from '../../types';
import { sortByDateDescending } from '../dateSorting';
import { formatBRL, formatDate } from '../formatters';
import { calcKlabinBalance, isDeductedFromBalance } from '../klabinBalance';
import { PDF_BRAND, PDF_LAYOUT, getBrandTableStyles, getPdfFontFamily } from '../pdfVisualStyle';

import { createBasePdfDocument, extractCompanyInfo, finalizePdfAndDownload, renderStandardHeader } from './base';
// ============================================================================
// 2. PDF DE EXTRATO DO SALDO KLABIN
// ============================================================================
export interface GenerateKlabinStatementPdfParams {
  depositos: DepositoKlabinRecord[];
  cargas: CargaRecord[];
  appSettings?: AppSettings;
  customLogo?: string;
  /** Human-readable competency (e.g. "Agosto de 2026") — appends to the title for a per-month Histórico PDF. */
  periodLabel?: string;
  /** Competency key (YYYY-MM) — used to make the filename specific to that month. */
  periodKey?: string;
}

export function generateKlabinStatementPdf({
  depositos,
  cargas,
  appSettings,
  customLogo,
  periodLabel,
  periodKey,
}: GenerateKlabinStatementPdfParams): boolean {
  const companyInfo = extractCompanyInfo(appSettings, customLogo);
  const doc = createBasePdfDocument();
  const pageWidth = doc.internal.pageSize.getWidth();

  const headerEndY = renderStandardHeader(
    doc,
    periodLabel ? `EXTRATO DO SALDO KLABIN — ${periodLabel.toUpperCase()}` : 'EXTRATO DO SALDO KLABIN',
    companyInfo
  );

  // 1. Calculate Totals (shared with the application via calcKlabinBalance).
  // Depósitos still feed the balance here — they just never get their own visual
  // row: this PDF is scoped to cargas only, per product decision.
  const eligibleCargas = (cargas || []).filter(isDeductedFromBalance);

  const { saldo: saldoLivre } = calcKlabinBalance({
    cargas: cargas || [],
    depositos: depositos || [],
  });

  // 2. Summary Box — single "Saldo Livre Klabin" panel (no deposit breakdown).
  const family = getPdfFontFamily(doc);
  const summaryBoxY = headerEndY;
  const summaryLeft = PDF_LAYOUT.margin;
  const summaryBoxWidth = pageWidth - PDF_LAYOUT.margin * 2;
  const summaryBoxHeight = 20;
  const summaryBoxCenterX = summaryLeft + summaryBoxWidth / 2;
  const saldoValueColor = saldoLivre >= 0 ? PDF_BRAND.orangeDark : PDF_BRAND.danger;

  doc.setFillColor(PDF_BRAND.light);
  doc.setDrawColor(PDF_BRAND.line);
  doc.roundedRect(summaryLeft, summaryBoxY, summaryBoxWidth, summaryBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont(family, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(PDF_BRAND.brown);
  doc.text('SALDO LIVRE KLABIN', summaryBoxCenterX, summaryBoxY + 8, { align: 'center' });

  doc.setFont(family, 'bold');
  doc.setFontSize(15);
  doc.setTextColor(saldoValueColor);
  doc.text(formatBRL(saldoLivre), summaryBoxCenterX, summaryBoxY + 16, { align: 'center' });

  // 3. Build Movements (Chronological: oldest -> newest) — cargas only. Depósitos
  // are intentionally never pushed here: they must not appear anywhere in this PDF.
  interface MovementItem {
    date: string;
    movimento: 'Carga';
    descricao: string;
    entrada: null;
    saida: number | null;
  }

  const movements: MovementItem[] = eligibleCargas.map((c) => ({
    date: c.date || '',
    movimento: 'Carga',
    descricao: c.product?.trim() || 'Eucalipto',
    entrada: null,
    saida: Number(c.totalValue) || 0,
  }));

  // Newest first, consistent with every dated listing in the app. A raw string
  // compare only happened to work for ISO dates and silently misordered any
  // legacy DD/MM/YYYY value; the shared util understands both.
  const orderedMovements = sortByDateDescending(movements, (movement) => movement.date);

  const tableHead = [
    ['Data', 'Movimento', 'Descrição', 'Entrada', 'Saída'],
  ];

  const tableBody = orderedMovements.map((m) => [
    formatDate(m.date),
    m.movimento,
    m.descricao,
    m.entrada !== null ? formatBRL(m.entrada) : '-',
    m.saida !== null ? formatBRL(m.saida) : '-',
  ]);

  const tableFoot = [
    ['SALDO LIVRE KLABIN', '', '', '', formatBRL(saldoLivre)],
  ];

  autoTable(doc, {
    startY: summaryBoxY + summaryBoxHeight + 6,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    ...getBrandTableStyles(doc, 9),
    columnStyles: {
      0: { halign: 'center', cellWidth: 26 }, // Data
      1: { halign: 'center', cellWidth: 26 }, // Movimento
      2: { halign: 'left' },                  // Descrição
      3: { halign: 'right', cellWidth: 30 },  // Entrada
      // Carries the closing balance in the footer, so it needs the extra room.
      4: { halign: 'right', cellWidth: 36 },  // Saída
    },
    didParseCell: (data) => {
      if (data.section === 'foot') {
        if (data.column.index === 0) {
          data.cell.colSpan = 4;
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 4) {
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = saldoLivre >= 0 ? PDF_BRAND.orangeDark : PDF_BRAND.danger;
        }
      }
    },
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const filename = periodKey ? `Extrato_Klabin_${periodKey}.pdf` : `Extrato_Klabin_${todayIso}.pdf`;

  finalizePdfAndDownload(doc, filename, companyInfo.name);
  return true;
}

