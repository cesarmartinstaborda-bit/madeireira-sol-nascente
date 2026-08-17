import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VendaRecord, ClientRecord } from '../types';
import { formatBRL, formatNumber, formatDate } from './formatters';
import { DEFAULT_COMPANY_LOGO } from './logoAsset';

interface GeneratePdfOptions {
  client: ClientRecord | { name: string; contact?: string; notes?: string };
  vendas: VendaRecord[];
  companyLogo?: string;
}

export function generateClientPdf({
  client,
  vendas,
  companyLogo = DEFAULT_COMPANY_LOGO,
}: GeneratePdfOptions) {
  // Filter strictly PENDING sales
  const pendingVendas = vendas.filter((v) => v.status === 'PENDING');

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
  // Add Company Logo on Left Header
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
  doc.text('RELATÓRIO', 44, startY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor('#64748B');
  doc.text(`Data de Emissão: ${todayStr}`, pageWidth - 14, startY + 16, { align: 'right' });

  // Divider Line
  doc.setDrawColor('#CBD5E1');
  doc.setLineWidth(0.4);
  doc.line(14, startY + 22, pageWidth - 14, startY + 22);

  // 2. CLIENT DETAILS (SUBTLE, CLEAN SECTION)
  const clientBoxY = startY + 26;
  doc.setFillColor('#F8FAFC');
  doc.setDrawColor('#E2E8F0');
  doc.roundedRect(14, clientBoxY, pageWidth - 28, 10, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(darkTextColor);
  doc.text(`CLIENTE: ${client.name.toUpperCase()}`, 18, clientBoxY + 6.5);

  // Totals calculations
  const totalTickets = pendingVendas.length;
  const totalWeight = pendingVendas.reduce((acc, v) => acc + (Number(v.quantity) || 0), 0);
  const totalAmount = pendingVendas.reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);

  // 3. TABLE DATA (7-COLUMN NATIVE LAYOUT)
  const tableHead = [
    [
      'Data',
      'Ticket',
      'Placa',
      'Produto',
      'Peso Líq. (ton)',
      'Preço/Ton (R$)',
      'Valor Total (R$)',
    ],
  ];

  const tableBody = pendingVendas.map((v) => {
    const ticketNo = v.id ? `TK-${v.id.slice(-6).toUpperCase()}` : 'PES-001';
    const placaStr = v.notes && v.notes.toLowerCase().includes('placa') ? v.notes : '-';

    return [
      formatDate(v.date),
      ticketNo,
      placaStr,
      v.product || 'Eucalipto',
      formatNumber(v.quantity || 0),
      formatBRL(v.unitPrice || 0),
      formatBRL(v.totalValue || 0),
    ];
  });

  // Discrete TOTAL row at table foot
  const tableFoot = [
    [
      'TOTAL',
      `${totalTickets} ticket(s)`,
      '-',
      '-',
      formatNumber(totalWeight),
      '-',
      formatBRL(totalAmount),
    ],
  ];

  autoTable(doc, {
    startY: clientBoxY + 14,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: darkTextColor,
      lineColor: '#CBD5E1',
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: primaryColor,
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
      0: { halign: 'center', cellWidth: 22 }, // Data
      1: { halign: 'center', cellWidth: 26 }, // Ticket
      2: { halign: 'center', cellWidth: 22 }, // Placa
      3: { halign: 'left', cellWidth: 38 },   // Produto
      4: { halign: 'right', cellWidth: 25 },  // Peso Líquido
      5: { halign: 'right', cellWidth: 25 },  // Preço/Ton
      6: { halign: 'right', cellWidth: 24 },  // Valor Total
    },
    margin: { left: 14, right: 14 },
  });

  return doc;
}

