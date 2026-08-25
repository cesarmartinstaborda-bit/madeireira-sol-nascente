import { CargaRecord, VendaRecord, MotoristaRecord, AppSettings } from '../types';
import { generateDriverPendingPdf } from './pdfGenerator';

export { generateDriverPendingPdf };

export interface GenerateDriverPdfOptions {
  driverPlate: string;
  driver?: MotoristaRecord | { id?: string; name?: string; licensePlate?: string; driverKey?: string };
  cargas: CargaRecord[];
  vendas?: VendaRecord[];
  motoristas?: MotoristaRecord[];
  appSettings?: AppSettings;
  companyLogo?: string;
}

export function generateDriverPdf({
  driverPlate,
  driver,
  cargas,
  vendas = [],
  motoristas = [],
  appSettings,
  companyLogo,
}: GenerateDriverPdfOptions) {
  const targetDriver = driver || {
    name: driverPlate,
    licensePlate: driverPlate,
    driverKey: driverPlate,
  };

  return generateDriverPendingPdf({
    driver: targetDriver,
    cargas,
    vendas,
    motoristas,
    appSettings,
    customLogo: companyLogo,
  });
}
