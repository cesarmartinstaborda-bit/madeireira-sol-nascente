import autoTable from 'jspdf-autotable';
import { AppSettings, VendaRecord } from '../../types';
import { sortByDateDescending } from '../dateSorting';
import { formatBRL, formatDate, formatNumber } from '../formatters';
import { PDF_BRAND, getBrandTableStyles } from '../pdfVisualStyle';

import { createBasePdfDocument, extractCompanyInfo, finalizePdfAndDownload, renderStandardHeader, sanitizePdfFilename } from './base';
// ============================================================================
// 1. PDF DE VALORES PENDENTES POR CLIENTE
// ============================================================================
export interface GenerateClientPendingPdfParams {
  client: { id?: string; name: string };
  vendas: VendaRecord[];
  appSettings?: AppSettings;
  customLogo?: string;
}

export function generateClientPendingPdf({
  client,
  vendas,
  appSettings,
  customLogo,
}: GenerateClientPendingPdfParams): boolean {
  const clientName = (client.name || '').trim() || 'Cliente';
  const clientId = client.id;

  // Filter strictly PENDING sales for this client
  const clientPendingVendas = (vendas || []).filter((v) => {
    if (v.status !== 'PENDING') return false;
    if (clientId && v.clientId) {
      return v.clientId === clientId;
    }
    // Fallback by exact normalized client name
    return (v.clientName || '').trim().toLowerCase() === clientName.toLowerCase();
  });

  if (clientPendingVendas.length === 0) {
    return false; // Indicating no pending sales found
  }

  // Newest first, matching every dated listing on screen. The caller hands us
  // the raw `vendas` array, so the PDF has to order it itself.
  const orderedVendas = sortByDateDescending(
    clientPendingVendas,
    (venda) => venda.date,
    (venda) => venda.createdAt
  );

  const companyInfo = extractCompanyInfo(appSettings, customLogo);
  const doc = createBasePdfDocument();

  const startY = renderStandardHeader(
    doc,
    'DEMONSTRATIVO DE VALORES PENDENTES',
    companyInfo,
    [{ label: 'Cliente', value: clientName }]
  );

  const totalAmount = orderedVendas.reduce(
    (acc, v) => acc + (Number(v.totalValue) || 0),
    0
  );

  // Table columns: Data | Produto | Quantidade | Preço Unitário | Valor Total
  const tableHead = [
    ['Data', 'Produto', 'Quantidade', 'Preço Unitário', 'Valor Total'],
  ];

  const tableBody = orderedVendas.map((v) => {
    const qtdFormatted = `${formatNumber(v.quantity, 2)} ${v.unitOfMeasure || 'ton'}`;
    return [
      formatDate(v.date),
      v.product || 'Madeira',
      qtdFormatted,
      formatBRL(v.unitPrice),
      formatBRL(v.totalValue),
    ];
  });

  const tableFoot = [
    ['TOTAL A RECEBER', '', '', '', formatBRL(totalAmount)],
  ];

  autoTable(doc, {
    startY,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    ...getBrandTableStyles(doc, 9.5),
    columnStyles: {
      // The four numeric columns are pinned tightly so "Produto" keeps roughly
      // 62mm instead of the ~45mm that forced product names to wrap.
      0: { halign: 'left', cellWidth: 24 },   // Data
      1: { halign: 'left' },                  // Produto
      2: { halign: 'right', cellWidth: 27 },  // Quantidade
      3: { halign: 'right', cellWidth: 27 },  // Preço Unitário
      // Wide enough for the bold grand total in the footer, not just the rows.
      4: { halign: 'right', cellWidth: 38 },  // Valor Total
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
          data.cell.styles.textColor = PDF_BRAND.orangeDark;
        }
      }
    },
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const sanitizedClient = sanitizePdfFilename(clientName);
  const filename = `Pendencias_${sanitizedClient}_${todayIso}.pdf`;

  finalizePdfAndDownload(doc, filename, companyInfo.name);
  return true;
}

