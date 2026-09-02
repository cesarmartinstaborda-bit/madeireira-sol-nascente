import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CargaRecord,
  DepositoKlabinRecord,
  VendaRecord,
  MotoristaRecord,
  AppSettings,
} from '../types';
import {
  formatBRL,
  formatNumber,
  formatDate,
  formatCNPJ,
  formatLicensePlate,
} from './formatters';
import {
  COMPANY_PDF_LOGO,
  PDF_BRAND,
  PDF_LAYOUT,
  drawFittedText,
  getBrandTableStyles,
  getPdfFontFamily,
  renderBrandFooter,
  renderBrandHeader,
  registerPdfFonts,
} from './pdfVisualStyle';
import { sortByDateDescending } from './dateSorting';
import { getFreightRecords } from './freightUtils';
import { calcKlabinBalance, isDeductedFromBalance } from './klabinBalance';
import { autoUploadPdfToDrive } from './googleDrive';

export interface CompanyPdfData {
  name: string;
  cnpj?: string;
  city?: string;
  state?: string;
  logo?: string;
}

/**
 * Extracts and normalizes company information from AppSettings and custom logo.
 * If company information is not configured, falls back to 'Madeireira Sol Nascente'.
 */
export function extractCompanyInfo(
  appSettings?: AppSettings,
  customLogo?: string
): CompanyPdfData {
  const company = appSettings?.company;
  const name =
    company?.name?.trim() ||
    appSettings?.companyName?.trim() ||
    'Madeireira Sol Nascente';

  return {
    name,
    cnpj: company?.cnpj?.trim() || undefined,
    city: company?.city?.trim() || undefined,
    state: company?.state?.trim() || undefined,
    // All reports intentionally use the official bundled brand artwork.
    logo: COMPANY_PDF_LOGO,
  };
}

/**
 * Formats the current date and time in user's local timezone:
 * "Emitido em: DD/MM/AAAA às HH:mm"
 */
export function getPdfEmissionDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `Emitido em: ${day}/${month}/${year} às ${hours}:${minutes}`;
}

/**
 * Sanitizes strings for safe PDF filenames without accents or illegal characters.
 */
export function sanitizePdfFilename(name: string): string {
  if (!name) return 'Documento';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9_-]/g, '-') // replace invalid characters with hyphen
    .replace(/-+/g, '-')             // collapse duplicate hyphens
    .replace(/^-|-$/g, '');          // trim boundary hyphens
}

/**
 * Creates standard A4 portrait jsPDF document.
 */
export function createBasePdfDocument(): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    // Without this the embedded TrueType faces are written uncompressed and
    // every report ships as a multi-megabyte file.
    compress: true,
  });
  registerPdfFonts(doc);
  return doc;
}

/**
 * Renders the shared, standardized company header, document title, emission date,
 * and optional details badge (Client or Driver identification).
 * Returns the Y coordinate for the next section.
 */
export function renderStandardHeader(
  doc: jsPDF,
  title: string,
  company: CompanyPdfData,
  detailsBox?: { label: string; value: string }[]
): number {
  return renderBrandHeader(
    doc,
    title,
    { ...company, cnpj: company.cnpj ? formatCNPJ(company.cnpj) : undefined },
    getPdfEmissionDate(),
    detailsBox
  );
}

/**
 * Standard finalization: renders page numbers and discrete footer on all pages,
 * then triggers browser download of the PDF. After the local download, the same
 * PDF is mirrored to the dedicated Google Drive folder as a best-effort,
 * fire-and-forget step — it never blocks or breaks generation, and is silently
 * skipped (with a discreet UI notice) when no Drive session is active.
 */
export function finalizePdfAndDownload(
  doc: jsPDF,
  filename: string,
  companyName: string
) {
  renderBrandFooter(doc, companyName);

  doc.save(filename);

  try {
    const blob = doc.output('blob');
    void autoUploadPdfToDrive(blob, filename);
  } catch {
    // Extracting the blob must never affect the download that just succeeded.
  }
}

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

// ============================================================================
// 3. PDF DE FRETES PENDENTES POR MOTORISTA
// ============================================================================
export interface GenerateDriverPendingPdfParams {
  driver: {
    id?: string;
    name?: string;
    licensePlate?: string;
    driverKey?: string;
  };
  cargas: CargaRecord[];
  vendas?: VendaRecord[];
  motoristas?: MotoristaRecord[];
  appSettings?: AppSettings;
  customLogo?: string;
}

export function generateDriverPendingPdf({
  driver,
  cargas,
  vendas = [],
  motoristas = [],
  appSettings,
  customLogo,
}: GenerateDriverPendingPdfParams): boolean {
  const allFreight = getFreightRecords({
    Cargas: cargas,
    Vendas: vendas,
    Motoristas: motoristas,
    appSettings,
  });

  const driverId = driver.id;
  const driverName = (driver.name || driver.driverKey || 'Motorista').trim();
  const driverPlate = (driver.licensePlate || '').trim();

  // Filter strictly pending freights for this driver
  const pendingFreights = allFreight.filter((f) => {
    if (f.freightStatus !== 'PENDING') return false;

    if (driverId && f.driverId) {
      return f.driverId === driverId;
    }

    if (driver.driverKey && f.driverKey === driver.driverKey) {
      return true;
    }

    if (driverPlate && f.licensePlate) {
      return f.licensePlate.toUpperCase() === driverPlate.toUpperCase();
    }

    if (driverName && f.driverName) {
      return f.driverName.toLowerCase() === driverName.toLowerCase();
    }

    return false;
  });

  if (pendingFreights.length === 0) {
    return false; // Indicating no pending freights
  }

  // getFreightRecords returns every Carga followed by every Venda, so without
  // this the rows arrive interleaved by source instead of by date. No secondary
  // key, matching the on-screen list in getFreightGroupsByDriver: `createdAt` is
  // synthesised at midnight for Cargas and would split same-day rows by type.
  const orderedFreights = sortByDateDescending(pendingFreights, (freight) => freight.date);

  const companyInfo = extractCompanyInfo(appSettings, customLogo);
  const doc = createBasePdfDocument();

  // Identification (Name and Plate)
  const detailsBox: { label: string; value: string }[] = [
    { label: 'Motorista', value: driverName },
  ];
  if (driverPlate) {
    detailsBox.push({ label: 'Placa', value: formatLicensePlate(driverPlate) });
  }

  const startY = renderStandardHeader(
    doc,
    'DEMONSTRATIVO DE FRETES PENDENTES',
    companyInfo,
    detailsBox
  );

  const totalDevido = orderedFreights.reduce(
    (acc, f) => acc + (Number(f.freightCost) || 0),
    0
  );

  // Table columns: Data | Referência | Quantidade | Valor do Frete
  const tableHead = [
    ['Data', 'Referência', 'Quantidade', 'Valor do Frete'],
  ];

  const tableBody = orderedFreights.map((f) => {
    const ref = f.type === 'CARGA' ? 'Carga' : 'Venda';
    const qtdFormatted = `${formatNumber(f.tons, 2)} ton`;
    return [
      formatDate(f.date),
      ref,
      qtdFormatted,
      formatBRL(f.freightCost),
    ];
  });

  const tableFoot = [
    ['TOTAL DEVIDO', '', '', formatBRL(totalDevido)],
  ];

  autoTable(doc, {
    startY,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    ...getBrandTableStyles(doc, 9.5),
    columnStyles: {
      0: { halign: 'center', cellWidth: 28 }, // Data
      1: { halign: 'center', cellWidth: 32 }, // Referência
      2: { halign: 'right' },                 // Quantidade
      3: { halign: 'right', cellWidth: 42 },  // Valor do Frete
    },
    didParseCell: (data) => {
      if (data.section === 'foot') {
        if (data.column.index === 0) {
          data.cell.colSpan = 3;
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 3) {
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = PDF_BRAND.orangeDark;
        }
      }
    },
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const sanitizedDriver = sanitizePdfFilename(driverName);
  const filename = `Fretes_${sanitizedDriver}_${todayIso}.pdf`;

  finalizePdfAndDownload(doc, filename, companyInfo.name);
  return true;
}
