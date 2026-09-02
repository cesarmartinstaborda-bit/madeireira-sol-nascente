import { describe, expect, it, vi, beforeEach } from 'vitest';
import { jsPDF } from 'jspdf';
import type { CargaRecord, DepositoKlabinRecord, MotoristaRecord, VendaRecord } from '../types';

// The generators end in doc.save(); left alone that drops real PDFs into the
// working directory every time the suite runs.
(jsPDF.API as unknown as { save: () => void }).save = function noopSave() {};

// autoTable is the single choke point every generator funnels its rows through,
// so spying on it is enough to assert the order the reader will actually see.
const autoTableCalls: { head?: string[][]; body: string[][] }[] = [];

vi.mock('jspdf-autotable', () => ({
  default: (_doc: unknown, options: { head?: string[][]; body: string[][] }) => {
    autoTableCalls.push(options);
    (_doc as { lastAutoTable?: { finalY: number } }).lastAutoTable = { finalY: 40 };
  },
}));

const { generateClientPendingPdf, generateDriverPendingPdf, generateKlabinStatementPdf } =
  await import('../utils/pdfGenerator');
const { generateConsolidatedReportPdf } = await import('../utils/consolidatedReportPdf');

const appSettings = { company: { name: 'Madeireira Sol Nascente' }, freightRatePerTon: 15 };

/** Rows of the captured table whose header starts with the given column names. */
const tabelaCom = (...colunas: string[]) => {
  const call = autoTableCalls.find((c) => colunas.every((col) => c.head?.[0]?.includes(col)));
  if (!call) throw new Error(`Tabela com as colunas ${colunas.join(', ')} não foi gerada`);
  return call.body;
};

/** Reads a DD/MM/AAAA column back into a sortable ISO string. */
const paraIso = (rows: string[][], column: number) =>
  rows.map((row) => {
    const [dia, mes, ano] = row[column].split('/');
    return `${ano}-${mes}-${dia}`;
  });

const datasDaTabela = (index: number, column = 0) => paraIso(autoTableCalls[index].body, column);

const estaDecrescente = (dates: string[]) =>
  dates.every((date, index) => index === 0 || dates[index - 1] >= date);

beforeEach(() => {
  autoTableCalls.length = 0;
});

describe('ordenação por data nos PDFs', () => {
  it('lista as vendas pendentes do cliente da mais recente para a mais antiga', () => {
    const vendas = [
      { id: 'v1', date: '2026-03-10', createdAt: '2026-03-10T10:00:00Z' },
      { id: 'v2', date: '2026-08-02', createdAt: '2026-08-02T10:00:00Z' },
      { id: 'v3', date: '2026-01-25', createdAt: '2026-01-25T10:00:00Z' },
      { id: 'v4', date: '2026-08-27', createdAt: '2026-08-27T10:00:00Z' },
    ].map((v) => ({
      ...v,
      clientId: 'c1',
      clientName: 'Movelaria Araucária',
      product: 'Pinus',
      quantity: 10,
      unitPrice: 100,
      totalValue: 1000,
      status: 'PENDING',
      notes: '',
    })) as VendaRecord[];

    const gerado = generateClientPendingPdf({
      client: { id: 'c1', name: 'Movelaria Araucária' },
      vendas,
      appSettings,
    });

    expect(gerado).toBe(true);
    expect(datasDaTabela(0)).toEqual(['2026-08-27', '2026-08-02', '2026-03-10', '2026-01-25']);
  });

  it('ordena o extrato Klabin do movimento mais recente para o mais antigo', () => {
    const depositos: DepositoKlabinRecord[] = [
      { id: 'd1', date: '2026-02-01', value: 10000 },
      { id: 'd2', date: '2026-08-20', value: 5000 },
    ];
    const cargas = [
      { id: 'c1', date: '2026-05-15', quantityTons: 10, totalValue: 2000, deductFromBalance: true },
      { id: 'c2', date: '2026-08-25', quantityTons: 12, totalValue: 2400, deductFromBalance: true },
    ] as CargaRecord[];

    generateKlabinStatementPdf({ depositos, cargas, appSettings });

    expect(datasDaTabela(0)).toEqual(['2026-08-25', '2026-08-20', '2026-05-15', '2026-02-01']);
  });

  it('mistura depósitos e cargas por data, e não por origem do registro', () => {
    // The statement merges two independent sources; a stable sort must interleave
    // them rather than emit every deposit before every carga.
    generateKlabinStatementPdf({
      depositos: [{ id: 'd1', date: '2026-06-10', value: 1000 }],
      cargas: [
        { id: 'c1', date: '2026-07-01', quantityTons: 5, totalValue: 900, deductFromBalance: true },
        { id: 'c2', date: '2026-05-01', quantityTons: 5, totalValue: 900, deductFromBalance: true },
      ] as CargaRecord[],
      appSettings,
    });

    expect(autoTableCalls[0].body.map((row) => row[1])).toEqual(['Carga', 'Depósito', 'Carga']);
  });

  it('ordena os fretes do motorista mesmo vindo de cargas e vendas separadas', () => {
    const motoristas: MotoristaRecord[] = [
      { id: 'm1', name: 'João Silva', licensePlate: 'ABC-1234' },
    ];
    const cargas = [
      { id: 'c1', date: '2026-04-02', quantityTons: 10, totalValue: 1000, driverId: 'm1', freightCost: 150, freightStatus: 'PENDING' },
      { id: 'c2', date: '2026-08-15', quantityTons: 10, totalValue: 1000, driverId: 'm1', freightCost: 150, freightStatus: 'PENDING' },
    ] as CargaRecord[];
    const vendas = [
      { id: 'v1', date: '2026-06-20', clientId: 'x', clientName: 'X', product: 'P', quantity: 5, unitPrice: 10, totalValue: 50, status: 'PENDING', notes: '', createdAt: '2026-06-20T00:00:00Z', driverId: 'm1', freightPayable: 'YES', freightCost: 80, freightStatus: 'PENDING' },
    ] as VendaRecord[];

    const gerado = generateDriverPendingPdf({
      driver: { id: 'm1', name: 'João Silva', licensePlate: 'ABC-1234' },
      cargas,
      vendas,
      motoristas,
      appSettings,
    });

    expect(gerado).toBe(true);
    expect(datasDaTabela(0)).toEqual(['2026-08-15', '2026-06-20', '2026-04-02']);
  });

  it('ordena todas as seções datadas do relatório consolidado', () => {
    generateConsolidatedReportPdf({
      Cargas: [
        { id: 'c1', date: '2026-01-05', quantityTons: 1, totalValue: 10 },
        { id: 'c2', date: '2026-09-05', quantityTons: 1, totalValue: 10 },
      ] as CargaRecord[],
      Depositos_Klabin: [
        { id: 'd1', date: '2026-02-02', value: 1 },
        { id: 'd2', date: '2026-07-02', value: 1 },
      ] as DepositoKlabinRecord[],
      Vendas: [
        { id: 'v1', date: '2026-03-03', clientId: 'a', clientName: 'A', product: 'P', quantity: 1, unitPrice: 1, totalValue: 1, status: 'PENDING', notes: '', createdAt: '2026-03-03T00:00:00Z' },
        { id: 'v2', date: '2026-10-03', clientId: 'b', clientName: 'B', product: 'P', quantity: 1, unitPrice: 1, totalValue: 1, status: 'PAID', notes: '', createdAt: '2026-10-03T00:00:00Z' },
      ] as VendaRecord[],
      Produtos: [
        { id: 'p1', name: 'Pinus', unitOfMeasure: 'ton', referencePrice: 10, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'p2', name: 'Eucalipto', unitOfMeasure: 'ton', referencePrice: 10, status: 'ACTIVE', createdAt: '2026-08-01T00:00:00Z' },
      ],
      appSettings,
    } as any);

    // Empty sections are skipped rather than drawn, so tables are matched by
    // their header instead of by position.
    expect(paraIso(tabelaCom('Fornecedor'), 0)).toEqual(['2026-09-05', '2026-01-05']);
    expect(paraIso(tabelaCom('Observações'), 0)).toEqual(['2026-07-02', '2026-02-02']);
    expect(paraIso(tabelaCom('Cliente'), 0)).toEqual(['2026-10-03', '2026-03-03']);
    // Produtos gained a "Cadastrado em" column so the catalogue can be ordered.
    expect(paraIso(tabelaCom('Preço Referência'), 3)).toEqual(['2026-08-01', '2026-01-01']);
  });

  it('ordena corretamente datas legadas em DD/MM/AAAA misturadas com ISO', () => {
    generateKlabinStatementPdf({
      depositos: [
        { id: 'd1', date: '05/09/2026', value: 1 },
        { id: 'd2', date: '2026-02-01', value: 1 },
        { id: 'd3', date: '20/06/2026', value: 1 },
      ] as DepositoKlabinRecord[],
      cargas: [],
      appSettings,
    });

    expect(estaDecrescente(datasDaTabela(0))).toBe(true);
  });
});
