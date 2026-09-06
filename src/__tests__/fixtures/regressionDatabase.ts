import type { KlabinDatabase } from '../../types';

/** Synthetic records shared by integration tests; never loaded from a user's backup. */
export function regressionDatabase(): KlabinDatabase {
  return {
    Cargas: [{ id: 'c1', date: '2026-08-20', product: 'Pinus Teste', productId: 'p1', quantityTons: 2, valuePerTon: 100, totalValue: 200, deductFromBalance: true, driverId: 'm1', driverPlate: 'Motorista Teste - ABC-1234', freightPayable: 'YES', freightCost: 30, freightStatus: 'PENDING' }],
    Depositos_Klabin: [{ id: 'd1', date: '2026-08-21', value: 1000, notes: 'Depósito de teste' }],
    Frete: [],
    Clientes: [{ id: 'cl1', name: 'Cliente Teste', contact: 'Contato Teste', notes: '', createdAt: '2026-08-01T12:00:00Z' }],
    Produtos: [{ id: 'p1', name: 'Pinus Teste', unitOfMeasure: 'ton', referencePrice: 100, status: 'ACTIVE', createdAt: '2026-08-01T12:00:00Z' }],
    Motoristas: [{ id: 'm1', name: 'Motorista Teste', licensePlate: 'ABC-1234', status: 'ACTIVE', createdAt: '2026-08-01T12:00:00Z' }],
    Vendas: [{ id: 'v1', date: '2026-08-22', clientId: 'cl1', clientName: 'Cliente Teste', product: 'Pinus Teste', productId: 'p1', quantity: 3, unitPrice: 100, totalValue: 300, status: 'PENDING', notes: '', createdAt: '2026-08-22T12:00:00Z', driverId: 'm1', freightPayable: 'YES', freightCost: 45, freightStatus: 'PENDING' }],
    appSettings: { freightRatePerTon: 15, company: { name: 'Madeireira Sol Nascente', city: 'Curitiba', state: 'PR' }, cycles: { lockedMonths: [] } },
  };
}
