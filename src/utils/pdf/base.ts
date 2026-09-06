import { jsPDF } from 'jspdf';
import { AppSettings } from '../../types';
import { formatCNPJ } from '../formatters';
import { autoUploadPdfToDrive } from '../googleDrive';
import { COMPANY_PDF_LOGO, registerPdfFonts, renderBrandFooter, renderBrandHeader } from '../pdfVisualStyle';

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

