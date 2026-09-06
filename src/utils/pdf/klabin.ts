import autoTable from 'jspdf-autotable';
import { AppSettings, CargaRecord, DepositoKlabinRecord } from '../../types';
import { sortByDateDescending } from '../dateSorting';
import { formatBRL, formatDate } from '../formatters';
import { calcKlabinBalance, isDeductedFromBalance } from '../klabinBalance';
import { PDF_BRAND, PDF_LAYOUT, drawFittedText, getBrandTableStyles, getPdfFontFamily } from '../pdfVisualStyle';

import { createBasePdfDocument, extractCompanyInfo, finalizePdfAndDownload, renderStandardHeader } from './base';
// ============================================================================
// 2. PDF DE EXTRATO DO SALDO KLABIN
// ============================================================================
export interface GenerateKlabinStatementPdfParams {
  depositos: DepositoKlabinRecord[];
  cargas: CargaRecord[];
  appSettings?: AppSettings;
  customLogo?: string;
}

export function generateKlabinStatementPdf({
  depositos,
  cargas,
  appSettings,
  customLogo,
}: GenerateKlabinStatementPdfParams): boolean {
  const companyInfo = extractCompanyInfo(appSettings, customLogo);
  const doc = createBasePdfDocument();
  const pageWidth = doc.internal.pageSize.getWidth();

  const headerEndY = renderStandardHeader(
    doc,
    'EXTRATO DO SALDO KLABIN',
    companyInfo
  );

  // 1. Calculate Totals (shared with the application via calcKlabinBalance)
  const eligibleCargas = (cargas || []).filter(isDeductedFromBalance);

  const { totalDepositos, totalAbatido, saldo: saldoLivre } = calcKlabinBalance({
    cargas: cargas || [],
    depositos: depositos || [],
  });

  // 2. Summary Box
  const family = getPdfFontFamily(doc);
  const summaryBoxY = headerEndY;
  const summaryLeft = PDF_LAYOUT.margin;
  const summaryBoxWidth = pageWidth - PDF_LAYOUT.margin * 2;
  const summaryBoxHeight = 20;

  doc.setFillColor(PDF_BRAND.light);
  doc.setDrawColor(PDF_BRAND.line);
  doc.roundedRect(summaryLeft, summaryBoxY, summaryBoxWidth, summaryBoxHeight, 1.5, 1.5, 'FD');

  const colWidth = summaryBoxWidth / 3;
  const colPadding = 6;
  const colTextWidth = colWidth - colPadding * 2;

  const summaryColumns = [
    {
      label: 'TOTAL DEPOSITADO',
      value: formatBRL(totalDepositos),
      labelColor: PDF_BRAND.muted,
      valueColor: PDF_BRAND.graphite,
      emphasis: false,
    },
    {
      label: 'TOTAL ABATIDO',
      value: formatBRL(totalAbatido),
      labelColor: PDF_BRAND.muted,
      valueColor: PDF_BRAND.graphite,
      emphasis: false,
    },
    {
      label: 'SALDO LIVRE KLABIN',
      value: formatBRL(saldoLivre),
      labelColor: PDF_BRAND.brown,
      valueColor: saldoLivre >= 0 ? PDF_BRAND.orangeDark : PDF_BRAND.danger,
      emphasis: true,
    },
  ];

  summaryColumns.forEach((column, index) => {
    const x = summaryLeft + colWidth * index + colPadding;

    doc.setFont(family, column.emphasis ? 'bold' : 'normal');
    doc.setTextColor(column.labelColor);
    drawFittedText(doc, column.label, x, summaryBoxY + 6.5, {
      maxWidth: colTextWidth,
      baseSize: 8,
      minSize: 6.5,
      maxLines: 1,
    });

    doc.setFont(family, 'bold');
    doc.setTextColor(column.valueColor);
    drawFittedText(doc, column.value, x, summaryBoxY + 14.5, {
      maxWidth: colTextWidth,
      baseSize: 11,
      minSize: 8.5,
      maxLines: 1,
    });
  });

  // 3. Build Movements (Chronological: oldest -> newest)
  interface MovementItem {
    date: string;
    movimento: 'Depósito' | 'Carga';
    descricao: string;
    entrada: number | null;
    saida: number | null;
  }

  const movements: MovementItem[] = [];

  (depositos || []).forEach((d) => {
    movements.push({
      date: d.date || '',
      movimento: 'Depósito',
      descricao: d.notes?.trim() || 'Depósito Klabin',
      entrada: Number(d.value) || 0,
      saida: null,
    });
  });

  eligibleCargas.forEach((c) => {
    movements.push({
      date: c.date || '',
      movimento: 'Carga',
      descricao: c.product?.trim() || 'Eucalipto',
      entrada: null,
      saida: Number(c.totalValue) || 0,
    });
  });

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
  const filename = `Extrato_Klabin_${todayIso}.pdf`;

  finalizePdfAndDownload(doc, filename, companyInfo.name);
  return true;
}

