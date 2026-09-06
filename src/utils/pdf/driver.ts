import autoTable from 'jspdf-autotable';
import { AppSettings, CargaRecord, MotoristaRecord, VendaRecord } from '../../types';
import { sortByDateDescending } from '../dateSorting';
import { formatBRL, formatDate, formatLicensePlate, formatNumber } from '../formatters';
import { getFreightRecords } from '../freightUtils';
import { PDF_BRAND, getBrandTableStyles } from '../pdfVisualStyle';

import { createBasePdfDocument, extractCompanyInfo, finalizePdfAndDownload, renderStandardHeader, sanitizePdfFilename } from './base';
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
