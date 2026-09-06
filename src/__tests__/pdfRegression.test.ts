import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { regressionDatabase } from './fixtures/regressionDatabase';
vi.mock('../utils/googleDrive', () => ({ autoUploadPdfToDrive: vi.fn() }));
import { autoUploadPdfToDrive } from '../utils/googleDrive';
import { generateClientPendingPdf, generateDriverPendingPdf, generateKlabinStatementPdf } from '../utils/pdfGenerator';
import { generateConsolidatedReportPdf } from '../utils/consolidatedReportPdf';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('preserva os quatro PDFs completos, inclusive layout e paginação', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
  const files: Record<string, string> = {};
  function record(name: string, bytes: string) {
    // PDF IDs are random; all drawing instructions, fonts and content remain in the comparison.
    const normalized = bytes.replace(/\/ID \[ <[A-F0-9]+> <[A-F0-9]+> \]/g, '/ID [ <FIXED> <FIXED> ]');
    files[name] = createHash('sha256').update(normalized, 'binary').digest('hex');
    if (process.env.PDF_REGRESSION_OUTPUT) {
      mkdirSync(process.env.PDF_REGRESSION_OUTPUT, { recursive: true });
      writeFileSync(resolve(process.env.PDF_REGRESSION_OUTPUT, name), Buffer.from(bytes, 'binary'));
    }
  }
  (jsPDF.API as unknown as { save: (name: string) => jsPDF }).save = function(this: jsPDF, name: string) { record(name, this.output()); return this; };
  const db = regressionDatabase();
  // Enough rows for multiple pages, with all values and dates deterministic.
  db.Cargas = Array.from({ length: 45 }, (_, i) => ({ ...db.Cargas[0], id: `c${i}` }));
  db.Vendas = Array.from({ length: 45 }, (_, i) => ({ ...db.Vendas![0], id: `v${i}` }));
  expect(generateClientPendingPdf({ client: db.Clientes![0], vendas: db.Vendas, appSettings: db.appSettings })).toBe(true);
  expect(generateDriverPendingPdf({ driver: db.Motoristas![0], cargas: db.Cargas, vendas: db.Vendas, motoristas: db.Motoristas, appSettings: db.appSettings })).toBe(true);
  expect(generateKlabinStatementPdf({ cargas: db.Cargas, depositos: db.Depositos_Klabin, appSettings: db.appSettings })).toBe(true);
  const report = generateConsolidatedReportPdf(db);
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(report.blob);
  });
  record(report.filename, Buffer.from(bytes).toString('binary'));
  expect(files).toMatchSnapshot();
  expect(autoUploadPdfToDrive).toHaveBeenCalledTimes(3);
}, 30000);
