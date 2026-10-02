import { useRef } from 'react';
import { KlabinDatabase, CargaRecord, VendaRecord } from '../types';
import { upsertFirestoreRecord } from '../utils/firebaseSync';

interface UseFreightHandlersParams {
  database: KlabinDatabase;
  mutateDatabase: (updater: (prev: KlabinDatabase) => KlabinDatabase) => KlabinDatabase;
  showToast: (msg: string) => void;
  isDateLocked: (dateStr?: string) => boolean;
}

/**
 * Freight payment handlers.
 *
 * These are keyed by driver (or by a single record) but belong to the freight domain:
 * they read Motoristas only to resolve the driver key, and write `Cargas` and `Vendas`.
 * The Motoristas collection is never mutated here.
 *
 * `isDateLocked` is injected because freight changes respect the closed cycles stored in
 * `appSettings.cycles.lockedMonths` — a dependency on the settings domain.
 */
export function useFreightHandlers({
  database,
  mutateDatabase,
  showToast,
  isDateLocked,
}: UseFreightHandlersParams) {
  const databaseRef = useRef(database);
  databaseRef.current = database;

  // Resolves which Cargas/Vendas belong to a driver key. Matching by plate/name
  // is case-insensitive so it stays consistent with freightUtils.findMatchedDriver
  // (which normalizes to upper-case) — otherwise a header button could target a
  // group whose records it never matches, and the click would do nothing.
  const buildDriverMatcher = (driverKeyOrId: string) => {
    const currentDatabase = databaseRef.current;
    const matchedMotorista = (currentDatabase.Motoristas || []).find(
      (m) => m.id === driverKeyOrId || `${m.name} / ${m.licensePlate}` === driverKeyOrId || m.licensePlate === driverKeyOrId
    );
    const targetDriverId = matchedMotorista?.id || driverKeyOrId;
    const targetDriverName = matchedMotorista?.name || driverKeyOrId;
    const wantedKey = (driverKeyOrId || '').trim().toUpperCase();
    const wantedPlate = (matchedMotorista?.licensePlate || '').trim().toUpperCase();
    const wantedName = (matchedMotorista?.name || '').trim().toUpperCase();

    const isRecordMatch = (r: { driverId?: string; motoristaId?: string; driverPlate?: string; licensePlate?: string }) => {
      if (targetDriverId && (r.driverId === targetDriverId || r.motoristaId === targetDriverId)) return true;
      const key = (r.driverPlate || r.licensePlate || 'Motorista Não Identificado').trim().toUpperCase();
      if (key === wantedKey) return true;
      if (wantedPlate && key.includes(wantedPlate)) return true;
      if (wantedName && key.includes(wantedName)) return true;
      return false;
    };

    return { targetDriverName, isRecordMatch };
  };

  // Pay all pending freights for a given motorista/plate (respecting locked months)
  const handlePayFreightForDriver = (driverKeyOrId: string, transactionKey?: string) => {
    const updatedCargasToSync: CargaRecord[] = [];
    const updatedVendasToSync: VendaRecord[] = [];
    let skippedLockedCount = 0;

    const { targetDriverName, isRecordMatch } = buildDriverMatcher(driverKeyOrId);
    const paidAt = new Date().toISOString();

    for (const carga of databaseRef.current.Cargas) {
      if (isRecordMatch(carga) && carga.freightPayable !== 'NO' && (carga.freightPayable as any) !== false && carga.freightStatus !== 'PAID') {
        if (carga.date && isDateLocked(carga.date)) {
          skippedLockedCount++;
          continue;
        }
        updatedCargasToSync.push({
          ...carga,
          freightStatus: 'PAID',
          freightPaidAt: paidAt,
          transactionKey: transactionKey || carga.transactionKey,
        });
      }
    }

    for (const venda of databaseRef.current.Vendas || []) {
      if (isRecordMatch(venda) && venda.freightPayable !== 'NO' && (venda.freightPayable as any) !== false && venda.freightStatus !== 'PAID') {
        if (venda.date && isDateLocked(venda.date)) {
          skippedLockedCount++;
          continue;
        }
        updatedVendasToSync.push({
          ...venda,
          freightStatus: 'PAID',
          freightPaidAt: paidAt,
          transactionKey: transactionKey || venda.transactionKey,
        });
      }
    }

    const paidCount = updatedCargasToSync.length + updatedVendasToSync.length;
    if (paidCount > 0) {
      const cargasById = new Map(updatedCargasToSync.map((record) => [record.id, record]));
      const vendasById = new Map(updatedVendasToSync.map((record) => [record.id, record]));

      databaseRef.current = mutateDatabase((prev) => ({
        ...prev,
        Cargas: prev.Cargas.map((record) => cargasById.get(record.id) || record),
        Vendas: (prev.Vendas || []).map((record) => vendasById.get(record.id) || record),
      }));
    }

    // Firestore payloads are prepared before scheduling React state. Deriving them
    // inside a setState updater made this branch depend on React executing the
    // updater eagerly; when it was deferred, no cloud write happened and the next
    // authoritative snapshot restored the old PENDING value.
    updatedCargasToSync.forEach((c) => upsertFirestoreRecord('cargas', c));
    updatedVendasToSync.forEach((v) => upsertFirestoreRecord('vendas', v));

    if (paidCount > 0 && skippedLockedCount > 0) {
      showToast(`Fretes quitados para ${targetDriverName} (${skippedLockedCount} registro(s) em meses trancados foram preservados).`);
    } else if (paidCount > 0) {
      showToast(`Fretes quitados com sucesso para ${targetDriverName}!`);
    } else if (skippedLockedCount > 0) {
      showToast(`Todos os fretes pendentes pertencem a meses trancados no Fechamento de Ciclo.`);
    } else {
      showToast(`Nenhum frete pendente para quitar.`);
    }
  };

  // Revert all paid freights for a given motorista/plate back to PENDING (respecting locked months)
  const handleRevertFreightForDriver = (driverKeyOrId: string) => {
    const revertedCargasToSync: CargaRecord[] = [];
    const revertedVendasToSync: VendaRecord[] = [];
    let skippedLockedCount = 0;

    const { targetDriverName, isRecordMatch } = buildDriverMatcher(driverKeyOrId);

    for (const carga of databaseRef.current.Cargas) {
      if (isRecordMatch(carga) && carga.freightPayable !== 'NO' && (carga.freightPayable as any) !== false && carga.freightStatus === 'PAID') {
        if (carga.date && isDateLocked(carga.date)) {
          skippedLockedCount++;
          continue;
        }
        revertedCargasToSync.push({
          ...carga,
          freightStatus: 'PENDING',
          freightPaidAt: undefined,
        });
      }
    }

    for (const venda of databaseRef.current.Vendas || []) {
      if (isRecordMatch(venda) && venda.freightPayable !== 'NO' && (venda.freightPayable as any) !== false && venda.freightStatus === 'PAID') {
        if (venda.date && isDateLocked(venda.date)) {
          skippedLockedCount++;
          continue;
        }
        revertedVendasToSync.push({
          ...venda,
          freightStatus: 'PENDING',
          freightPaidAt: undefined,
        });
      }
    }

    const revertedCount = revertedCargasToSync.length + revertedVendasToSync.length;
    if (revertedCount > 0) {
      const cargasById = new Map(revertedCargasToSync.map((record) => [record.id, record]));
      const vendasById = new Map(revertedVendasToSync.map((record) => [record.id, record]));

      databaseRef.current = mutateDatabase((prev) => ({
        ...prev,
        Cargas: prev.Cargas.map((record) => cargasById.get(record.id) || record),
        Vendas: (prev.Vendas || []).map((record) => vendasById.get(record.id) || record),
      }));
    }

    revertedCargasToSync.forEach((c) => upsertFirestoreRecord('cargas', c));
    revertedVendasToSync.forEach((v) => upsertFirestoreRecord('vendas', v));

    if (revertedCount > 0 && skippedLockedCount > 0) {
      showToast(`Quitação revertida para ${targetDriverName} (${skippedLockedCount} registro(s) em meses trancados foram preservados).`);
    } else if (revertedCount > 0) {
      showToast(`Pagamento de frete revertido para PENDENTE (${targetDriverName}).`);
    } else if (skippedLockedCount > 0) {
      showToast(`Todos os fretes pagos pertencem a meses trancados no Fechamento de Ciclo.`);
    } else {
      showToast(`Nenhum frete quitado para reverter.`);
    }
  };

  // Toggle single freight status with entity type safety (PENDING <-> PAID)
  const handleToggleSingleFreight = (type: 'CARGA' | 'VENDA', recordId: string, transactionKey?: string) => {
    if (type === 'CARGA') {
      const carga = databaseRef.current.Cargas.find((c) => c.id === recordId);
      if (!carga) return;
      if (carga && carga.date && isDateLocked(carga.date)) {
        showToast('Operação bloqueada: o frete desta carga pertence a um mês trancado no Fechamento de Ciclo.');
        return;
      }

      const newStatus = carga.freightStatus === 'PAID' ? 'PENDING' : 'PAID';
      const updatedSingleCarga: CargaRecord = {
        ...carga,
        freightStatus: newStatus,
        freightPaidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
        transactionKey: newStatus === 'PAID' ? (transactionKey || carga.transactionKey) : undefined,
      };
      databaseRef.current = mutateDatabase((prev) => ({
        ...prev,
        Cargas: prev.Cargas.map((record) => record.id === recordId ? updatedSingleCarga : record),
      }));

      upsertFirestoreRecord('cargas', updatedSingleCarga);
      showToast('Status do frete da carga atualizado.');
    } else if (type === 'VENDA') {
      const venda = (databaseRef.current.Vendas || []).find((v) => v.id === recordId);
      if (!venda) return;
      if (venda && venda.date && isDateLocked(venda.date)) {
        showToast('Operação bloqueada: o frete desta venda pertence a um mês trancado no Fechamento de Ciclo.');
        return;
      }

      const newStatus = venda.freightStatus === 'PAID' ? 'PENDING' : 'PAID';
      const updatedSingleVenda: VendaRecord = {
        ...venda,
        freightStatus: newStatus,
        freightPaidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
        transactionKey: newStatus === 'PAID' ? (transactionKey || venda.transactionKey) : undefined,
      };
      databaseRef.current = mutateDatabase((prev) => ({
        ...prev,
        Vendas: (prev.Vendas || []).map((record) => record.id === recordId ? updatedSingleVenda : record),
      }));

      upsertFirestoreRecord('vendas', updatedSingleVenda);
      showToast('Status do frete da venda atualizado.');
    }
  };

  return { handlePayFreightForDriver, handleRevertFreightForDriver, handleToggleSingleFreight };
}
