import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { jsPDF } from 'jspdf';
import { initialKlabinData } from '../src/data/initialData';
import {
  generateClientPendingPdf,
  generateDriverPendingPdf,
  generateKlabinStatementPdf,
} from '../src/utils/pdfGenerator';
import { generateConsolidatedReportPdf } from '../src/utils/consolidatedReportPdf';

const outputDirectory = resolve(process.argv[2] || 'qa-evidence-2026-08-28/pdf-refino');
mkdirSync(outputDirectory, { recursive: true });

let currentPrefix = '';

// Blob-returning generators are flushed at the end: tsx compiles this file to
// CJS, where top-level await is unavailable.
const pendingBlobs: { name: string; blob: Blob }[] = [];

(jsPDF.API as any).save = function saveEvidence(filename: string) {
  writeFileSync(
    resolve(outputDirectory, `${currentPrefix}${filename}`),
    Buffer.from(this.output('arraybuffer'))
  );
};

const companySettings = {
  company: {
    name: 'Madeireira Sol Nascente',
    cnpj: '12.345.678/0001-90',
    city: 'Ponta Grossa',
    state: 'PR',
  },
  freightRatePerTon: 15,
};

// ---------------------------------------------------------------------------
// Stress dataset: everything that used to overflow a box or wrap badly, plus
// records deliberately out of order and in mixed date formats, and enough rows
// to force a second page.
// ---------------------------------------------------------------------------
const longCompanySettings = {
  company: {
    name: 'Madeireira e Transportes Sol Nascente do Paraná Ltda ME',
    cnpj: '12.345.678/0001-90',
    city: 'Ponta Grossa dos Campos Gerais',
    state: 'PR',
  },
  freightRatePerTon: 15,
};

const LONG_PRODUCT = 'Eucalipto Torora Descascado Classificado Premium Extra Longo';
const LONG_CLIENT = 'Movelaria e Compensados Araucária do Paraná Indústria Ltda';
const LONG_DRIVER = 'João Carlos de Oliveira Santos Nascimento Filho';

/** Spreads dates across two years in a deliberately shuffled, mixed-format order. */
const stressDate = (index: number): string => {
  const day = ((index * 7) % 28) + 1;
  const month = ((index * 5) % 12) + 1;
  const year = index % 3 === 0 ? 2025 : 2026;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Alternate ISO and legacy BR formatting to prove both sort correctly.
  return index % 2 === 0
    ? `${year}-${pad(month)}-${pad(day)}`
    : `${pad(day)}/${pad(month)}/${year}`;
};

const stressVendas = Array.from({ length: 40 }, (_, i) => ({
  id: `sv${i}`,
  date: stressDate(i),
  clientId: 'stress-client',
  clientName: LONG_CLIENT,
  product: i % 3 === 0 ? LONG_PRODUCT : 'Pinus Fina',
  unitOfMeasure: 'ton',
  quantity: 1234.5 + i,
  unitPrice: 1250.75,
  totalValue: 1543125.9 + i * 1000,
  status: 'PENDING' as const,
  notes: '',
  createdAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T09:00:00Z`,
  driverId: 'stress-driver',
  freightPayable: 'YES' as const,
  freightCost: 9875.5 + i,
  freightStatus: 'PENDING' as const,
}));

const stressCargas = Array.from({ length: 40 }, (_, i) => ({
  id: `sc${i}`,
  date: stressDate(i + 3),
  supplier: 'Florestal Sol Nascente Reflorestamento e Manejo Ltda',
  product: i % 4 === 0 ? LONG_PRODUCT : 'Pinus Fina',
  quantityTons: 4250.75 + i,
  totalValue: 2987654.32 + i * 1500,
  driverId: 'stress-driver',
  licensePlate: 'ABC-1234',
  freightCost: 12345.67 + i,
  freightStatus: 'PENDING' as const,
  deductFromBalance: true,
}));

const stressDepositos = Array.from({ length: 25 }, (_, i) => ({
  id: `sd${i}`,
  date: stressDate(i + 1),
  value: 3987654.21 + i * 2000,
  notes:
    i % 2 === 0
      ? 'Adiantamento mensal referente a contratos florestais de longo prazo firmados com a unidade industrial'
      : 'Depósito',
}));

const stressMotoristas = [
  {
    id: 'stress-driver',
    name: LONG_DRIVER,
    licensePlate: 'ABC-1234',
    phone: '(42) 99911-2233',
    status: 'ACTIVE' as const,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const stressProdutos = Array.from({ length: 12 }, (_, i) => ({
  id: `sp${i}`,
  name: i % 3 === 0 ? LONG_PRODUCT : `Produto ${i}`,
  unitOfMeasure: 'ton',
  referencePrice: 1250.5 + i,
  status: 'ACTIVE' as const,
  createdAt: `${i % 2 === 0 ? 2025 : 2026}-${String((i % 12) + 1).padStart(2, '0')}-15T00:00:00Z`,
}));

const stressClientes = [
  { id: 'stress-client', name: LONG_CLIENT, contact: '(41) 3344-5566', notes: '', createdAt: '2026-05-10T00:00:00Z' },
  { id: 'stress-client-2', name: 'Compensados Sul', contact: '(42) 3222-1100', notes: '', createdAt: '2026-08-01T00:00:00Z' },
];

// --- Baseline dataset -------------------------------------------------------
currentPrefix = 'base_';

generateKlabinStatementPdf({
  depositos: initialKlabinData.Depositos_Klabin,
  cargas: initialKlabinData.Cargas,
  appSettings: companySettings,
});

generateClientPendingPdf({
  client: initialKlabinData.Clientes![0],
  vendas: initialKlabinData.Vendas!,
  appSettings: companySettings,
});

generateDriverPendingPdf({
  driver: initialKlabinData.Motoristas![0],
  cargas: initialKlabinData.Cargas,
  vendas: initialKlabinData.Vendas,
  motoristas: initialKlabinData.Motoristas,
  appSettings: companySettings,
});

const baseConsolidated = generateConsolidatedReportPdf({
  ...initialKlabinData,
  appSettings: companySettings,
});
pendingBlobs.push({ name: `base_${baseConsolidated.filename}`, blob: baseConsolidated.blob });

// --- Stress dataset ---------------------------------------------------------
currentPrefix = 'stress_';

generateKlabinStatementPdf({
  depositos: stressDepositos as any,
  cargas: stressCargas as any,
  appSettings: longCompanySettings,
});

generateClientPendingPdf({
  client: { id: 'stress-client', name: LONG_CLIENT },
  vendas: stressVendas as any,
  appSettings: longCompanySettings,
});

generateDriverPendingPdf({
  driver: stressMotoristas[0],
  cargas: stressCargas as any,
  vendas: stressVendas as any,
  motoristas: stressMotoristas as any,
  appSettings: longCompanySettings,
});

const stressConsolidated = generateConsolidatedReportPdf({
  Cargas: stressCargas as any,
  Depositos_Klabin: stressDepositos as any,
  Motoristas: stressMotoristas as any,
  Clientes: stressClientes as any,
  Vendas: stressVendas as any,
  Produtos: stressProdutos as any,
  appSettings: longCompanySettings,
} as any);
pendingBlobs.push({ name: `stress_${stressConsolidated.filename}`, blob: stressConsolidated.blob });

void (async () => {
  for (const { name, blob } of pendingBlobs) {
    writeFileSync(resolve(outputDirectory, name), Buffer.from(await blob.arrayBuffer()));
  }
  console.log(outputDirectory);
})();
