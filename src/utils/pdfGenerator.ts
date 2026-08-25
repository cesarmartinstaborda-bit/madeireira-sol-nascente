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
import { DEFAULT_COMPANY_LOGO } from './logoAsset';
import { getFreightRecords } from './freightUtils';

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
    logo: customLogo || DEFAULT_COMPANY_LOGO,
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
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const startY = 12;
  let textStartX = 14;

  // 1. Logo
  let hasLogo = false;
  if (company.logo && company.logo.startsWith('data:image')) {
    try {
      doc.addImage(company.logo, 'JPEG', 14, startY, 22, 22);
      textStartX = 40;
      hasLogo = true;
    } catch {
      hasLogo = false;
      textStartX = 14;
    }
  }

  // 2. Company Info (Left Header)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor('#1B4332'); // Brand primary dark green
  doc.text(company.name, textStartX, startY + (hasLogo ? 5.5 : 4));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor('#475569');

  let currentY = startY + (hasLogo ? 10.5 : 8.5);
  if (company.cnpj) {
    doc.text(`CNPJ: ${formatCNPJ(company.cnpj)}`, textStartX, currentY);
    currentY += 4.5;
  }

  const locationParts = [company.city, company.state].filter(Boolean);
  if (locationParts.length > 0) {
    doc.text(locationParts.join(' - '), textStartX, currentY);
    currentY += 4.5;
  }

  // 3. Document Title & Emission Date (Right Header)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor('#0F172A');
  doc.text(title, pageWidth - 14, startY + 5.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#64748B');
  doc.text(getPdfEmissionDate(), pageWidth - 14, startY + 11, { align: 'right' });

  // Divider line
  const headerBottomY = Math.max(hasLogo ? startY + 24 : currentY + 2, startY + 17);
  doc.setDrawColor('#CBD5E1');
  doc.setLineWidth(0.35);
  doc.line(14, headerBottomY, pageWidth - 14, headerBottomY);

  let nextSectionY = headerBottomY + 5;

  // 4. Identification Details Box (e.g. Cliente: [nome] or Motorista: [nome] / Placa: [placa])
  if (detailsBox && detailsBox.length > 0) {
    const boxHeight = detailsBox.length > 1 ? 13 : 9;
    doc.setFillColor('#F8FAFC');
    doc.setDrawColor('#E2E8F0');
    doc.roundedRect(14, nextSectionY, pageWidth - 28, boxHeight, 1.5, 1.5, 'FD');

    detailsBox.forEach((item, idx) => {
      const lineY = nextSectionY + (detailsBox.length > 1 ? (idx === 0 ? 5 : 10) : 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor('#475569');
      doc.text(`${item.label}: `, 18, lineY);

      const labelWidth = doc.getTextWidth(`${item.label}: `);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#0F172A');
      doc.text(item.value, 18 + labelWidth, lineY);
    });

    nextSectionY += boxHeight + 4;
  }

  return nextSectionY;
}

/**
 * Standard finalization: renders page numbers and discrete footer on all pages,
 * then triggers browser download of the PDF.
 */
export function finalizePdfAndDownload(
  doc: jsPDF,
  filename: string,
  companyName: string
) {
  const pageCount = (doc.internal as any).getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor('#94A3B8');
    doc.text(companyName, 14, pageHeight - 7);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 7, {
      align: 'right',
    });
  }

  doc.save(filename);
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

  const companyInfo = extractCompanyInfo(appSettings, customLogo);
  const doc = createBasePdfDocument();

  const startY = renderStandardHeader(
    doc,
    'DEMONSTRATIVO DE VALORES PENDENTES',
    companyInfo,
    [{ label: 'Cliente', value: clientName }]
  );

  const totalAmount = clientPendingVendas.reduce(
    (acc, v) => acc + (Number(v.totalValue) || 0),
    0
  );

  // Table columns: Data | Produto | Quantidade | Preço Unitário | Valor Total
  const tableHead = [
    ['Data', 'Produto', 'Quantidade', 'Preço Unitário', 'Valor Total'],
  ];

  const tableBody = clientPendingVendas.map((v) => {
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
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: '#0F172A',
      lineColor: '#CBD5E1',
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: '#1B4332',
      textColor: '#FFFFFF',
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: '#F8FAFC',
      textColor: '#0F172A',
      fontStyle: 'bold',
      fontSize: 9,
      lineColor: '#94A3B8',
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 26 }, // Data
      1: { halign: 'left' },                  // Produto
      2: { halign: 'right', cellWidth: 32 },  // Quantidade
      3: { halign: 'right', cellWidth: 32 },  // Preço Unitário
      4: { halign: 'right', cellWidth: 36 },  // Valor Total
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
          data.cell.styles.textColor = '#B45309'; // Amber highlight
        }
      }
    },
    margin: { left: 14, right: 14 },
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

  // 1. Calculate Totals (Exact same logic as application)
  const totalDepositos = (depositos || []).reduce(
    (acc, d) => acc + (Number(d.value) || 0),
    0
  );

  const eligibleCargas = (cargas || []).filter(
    (c) => c.deductFromBalance === 'YES' || (c.deductFromBalance as any) === true
  );

  const totalAbatido = eligibleCargas.reduce(
    (acc, c) => acc + (Number(c.totalValue) || 0),
    0
  );

  const saldoLivre = totalDepositos - totalAbatido;

  // 2. Summary Box
  const summaryBoxY = headerEndY;
  const summaryBoxWidth = pageWidth - 28;
  const summaryBoxHeight = 17;

  doc.setFillColor('#F8FAFC');
  doc.setDrawColor('#CBD5E1');
  doc.roundedRect(14, summaryBoxY, summaryBoxWidth, summaryBoxHeight, 1.5, 1.5, 'FD');

  const colWidth = summaryBoxWidth / 3;

  // Col 1: Total Depositado
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor('#64748B');
  doc.text('TOTAL DEPOSITADO', 14 + 6, summaryBoxY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor('#047857'); // Emerald green
  doc.text(formatBRL(totalDepositos), 14 + 6, summaryBoxY + 12);

  // Col 2: Total Abatido
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor('#64748B');
  doc.text('TOTAL ABATIDO', 14 + colWidth + 6, summaryBoxY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor('#B91C1C'); // Crimson red
  doc.text(formatBRL(totalAbatido), 14 + colWidth + 6, summaryBoxY + 12);

  // Col 3: Saldo Livre Klabin
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor('#1E293B');
  doc.text('SALDO LIVRE KLABIN', 14 + colWidth * 2 + 6, summaryBoxY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(saldoLivre >= 0 ? '#1B4332' : '#B91C1C');
  doc.text(formatBRL(saldoLivre), 14 + colWidth * 2 + 6, summaryBoxY + 12);

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

  movements.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const tableHead = [
    ['Data', 'Movimento', 'Descrição', 'Entrada', 'Saída'],
  ];

  const tableBody = movements.map((m) => [
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
    startY: summaryBoxY + summaryBoxHeight + 5,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: '#0F172A',
      lineColor: '#CBD5E1',
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: '#1B4332',
      textColor: '#FFFFFF',
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: '#F8FAFC',
      textColor: '#0F172A',
      fontStyle: 'bold',
      fontSize: 9,
      lineColor: '#94A3B8',
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 26 }, // Data
      1: { halign: 'center', cellWidth: 26 }, // Movimento
      2: { halign: 'left' },                  // Descrição
      3: { halign: 'right', cellWidth: 32 },  // Entrada
      4: { halign: 'right', cellWidth: 32 },  // Saída
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
          data.cell.styles.textColor = saldoLivre >= 0 ? '#1B4332' : '#B91C1C';
        }
      }
    },
    margin: { left: 14, right: 14 },
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

  const totalDevido = pendingFreights.reduce(
    (acc, f) => acc + (Number(f.freightCost) || 0),
    0
  );

  // Table columns: Data | Referência | Quantidade | Valor do Frete
  const tableHead = [
    ['Data', 'Referência', 'Quantidade', 'Valor do Frete'],
  ];

  const tableBody = pendingFreights.map((f) => {
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
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: '#0F172A',
      lineColor: '#CBD5E1',
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: '#1B4332',
      textColor: '#FFFFFF',
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: '#F8FAFC',
      textColor: '#0F172A',
      fontStyle: 'bold',
      fontSize: 9,
      lineColor: '#94A3B8',
      lineWidth: 0.25,
    },
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
          data.cell.styles.textColor = '#B45309'; // Amber highlight
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const sanitizedDriver = sanitizePdfFilename(driverName);
  const filename = `Fretes_${sanitizedDriver}_${todayIso}.pdf`;

  finalizePdfAndDownload(doc, filename, companyInfo.name);
  return true;
}
