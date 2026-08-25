import { VendaRecord, ClientRecord, AppSettings } from '../types';
import { generateClientPendingPdf } from './pdfGenerator';

export { generateClientPendingPdf };

export interface GenerateClientPdfOptions {
  client: ClientRecord | { id?: string; name: string; contact?: string; notes?: string };
  vendas: VendaRecord[];
  appSettings?: AppSettings;
  companyLogo?: string;
}

export function generateClientPdf({
  client,
  vendas,
  appSettings,
  companyLogo,
}: GenerateClientPdfOptions) {
  return generateClientPendingPdf({
    client,
    vendas,
    appSettings,
    customLogo: companyLogo,
  });
}
