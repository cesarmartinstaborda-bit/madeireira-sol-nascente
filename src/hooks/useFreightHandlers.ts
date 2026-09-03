import { KlabinDatabase, CargaRecord, VendaRecord } from '../types';
import { upsertFirestoreRecord } from '../utils/firebaseSync';

interface UseFreightHandlersParams {
  database: KlabinDatabase;
  mutateDatabase: (updater: (prev: KlabinDatabase) => KlabinDatabase) => void;
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
  // Resolves which Cargas/Vendas belong to a driver key. Matching by plate/name
  // is case-insensitive so it stays consistent with freightUtils.findMatchedDriver
  // (which normalizes to upper-case) — otherwise a header button could target a
  // group whose records it never matches, and the click would do nothing.
  const buildDriverMatcher = (driverKeyOrId: string) => {
    const matchedMotorista = (database.Motoristas || []).find(
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
    let paidCount = 0;

    const { targetDriverName, isRecordMatch } = buildDriverMatcher(driverKeyOrId);

    mutateDatabase((prev) => {
      const newCargas = prev.Cargas.map((c) => {
        if (isRecordMatch(c) && c.freightPayable !== 'NO' && (c.freightPayable as any) !== false && c.freightStatus !== 'PAID') {
          if (c.date && isDateLocked(c.date)) {
            skippedLockedCount++;
            return c;
          }
          paidCount++;
          const updated = {
            ...c,
            freightStatus: 'PAID' as const,
            freightPaidAt: new Date().toISOString(),
            transactionKey: transactionKey || c.transactionKey,
          };
          updatedCargasToSync.push(updated);
          return updated;
        }
        return c;
      });

      const newVendas = (prev.Vendas || []).map((v) => {
        if (isRecordMatch(v) && v.freightPayable !== 'NO' && (v.freightPayable as any) !== false && v.freightStatus !== 'PAID') {
          if (v.date && isDateLocked(v.date)) {
            skippedLockedCount++;
            return v;
          }
          paidCount++;
          const updated = {
            ...v,
            freightStatus: 'PAID' as const,
            freightPaidAt: new Date().toISOString(),
            transactionKey: transactionKey || v.transactionKey,
          };
          updatedVendasToSync.push(updated);
          return updated;
        }
        return v;
      });

      // Nothing changed: return the same reference so React skips the re-render
      // and the persistence/backup cycle does not run for a no-op click.
      if (paidCount === 0) return prev;

      return {
        ...prev,
        Cargas: newCargas,
        Vendas: newVendas,
      };
    });

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
    let revertedCount = 0;

    const { targetDriverName, isRecordMatch } = buildDriverMatcher(driverKeyOrId);

    mutateDatabase((prev) => {
      const newCargas = prev.Cargas.map((c) => {
        if (isRecordMatch(c) && c.freightPayable !== 'NO' && (c.freightPayable as any) !== false && c.freightStatus === 'PAID') {
          if (c.date && isDateLocked(c.date)) {
            skippedLockedCount++;
            return c;
          }
          revertedCount++;
          const updated = {
            ...c,
            freightStatus: 'PENDING' as const,
            freightPaidAt: undefined,
          };
          revertedCargasToSync.push(updated);
          return updated;
        }
        return c;
      });

      const newVendas = (prev.Vendas || []).map((v) => {
        if (isRecordMatch(v) && v.freightPayable !== 'NO' && (v.freightPayable as any) !== false && v.freightStatus === 'PAID') {
          if (v.date && isDateLocked(v.date)) {
            skippedLockedCount++;
            return v;
          }
          revertedCount++;
          const updated = {
            ...v,
            freightStatus: 'PENDING' as const,
            freightPaidAt: undefined,
          };
          revertedVendasToSync.push(updated);
          return updated;
        }
        return v;
      });

      // Nothing changed: return the same reference so React skips the re-render
      // and the persistence/backup cycle does not run for a no-op click.
      if (revertedCount === 0) return prev;

      return {
        ...prev,
        Cargas: newCargas,
        Vendas: newVendas,
      };
    });

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
    let updatedSingleCarga: CargaRecord | null = null;
    let updatedSingleVenda: VendaRecord | null = null;

    if (type === 'CARGA') {
      const carga = database.Cargas.find((c) => c.id === recordId);
      if (carga && carga.date && isDateLocked(carga.date)) {
        showToast('Operação bloqueada: o frete desta carga pertence a um mês trancado no Fechamento de Ciclo.');
        return;
      }

      mutateDatabase((prev) => ({
        ...prev,
        Cargas: prev.Cargas.map((c) => {
          if (c.id === recordId) {
            const newStatus = c.freightStatus === 'PAID' ? 'PENDING' : 'PAID';
            updatedSingleCarga = {
              ...c,
              freightStatus: newStatus as 'PENDING' | 'PAID',
              freightPaidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
              transactionKey: newStatus === 'PAID' ? (transactionKey || c.transactionKey) : undefined,
            };
            return updatedSingleCarga;
          }
          return c;
        }),
      }));

      if (updatedSingleCarga) upsertFirestoreRecord('cargas', updatedSingleCarga);
      showToast('Status do frete da carga atualizado.');
    } else if (type === 'VENDA') {
      const venda = (database.Vendas || []).find((v) => v.id === recordId);
      if (venda && venda.date && isDateLocked(venda.date)) {
        showToast('Operação bloqueada: o frete desta venda pertence a um mês trancado no Fechamento de Ciclo.');
        return;
      }

      mutateDatabase((prev) => ({
        ...prev,
        Vendas: (prev.Vendas || []).map((v) => {
          if (v.id === recordId) {
            const newStatus = v.freightStatus === 'PAID' ? 'PENDING' : 'PAID';
            updatedSingleVenda = {
              ...v,
              freightStatus: newStatus as 'PENDING' | 'PAID',
              freightPaidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
              transactionKey: newStatus === 'PAID' ? (transactionKey || v.transactionKey) : undefined,
            };
            return updatedSingleVenda;
          }
          return v;
        }),
      }));

      if (updatedSingleVenda) upsertFirestoreRecord('vendas', updatedSingleVenda);
      showToast('Status do frete da venda atualizado.');
    }
  };

  return { handlePayFreightForDriver, handleRevertFreightForDriver, handleToggleSingleFreight };
}
