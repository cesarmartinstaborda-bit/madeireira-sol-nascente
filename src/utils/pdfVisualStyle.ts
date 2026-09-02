import { jsPDF } from 'jspdf';
import BRAND_LOGO from '../../assets/madeireira-sol-nascente-logo.png?inline';
import ROBOTO_REGULAR from '../../assets/fonts/Roboto-Regular.ttf?inline';
import ROBOTO_BOLD from '../../assets/fonts/Roboto-Bold.ttf?inline';

export const PDF_FONT_FAMILY = 'Roboto';
const FALLBACK_FONT_FAMILY = 'helvetica';

/** Documents whose Roboto embedding failed and fell back to a core PDF font. */
const fallbackDocuments = new WeakSet<object>();

function dataUrlBase64(dataUrl: string): string {
  const separator = dataUrl.indexOf(',');
  return separator >= 0 ? dataUrl.slice(separator + 1) : dataUrl;
}

/**
 * Embeds a widely supported Unicode TrueType family in the document.
 *
 * Embedding is best-effort: if the bundled TTFs cannot be parsed (which is how
 * a packaged build regresses into unreadable glyphs), the document silently
 * falls back to a core PDF font instead of ending up on a family jsPDF never
 * registered — that state is what produces blank/garbled accents. Callers read
 * the family actually in use through `getPdfFontFamily`.
 */
export function registerPdfFonts(doc: jsPDF): string {
  try {
    doc.addFileToVFS('Roboto-Regular.ttf', dataUrlBase64(ROBOTO_REGULAR));
    doc.addFont('Roboto-Regular.ttf', PDF_FONT_FAMILY, 'normal');
    doc.addFileToVFS('Roboto-Bold.ttf', dataUrlBase64(ROBOTO_BOLD));
    doc.addFont('Roboto-Bold.ttf', PDF_FONT_FAMILY, 'bold');

    const registered = doc.getFontList()[PDF_FONT_FAMILY] || [];
    if (!registered.includes('normal') || !registered.includes('bold')) {
      throw new Error('Roboto faces missing after registration');
    }

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    return PDF_FONT_FAMILY;
  } catch {
    fallbackDocuments.add(doc);
    doc.setFont(FALLBACK_FONT_FAMILY, 'normal');
    return FALLBACK_FONT_FAMILY;
  }
}

/** The font family actually available in this document. */
export function getPdfFontFamily(doc: jsPDF): string {
  return fallbackDocuments.has(doc) ? FALLBACK_FONT_FAMILY : PDF_FONT_FAMILY;
}

/**
 * Bullet used between header details. The core PDF fonts do not carry a
 * dependable bullet glyph, so the fallback path degrades to a hyphen rather
 * than printing an empty box.
 */
export function brandSeparator(doc: jsPDF): string {
  return fallbackDocuments.has(doc) ? '-' : '•';
}

/** Placeholder for empty table cells; em dash only when the embedded font is live. */
export function emptyCellMark(doc: jsPDF): string {
  return fallbackDocuments.has(doc) ? '-' : '—';
}

export const PDF_BRAND = {
  orange: '#E98A15',
  orangeDark: '#A94F0B',
  orangeSoft: '#FFF5E8',
  brown: '#4A2A1A',
  graphite: '#1F1C1A',
  muted: '#3A3633',
  line: '#C9C4C0',
  light: '#F1F1F0',
  white: '#FFFFFF',
  danger: '#B42318',
} as const;

export const PDF_LAYOUT = {
  margin: 16,
  footerBottom: 7,
  /** Top margin for table continuation pages (autoTable defaults to 40mm). */
  tableTop: 20,
} as const;

export interface PdfHeaderCompany {
  name: string;
  cnpj?: string;
  city?: string;
  state?: string;
}

export const COMPANY_PDF_LOGO = BRAND_LOGO;

export interface FittedTextOptions {
  maxWidth: number;
  baseSize: number;
  /** Smallest size the text may shrink to before it is wrapped or truncated. */
  minSize?: number;
  align?: 'left' | 'right';
  maxLines?: number;
  /** Baseline distance between wrapped lines, in mm. */
  lineHeight?: number;
}

/**
 * Draws text that can never escape `maxWidth`.
 *
 * Order of concessions: shrink the type down to `minSize`, then wrap up to
 * `maxLines`, then truncate the last line with an ellipsis. Every hand-drawn
 * string in the reports goes through here — plain `doc.text` has no width
 * bound, which is what let long company/client names collide with neighbouring
 * blocks and spill out of the KPI cards.
 *
 * Returns the vertical space consumed, so callers can lay out what follows.
 */
export function drawFittedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options: FittedTextOptions
): number {
  const {
    maxWidth,
    baseSize,
    minSize = Math.max(6, baseSize - 2),
    align = 'left',
    maxLines = 1,
    lineHeight = baseSize * 0.45,
  } = options;

  const content = (text ?? '').toString();
  if (!content) return 0;

  let size = baseSize;
  let lines: string[] = [content];

  while (size >= minSize) {
    doc.setFontSize(size);
    lines = doc.splitTextToSize(content, maxWidth) as string[];
    if (lines.length <= maxLines) break;
    size -= 0.5;
  }

  if (lines.length > maxLines) {
    // Still too long at the smallest allowed size: keep the leading lines and
    // mark the cut so the reader knows the value was abbreviated.
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && doc.getTextWidth(`${last}…`) > maxWidth) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    lines = kept;
  }

  lines.forEach((line, index) => {
    doc.text(line, x, y + index * lineHeight, align === 'right' ? { align: 'right' } : undefined);
  });

  return (lines.length - 1) * lineHeight;
}

/**
 * Shared autoTable configuration. Takes the document so the table inherits the
 * font family that was actually embedded — hardcoding 'Roboto' here would point
 * autoTable at an unregistered family whenever embedding fell back.
 */
export function getBrandTableStyles(doc: jsPDF, fontSize = 9) {
  return {
    theme: 'plain' as const,
    // Keep a wrapped row whole: splitting one across a page break leaves a
    // stump of text stranded at the bottom of the previous page.
    rowPageBreak: 'avoid' as const,
    styles: {
      font: getPdfFontFamily(doc),
      fontSize,
      cellPadding: { top: 3.2, right: 2.8, bottom: 3.2, left: 2.8 },
      textColor: PDF_BRAND.graphite,
      lineColor: PDF_BRAND.line,
      lineWidth: { bottom: 0.15 },
      valign: 'middle' as const,
      overflow: 'linebreak' as const,
      minCellHeight: 7,
    },
    headStyles: {
      fillColor: PDF_BRAND.brown,
      textColor: PDF_BRAND.white,
      fontStyle: 'bold' as const,
      halign: 'left' as const,
      fontSize: Math.max(9, fontSize - 0.5),
      cellPadding: { top: 3.4, right: 2.8, bottom: 3.4, left: 2.8 },
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: PDF_BRAND.light },
    footStyles: {
      fillColor: PDF_BRAND.orangeSoft,
      textColor: PDF_BRAND.graphite,
      fontStyle: 'bold' as const,
      // Only a slight bump: a larger jump made nine-digit totals wider than the
      // value column and autoTable wrapped them mid-number.
      fontSize: fontSize + 0.5,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      lineColor: PDF_BRAND.orange,
      lineWidth: { top: 0.65 },
    },
    // `top` matters on continuation pages only, but omitting it makes autoTable
    // restart 40mm down the page and waste half of every page after the first.
    margin: {
      top: PDF_LAYOUT.tableTop,
      left: PDF_LAYOUT.margin,
      right: PDF_LAYOUT.margin,
      bottom: 17,
    },
  };
}

/**
 * Renders the masthead: brand mark and company block on the left, document
 * title and emission stamp on the right.
 *
 * The two blocks get disjoint horizontal bands, so no combination of long
 * company name and long title can make them overlap; each side is drawn with
 * `drawFittedText` and the emission stamp sits below the title's measured
 * height rather than at a fixed offset.
 */
export function renderBrandHeader(
  doc: jsPDF,
  title: string,
  company: PdfHeaderCompany,
  emissionText: string,
  details?: { label: string; value: string }[]
): number {
  const family = getPdfFontFamily(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = PDF_LAYOUT.margin;
  const right = pageWidth - PDF_LAYOUT.margin;
  const contentWidth = right - left;
  const top = 13;

  const logoSize = 22;
  doc.addImage(COMPANY_PDF_LOGO, 'PNG', left, top, logoSize, logoSize);

  const gutter = 8;
  const rightBandWidth = contentWidth * 0.45;
  const leftTextX = left + logoSize + 4;
  const leftBandWidth = right - rightBandWidth - gutter - leftTextX;

  doc.setFont(family, 'bold');
  doc.setTextColor(PDF_BRAND.graphite);
  const companyNameHeight = drawFittedText(doc, company.name, leftTextX, top + 8, {
    maxWidth: leftBandWidth,
    baseSize: 13.5,
    minSize: 10,
    maxLines: 2,
    lineHeight: 5.6,
  });

  const companyDetails = [
    company.cnpj ? `CNPJ: ${company.cnpj}` : '',
    [company.city, company.state].filter(Boolean).join(' - '),
  ].filter(Boolean);

  if (companyDetails.length) {
    doc.setFont(family, 'normal');
    doc.setTextColor(PDF_BRAND.muted);
    drawFittedText(
      doc,
      companyDetails.join(`  ${brandSeparator(doc)}  `),
      leftTextX,
      top + 14 + companyNameHeight,
      { maxWidth: leftBandWidth, baseSize: 8.5, minSize: 7, maxLines: 1 }
    );
  }

  doc.setFont(family, 'bold');
  doc.setTextColor(PDF_BRAND.brown);
  const titleHeight = drawFittedText(doc, title, right, top + 6, {
    maxWidth: rightBandWidth,
    baseSize: 11,
    minSize: 9,
    align: 'right',
    maxLines: 2,
    lineHeight: 5,
  });

  doc.setFont(family, 'normal');
  doc.setTextColor(PDF_BRAND.muted);
  drawFittedText(doc, emissionText, right, top + 12.5 + titleHeight, {
    maxWidth: rightBandWidth,
    baseSize: 9,
    minSize: 7.5,
    align: 'right',
    maxLines: 1,
  });

  const ruleY = top + logoSize + 4;
  doc.setDrawColor(PDF_BRAND.line);
  doc.setLineWidth(0.3);
  doc.line(left, ruleY, right, ruleY);
  doc.setDrawColor(PDF_BRAND.orange);
  doc.setLineWidth(0.8);
  doc.line(left, ruleY, left + 32, ruleY);

  let nextY = ruleY + 6;
  if (details?.length) {
    nextY = renderDetailsBox(doc, nextY, left, contentWidth, details);
  }

  return nextY;
}

/** Identification badge (client, driver) sized to the text it actually holds. */
function renderDetailsBox(
  doc: jsPDF,
  y: number,
  left: number,
  width: number,
  details: { label: string; value: string }[]
): number {
  const family = getPdfFontFamily(doc);
  const rowHeight = 5.4;
  const padding = 4;
  const boxHeight = padding * 2 + details.length * rowHeight - (rowHeight - 4);

  doc.setFillColor(PDF_BRAND.light);
  doc.setDrawColor(PDF_BRAND.line);
  doc.roundedRect(left, y, width, boxHeight, 1.5, 1.5, 'FD');

  details.forEach((item, index) => {
    const lineY = y + padding + 3 + index * rowHeight;

    doc.setFont(family, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(PDF_BRAND.muted);
    const label = `${item.label}:`;
    doc.text(label, left + padding, lineY);
    const labelWidth = doc.getTextWidth(`${label} `);

    doc.setFont(family, 'bold');
    doc.setTextColor(PDF_BRAND.graphite);
    drawFittedText(doc, item.value, left + padding + labelWidth, lineY, {
      maxWidth: width - padding * 2 - labelWidth,
      baseSize: 10,
      minSize: 8,
      maxLines: 1,
    });
  });

  return y + boxHeight + 5;
}

export function renderBrandFooter(doc: jsPDF, companyName: string): void {
  const family = getPdfFontFamily(doc);
  const pageCount = (doc.internal as any).getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - PDF_LAYOUT.margin;

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(PDF_BRAND.line);
    doc.setLineWidth(0.2);
    doc.line(PDF_LAYOUT.margin, pageHeight - 11, right, pageHeight - 11);

    const baseline = pageHeight - PDF_LAYOUT.footerBottom;
    const pageLabel = `Página ${page} de ${pageCount}`;

    doc.setFont(family, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(PDF_BRAND.muted);
    const pageLabelWidth = doc.getTextWidth(pageLabel);
    doc.text(pageLabel, right, baseline, { align: 'right' });

    drawFittedText(doc, companyName, PDF_LAYOUT.margin, baseline, {
      maxWidth: right - PDF_LAYOUT.margin - pageLabelWidth - 6,
      baseSize: 8.5,
      minSize: 7,
      maxLines: 1,
    });
  }
}
