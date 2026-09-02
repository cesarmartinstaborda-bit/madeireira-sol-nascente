import { CargaRecord, VendaRecord, MotoristaRecord, AppSettings, KlabinDatabase } from '../types';
import { compareDateValuesDescending, sortByDateDescending } from './dateSorting';

export interface UnifiedFreightRecord {
  id: string;
  type: 'CARGA' | 'VENDA';
  date: string;
  driverId?: string;
  motoristaId?: string;
  driverName?: string;
  driverPlate?: string;
  licensePlate?: string;
  driverKey: string;
  matchedDriver?: MotoristaRecord;
  product: string;
  tons: number;
  freightCost: number;
  freightStatus: 'PENDING' | 'PAID';
  freightPaidAt?: string;
  transactionKey?: string;
  originalRecord: CargaRecord | VendaRecord;
}

export interface DriverFreightGroup {
  /** Stable identity of the account; unique across groups, safe as a React key. */
  groupKey: string;
  driverId?: string;
  driverKey: string;
  motoristaObj?: MotoristaRecord;
  totalTons: number;
  totalFreightCost: number;
  pendingFreightCost: number;
  paidFreightCost: number;
  records: UnifiedFreightRecord[];
}

/**
 * Returns the global configured freight rate per ton from AppSettings, with a standard fallback of 15.
 */
export function getFreightRate(databaseOrSettings?: { appSettings?: AppSettings } | number): number {
  if (typeof databaseOrSettings === 'number') {
    return isNaN(databaseOrSettings) || databaseOrSettings <= 0 ? 15 : databaseOrSettings;
  }
  const rate = databaseOrSettings?.appSettings?.freightRatePerTon;
  return typeof rate === 'number' && !isNaN(rate) && rate > 0 ? rate : 15;
}

/**
 * Match a record to a registered Motorista prioritizing driverId / motoristaId,
 * then licensePlate, then driverPlate text search.
 */
export function findMatchedDriver(
  motoristas: MotoristaRecord[] = [],
  record: {
    driverId?: string;
    motoristaId?: string;
    licensePlate?: string;
    driverPlate?: string;
  }
): MotoristaRecord | undefined {
  if (!motoristas || motoristas.length === 0) return undefined;

  const targetId = record.driverId || record.motoristaId;
  if (targetId) {
    const foundById = motoristas.find((m) => m.id === targetId);
    if (foundById) return foundById;
  }

  const rawPlate = (record.licensePlate || '').trim().toUpperCase();
  if (rawPlate) {
    const foundByPlate = motoristas.find((m) => (m.licensePlate || '').trim().toUpperCase() === rawPlate);
    if (foundByPlate) return foundByPlate;
  }

  const rawDriverPlate = (record.driverPlate || '').trim();
  if (rawDriverPlate) {
    const foundByDriverPlateExact = motoristas.find((m) => {
      const formatted = `${m.name} / ${m.licensePlate}`.trim().toLowerCase();
      return formatted === rawDriverPlate.toLowerCase() || (m.name || '').trim().toLowerCase() === rawDriverPlate.toLowerCase();
    });
    if (foundByDriverPlateExact) return foundByDriverPlateExact;

    const foundByDriverPlatePartial = motoristas.find((m) => {
      const plate = (m.licensePlate || '').trim().toLowerCase();
      return plate && rawDriverPlate.toLowerCase().includes(plate);
    });
    if (foundByDriverPlatePartial) return foundByDriverPlatePartial;
  }

  return undefined;
}

/**
 * Extracts and unifies all payable freight items from both Cargas and Vendas.
 */
export function getFreightRecords(database: {
  Cargas: CargaRecord[];
  Vendas?: VendaRecord[];
  Motoristas?: MotoristaRecord[];
  appSettings?: AppSettings;
}): UnifiedFreightRecord[] {
  const freightRate = getFreightRate(database);
  const motoristas = database.Motoristas || [];
  const list: UnifiedFreightRecord[] = [];

  // 1. Process Cargas
  (database.Cargas || []).forEach((c) => {
    const hasFreight = c.freightPayable !== 'NO' && (c.freightPayable as any) !== false;
    if (!hasFreight) return;

    const matched = findMatchedDriver(motoristas, c);
    const tons = Number(c.quantityTons) || 0;
    const freightCost =
      c.freightCost !== undefined && c.freightCost !== null
        ? Number(c.freightCost)
        : tons * freightRate;

    const driverKey = matched
      ? `${matched.name} / ${matched.licensePlate}`
      : (c.driverPlate || c.licensePlate || 'Motorista Não Identificado').trim();

    list.push({
      id: c.id,
      type: 'CARGA',
      date: c.date,
      driverId: matched?.id || c.driverId || c.motoristaId,
      motoristaId: matched?.id || c.motoristaId || c.driverId,
      driverName: matched?.name,
      driverPlate: c.driverPlate,
      licensePlate: matched?.licensePlate || c.licensePlate,
      driverKey,
      matchedDriver: matched,
      product: c.product || 'Madeira Carga',
      tons,
      freightCost: isNaN(freightCost) ? 0 : freightCost,
      freightStatus: c.freightStatus === 'PAID' ? 'PAID' : 'PENDING',
      freightPaidAt: c.freightPaidAt,
      transactionKey: c.transactionKey,
      originalRecord: c,
    });
  });

  // 2. Process Vendas
  (database.Vendas || []).forEach((v) => {
    const hasFreight = v.freightPayable === 'YES' || (v.freightPayable as any) === true;
    if (!hasFreight) return;

    const matched = findMatchedDriver(motoristas, v);
    const tons = Number(v.quantity) || 0;
    const freightCost =
      v.freightCost !== undefined && v.freightCost !== null
        ? Number(v.freightCost)
        : tons * freightRate;

    const driverKey = matched
      ? `${matched.name} / ${matched.licensePlate}`
      : (v.driverPlate || v.licensePlate || 'Motorista Não Identificado').trim();

    list.push({
      id: v.id,
      type: 'VENDA',
      date: v.date,
      driverId: matched?.id || v.driverId || v.motoristaId,
      motoristaId: matched?.id || v.motoristaId || v.driverId,
      driverName: matched?.name,
      driverPlate: v.driverPlate,
      licensePlate: matched?.licensePlate || v.licensePlate,
      driverKey,
      matchedDriver: matched,
      product: v.product || 'Madeira Venda',
      tons,
      freightCost: isNaN(freightCost) ? 0 : freightCost,
      freightStatus: v.freightStatus === 'PAID' ? 'PAID' : 'PENDING',
      freightPaidAt: v.freightPaidAt,
      transactionKey: v.transactionKey,
      originalRecord: v,
    });
  });

  return list;
}

/**
 * Returns total pending freight value across both Cargas and Vendas.
 */
export function getPendingFreightTotal(database: {
  Cargas: CargaRecord[];
  Vendas?: VendaRecord[];
  Motoristas?: MotoristaRecord[];
  appSettings?: AppSettings;
}): number {
  return getFreightRecords(database)
    .filter((r) => r.freightStatus === 'PENDING')
    .reduce((acc, r) => acc + (Number(r.freightCost) || 0), 0);
}

/**
 * Returns total paid freight value across both Cargas and Vendas.
 */
export function getPaidFreightTotal(database: {
  Cargas: CargaRecord[];
  Vendas?: VendaRecord[];
  Motoristas?: MotoristaRecord[];
  appSettings?: AppSettings;
}): number {
  return getFreightRecords(database)
    .filter((r) => r.freightStatus === 'PAID')
    .reduce((acc, r) => acc + (Number(r.freightCost) || 0), 0);
}

/**
 * Returns total freight value (pending + paid).
 */
export function getTotalFreight(database: {
  Cargas: CargaRecord[];
  Vendas?: VendaRecord[];
  Motoristas?: MotoristaRecord[];
  appSettings?: AppSettings;
}): number {
  return getFreightRecords(database).reduce((acc, r) => acc + (Number(r.freightCost) || 0), 0);
}

/**
 * Groups unified freights by unique driver (primary key: driverId if known, else driverKey).
 */
export function getFreightGroupsByDriver(
  database: {
    Cargas: CargaRecord[];
    Vendas?: VendaRecord[];
    Motoristas?: MotoristaRecord[];
    appSettings?: AppSettings;
  },
  searchTerm?: string
): DriverFreightGroup[] {
  const records = getFreightRecords(database);

  // Records that display under the same label must land in the same account,
  // even when only some of them still carry a usable driverId. A Carga left
  // pointing at a deleted Motorista keeps that orphan id while a Venda for the
  // same plate has none, and grouping on the raw `driverId || driverKey` split
  // one driver into two blocks that rendered under the same name — reading, on
  // screen, as a single block whose dates jump back up in the middle.
  const canonicalKeyByDriverKey = new Map<string, string>();
  records.forEach((rec) => {
    if (rec.driverId && !canonicalKeyByDriverKey.has(rec.driverKey)) {
      canonicalKeyByDriverKey.set(rec.driverKey, rec.driverId);
    }
  });

  const groupMap = new Map<string, DriverFreightGroup>();

  records.forEach((rec) => {
    const groupKey = canonicalKeyByDriverKey.get(rec.driverKey) || rec.driverKey;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        groupKey,
        driverId: rec.driverId,
        driverKey: rec.driverKey,
        motoristaObj: rec.matchedDriver,
        totalTons: 0,
        totalFreightCost: 0,
        pendingFreightCost: 0,
        paidFreightCost: 0,
        records: [],
      });
    }

    const group = groupMap.get(groupKey)!;
    group.totalTons += rec.tons;
    group.totalFreightCost += rec.freightCost;

    if (rec.freightStatus === 'PAID') {
      group.paidFreightCost += rec.freightCost;
    } else {
      group.pendingFreightCost += rec.freightCost;
    }

    group.records.push(rec);
  });

  const groups = Array.from(groupMap.values());

  // Newest freight first. No secondary key on purpose: `createdAt` exists on
  // Vendas but is synthesised at midnight for Cargas (see sanitizeDatabase), so
  // using it pushed every Venda above every Carga on a shared date for a reason
  // that means nothing to the reader. Without it sortByDateDescending falls back
  // to its stable original order, like TableCargas and TableDepositos do.
  groups.forEach((group) => {
    group.records = sortByDateDescending(group.records, (record) => record.date);
  });

  // Accounts follow their own most recent freight, so scrolling the page reads
  // newest-first instead of following the order rows happened to sit in.
  groups.sort((a, b) => {
    const primary = compareDateValuesDescending(a.records[0]?.date, b.records[0]?.date);
    return primary !== 0 ? primary : a.driverKey.localeCompare(b.driverKey, 'pt-BR');
  });

  if (!searchTerm) return groups;

  const term = searchTerm.toLowerCase();
  return groups.filter((g) => {
    return (
      g.driverKey.toLowerCase().includes(term) ||
      g.motoristaObj?.name?.toLowerCase().includes(term) ||
      g.motoristaObj?.licensePlate?.toLowerCase().includes(term) ||
      g.motoristaObj?.phone?.toLowerCase().includes(term) ||
      g.motoristaObj?.pixKey?.toLowerCase().includes(term)
    );
  });
}
