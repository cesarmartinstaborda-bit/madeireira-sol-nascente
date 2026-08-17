import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CargaRecord } from '../types';
import { formatBRL, formatNumber, formatDate } from './formatters';
import { DEFAULT_COMPANY_LOGO } from './logoAsset';

interface GenerateDriverPdfOptions {
  driverPlate: string;
  cargas: CargaRecord[];
  companyLogo?: string;
}

export function generateDriverPdf({
  driverPlate,
  cargas,
  companyLogo = DEFAULT_COMPANY_LOGO,
}: GenerateDriverPdfOptions) {
  // Filter pending freight charges for this driver
  const pendingCargas = cargas.filter((c) => {
    const isPayable = c.freightPayable !== 'NO';
    const isPending = c.freightStatus !== 'PAID';
    return isPayable && isPending;
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = '#1B4332'; // Dark Green
  const darkTextColor = '#0F172A';

  // Page Dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  let startY = 12;

  // 1. HEADER SECTION (MINIMAL)
  try {
    const logoToUse = companyLogo || DEFAULT_COMPANY_LOGO;
    doc.addImage(logoToUse, 'JPEG', 14, startY, 26, 26);
  } catch (err) {
    console.warn('Could not render logo in PDF:', err);
  }

  // Company Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(primaryColor);
  doc.text('MADEIREIRA SOL NASCENTE', 44, startY + 8);

  const todayStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor('#475569');
  doc.text('RELATÓRIO DE FRETES', 44, startY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor('#64748B');
  doc.text(`Data de Emissão: ${todayStr}`, pageWidth - 14, startY + 16, { align: 'right' });

  // Divider Line
  doc.setDrawColor('#CBD5E1');
  doc.setLineWidth(0.4);
  doc.line(14, startY + 22, pageWidth - 14, startY + 22);

  // 2. DRIVER / VEHICLE INFORMATION
  const driverBoxY = startY + 26;
  doc.setFillColor('#F8FAFC');
  doc.setDrawColor('#E2E8F0');
  doc.roundedRect(14, driverBoxY, pageWidth - 28, 10, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(darkTextColor);
  doc.text(`VEÍCULO / MOTORISTA: ${driverPlate.toUpperCase()}`, 18, driverBoxY + 6.5);

  // Calculations
  const totalTrips = pendingCargas.length;
  const totalTons = pendingCargas.reduce((acc, c) => acc + (Number(c.quantityTons) || 0), 0);
  const totalFreightCost = pendingCargas.reduce((acc, c) => {
    const cost = c.freightCost !== undefined ? Number(c.freightCost) : (Number(c.quantityTons) || 0) * 15;
    return acc + cost;
  }, 0);

  // 3. TABLE DATA (6-COLUMN LAYOUT)
  const tableHead = [
    [
      'Data',
      'Nº NF / Ticket',
      'Fornecedor / Origem',
      'Produto',
      'Qtd (ton)',
      'Custo Frete (R$)',
    ],
  ];

  const tableBody = pendingCargas.map((c) => {
    const cost = c.freightCost !== undefined ? Number(c.freightCost) : (Number(c.quantityTons) || 0) * 15;
    return [
      formatDate(c.date),
      c.invoiceNumber || '-',
      c.supplier || '-',
      c.product || 'Madeira',
      formatNumber(c.quantityTons),
      formatBRL(cost),
    ];
  });

  // Discrete TOTAL row at table foot
  const tableFoot = [
    [
      'TOTAL',
      `${totalTrips} carga(s)`,
      '-',
      '-',
      formatNumber(totalTons),
      formatBRL(totalFreightCost),
    ],
  ];

  autoTable(doc, {
    startY: driverBoxY + 14,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.2,
      textColor: darkTextColor,
      lineColor: '#CBD5E1',
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: '#1B4332',
      textColor: '#FFFFFF',
      fontStyle: 'bold',
      halign: 'center',
    },
    footStyles: {
      fillColor: '#F1F5F9',
      textColor: darkTextColor,
      fontStyle: 'bold',
      lineColor: '#94A3B8',
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 26 }, // Data
      1: { halign: 'center', cellWidth: 32 }, // Nº NF / Ticket
      2: { halign: 'left' },                  // Fornecedor
      3: { halign: 'left', cellWidth: 36 },   // Produto
      4: { halign: 'right', cellWidth: 28 },  // Qtd (ton)
      5: { halign: 'right', cellWidth: 36 },  // Custo Frete (R$)
    },
    margin: { left: 14, right: 14 },
  });

  // Get final Y position after table
  const finalTableY = (doc as any).lastAutoTable?.finalY || 100;

  // 4. FOOTER NOTE
  let footerY = finalTableY + 8;
  if (footerY + 16 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    footerY = 16;
  }

  doc.setFillColor('#F8FAFC');
  doc.setDrawColor('#E2E8F0');
  doc.roundedRect(14, footerY, pageWidth - 28, 10, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#475569');
  doc.text('Documento emitido para conferência de fretes prestados.', 18, footerY + 6.5);

  return doc;
}
