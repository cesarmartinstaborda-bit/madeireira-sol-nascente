import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KlabinDatabase } from '../types';
import { formatBRL, formatNumber, formatDate } from './formatters';
import {
  createBasePdfDocument,
  renderStandardHeader,
  extractCompanyInfo,
  sanitizePdfFilename,
} from './pdfGenerator';
import {
  PDF_BRAND,
  PDF_LAYOUT,
  brandSeparator,
  drawFittedText,
  emptyCellMark,
  getBrandTableStyles,
  getPdfFontFamily,
  renderBrandFooter,
} from './pdfVisualStyle';
import { sortByDateDescending } from './dateSorting';
import { calcKlabinBalance } from './klabinBalance';
import { getPendingFreightTotal, getPaidFreightTotal } from './freightUtils';

const SECTION_TITLE_COLOR = PDF_BRAND.brown;
const PAGE_MARGIN = PDF_LAYOUT.margin;

function renderKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  valueColor: string
) {
  const family = getPdfFontFamily(doc);
  const textWidth = width - 8;

  doc.setFillColor(PDF_BRAND.light);
  doc.setDrawColor(PDF_BRAND.line);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

  // Both strings are width-bound: jsPDF's own maxWidth wraps instead of
  // shrinking, which pushed long currency values out through the card floor.
  doc.setFont(family, 'normal');
  doc.setTextColor(PDF_BRAND.muted);
  drawFittedText(doc, label, x + 4, y + 6.5, {
    maxWidth: textWidth,
    baseSize: 7.5,
    minSize: 6.2,
    maxLines: 1,
  });

  doc.setFont(family, 'bold');
  doc.setTextColor(valueColor);
  drawFittedText(doc, value, x + 4, y + 14.5, {
    maxWidth: textWidth,
    baseSize: 10.5,
    minSize: 8,
    maxLines: 1,
  });
}

/** Keeps a block from being orphaned at the foot of a page. */
function ensureSpace(doc: jsPDF, y: number, minSpace: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + minSpace > pageHeight - 16) {
    doc.addPage();
    return 15;
  }
  return y;
}

function renderSection(
  doc: jsPDF,
  startY: number,
  title: string,
  head: string[],
  body: (string | number)[][],
  columnStyles?: Record<number, any>
): number {
  const family = getPdfFontFamily(doc);
  // Reserve the title plus the table head and a couple of rows, so a heading
  // never sits alone at the bottom with its table on the next page.
  let y = ensureSpace(doc, startY, 36);

  doc.setFont(family, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(SECTION_TITLE_COLOR);
  doc.text(title, PAGE_MARGIN, y);
  y += 4;

  if (body.length === 0) {
    doc.setFont(family, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(PDF_BRAND.muted);
    doc.text('Nenhum registro cadastrado.', PAGE_MARGIN, y + 4);
    return y + 12;
  }

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    ...getBrandTableStyles(doc, 8.5),
    columnStyles,
  });

  return (doc as any).lastAutoTable.finalY + 10;
}

/**
 * Generates a single consolidated PDF report covering the executive summary
 * (KPIs) and every operational table in the database, organized by section.
 * Returns the PDF as a Blob (for direct Google Drive upload) plus a
 * suggested filename — it does not trigger a local download.
 */
export function generateConsolidatedReportPdf(database: KlabinDatabase): {
  blob: Blob;
  filename: string;
} {
  const companyInfo = extractCompanyInfo(database.appSettings, database.customLogo);
  const doc = createBasePdfDocument();
  const family = getPdfFontFamily(doc);
  const emptyMark = emptyCellMark(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = renderStandardHeader(doc, 'RELATÓRIO CONSOLIDADO DO SISTEMA', companyInfo);

  // ==========================================================================
  // RESUMO EXECUTIVO (KPIs)
  // ==========================================================================
  const cargas = database.Cargas || [];
  const depositos = database.Depositos_Klabin || [];
  const motoristas = database.Motoristas || [];
  const clientes = database.Clientes || [];
  const vendas = database.Vendas || [];
  const produtos = database.Produtos || [];

  // Every dated section is listed newest first, matching the on-screen tables.
  // Catalogues without a business date fall back to their registration date,
  // and drivers — which have neither — are listed alphabetically.
  const cargasOrdenadas = sortByDateDescending(cargas, (carga) => carga.date);
  const depositosOrdenados = sortByDateDescending(depositos, (d) => d.date);
  const vendasOrdenadas = sortByDateDescending(vendas, (venda) => venda.date, (venda) => venda.createdAt);
  const clientesOrdenados = sortByDateDescending(clientes, (cliente) => cliente.createdAt);
  const produtosOrdenados = sortByDateDescending(produtos, (produto) => produto.createdAt);
  const motoristasOrdenados = [...motoristas].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'pt-BR')
  );

  const { totalDepositos, totalAbatido, saldo: saldoLivre } = calcKlabinBalance({
    cargas,
    depositos,
  });
  const totalVolumeTons = cargas.reduce((acc, c) => acc + (Number(c.quantityTons) || 0), 0);
  const totalFretesPending = getPendingFreightTotal(database);
  const totalFretesPaid = getPaidFreightTotal(database);
  const totalVendasVal = vendas.reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
  const totalVendasRecebidas = vendas
    .filter((v) => v.status === 'PAID')
    .reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);
  const totalVendasPendentes = totalVendasVal - totalVendasRecebidas;

  doc.setFont(family, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(PDF_BRAND.graphite);
  doc.text('RESUMO EXECUTIVO', PAGE_MARGIN, y);
  y += 5;

  const kpis: { label: string; value: string; color: string }[] = [
    { label: 'SALDO LIVRE KLABIN', value: formatBRL(saldoLivre), color: saldoLivre >= 0 ? PDF_BRAND.orangeDark : PDF_BRAND.danger },
    { label: 'TOTAL DEPOSITADO', value: formatBRL(totalDepositos), color: PDF_BRAND.graphite },
    { label: 'TOTAL ABATIDO', value: formatBRL(totalAbatido), color: PDF_BRAND.graphite },
    { label: 'VOLUME FLORESTAL', value: `${formatNumber(totalVolumeTons, 2)} Ton`, color: PDF_BRAND.graphite },
    { label: 'FRETES A PAGAR', value: formatBRL(totalFretesPending), color: PDF_BRAND.danger },
    { label: 'FRETES PAGOS', value: formatBRL(totalFretesPaid), color: PDF_BRAND.graphite },
    { label: 'VENDAS TOTAIS', value: formatBRL(totalVendasVal), color: PDF_BRAND.graphite },
    { label: 'VENDAS PENDENTES', value: formatBRL(totalVendasPendentes), color: PDF_BRAND.orangeDark },
  ];

  const cardsPerRow = 4;
  const gap = 3;
  const cardWidth = (pageWidth - PAGE_MARGIN * 2 - gap * (cardsPerRow - 1)) / cardsPerRow;
  const cardHeight = 19;

  kpis.forEach((kpi, idx) => {
    const col = idx % cardsPerRow;
    const row = Math.floor(idx / cardsPerRow);
    const x = PAGE_MARGIN + col * (cardWidth + gap);
    const cardY = y + row * (cardHeight + gap);
    renderKpiCard(doc, x, cardY, cardWidth, cardHeight, kpi.label, kpi.value, kpi.color);
  });

  const rows = Math.ceil(kpis.length / cardsPerRow);
  y += rows * (cardHeight + gap) + 3;

  doc.setFont(family, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(PDF_BRAND.muted);
  const sep = `  ${brandSeparator(doc)}  `;
  drawFittedText(
    doc,
    [
      `${cargas.length} cargas`,
      `${depositos.length} depósitos`,
      `${motoristas.length} motoristas`,
      `${clientes.length} clientes`,
      `${vendas.length} vendas`,
      `${produtos.length} produtos`,
    ].join(sep),
    PAGE_MARGIN,
    y,
    { maxWidth: pageWidth - PAGE_MARGIN * 2, baseSize: 8, minSize: 6.5, maxLines: 1 }
  );
  y += 8;

  // ==========================================================================
  // TABELAS OPERACIONAIS
  // ==========================================================================
  y = renderSection(
    doc,
    y,
    'CARGAS (KLABIN)',
    ['Data', 'Fornecedor', 'Produto', 'Qtd (Ton)', 'Valor Total', 'Frete'],
    cargasOrdenadas.map((c) => [
      formatDate(c.date),
      c.supplier || emptyMark,
      c.product || emptyMark,
      formatNumber(c.quantityTons, 2),
      formatBRL(c.totalValue),
      c.freightStatus === 'PAID' ? 'Pago' : c.freightStatus === 'PENDING' ? 'Pendente' : emptyMark,
    ]),
    { 3: { halign: 'right' }, 4: { halign: 'right' } }
  );

  y = renderSection(
    doc,
    y,
    'DEPÓSITOS KLABIN',
    ['Data', 'Valor', 'Observações'],
    depositosOrdenados.map((d) => [formatDate(d.date), formatBRL(d.value), d.notes || emptyMark]),
    { 1: { halign: 'right', cellWidth: 32 } }
  );

  y = renderSection(
    doc,
    y,
    'MOTORISTAS',
    ['Nome', 'Placa', 'Telefone', 'Status'],
    motoristasOrdenados.map((m) => [
      m.name || emptyMark,
      m.licensePlate || emptyMark,
      m.phone || emptyMark,
      m.status === 'INACTIVE' ? 'Inativo' : 'Ativo',
    ])
  );

  y = renderSection(
    doc,
    y,
    'CLIENTES',
    ['Nome', 'Contato', 'Cadastrado em'],
    clientesOrdenados.map((c) => [
      c.name || emptyMark,
      c.contact || emptyMark,
      c.createdAt ? formatDate(c.createdAt) : emptyMark,
    ]),
    { 2: { halign: 'center', cellWidth: 30 } }
  );

  y = renderSection(
    doc,
    y,
    'VENDAS',
    ['Data', 'Cliente', 'Produto', 'Qtd', 'Valor Total', 'Status'],
    vendasOrdenadas.map((v) => [
      formatDate(v.date),
      v.clientName || emptyMark,
      v.product || emptyMark,
      `${formatNumber(v.quantity, 2)} ${v.unitOfMeasure || ''}`.trim(),
      formatBRL(v.totalValue),
      v.status === 'PAID' ? 'Pago' : v.status === 'CANCELLED' ? 'Cancelado' : 'Pendente',
    ]),
    { 4: { halign: 'right' } }
  );

  y = renderSection(
    doc,
    y,
    'PRODUTOS',
    ['Nome', 'Unidade', 'Preço Referência', 'Cadastrado em', 'Status'],
    produtosOrdenados.map((p) => [
      p.name || emptyMark,
      p.unitOfMeasure || emptyMark,
      formatBRL(p.referencePrice),
      p.createdAt ? formatDate(p.createdAt) : emptyMark,
      p.status === 'INACTIVE' ? 'Inativo' : 'Ativo',
    ]),
    { 2: { halign: 'right' }, 3: { halign: 'center', cellWidth: 28 } }
  );

  renderBrandFooter(doc, companyInfo.name);

  const todayIso = new Date().toISOString().slice(0, 10);
  const filename = `Relatorio_Consolidado_${sanitizePdfFilename(companyInfo.name)}_${todayIso}.pdf`;

  return { blob: doc.output('blob'), filename };
}
