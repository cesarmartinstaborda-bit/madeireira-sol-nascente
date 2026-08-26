import { useState } from 'react';
import { KlabinDatabase, CargaRecord, DepositoKlabinRecord, TableType } from '../types';
import { upsertFirestoreRecord, deleteFirestoreRecord } from '../utils/firebaseSync';

interface UseCargaDepositoHandlersParams {
  database: KlabinDatabase;
  mutateDatabase: (updater: (prev: KlabinDatabase) => KlabinDatabase) => void;
  showToast: (msg: string) => void;
  isDateLocked: (dateStr?: string) => boolean;
}

/**
 * Handlers for the two Klabin ledger collections: Cargas and Depositos_Klabin.
 *
 * Deletion is two-phase and owned here: `handleDeleteCarga` / `handleDeleteDeposito`
 * validate the locked-cycle rule and stage a target in `confirmDeleteTarget`; the actual
 * removal happens in `handleConfirmDelete`. The staged target is returned so the caller
 * can drive its confirmation modal. This confirm flow is exclusive to these two
 * collections — Motoristas and Produtos delete without confirmation.
 *
 * `isDateLocked` is injected: every mutation here respects `appSettings.cycles.lockedMonths`.
 *
 * `handleSaveCargaOrDeposito` is the sole owner of the generic modal's upsert path for
 * these two collections (App.tsx's `handleSaveRecord` is a thin dispatcher to it).
 * `useFreightHandlers` also writes Cargas when settling freight.
 */
export function useCargaDepositoHandlers({
  database,
  mutateDatabase,
  showToast,
  isDateLocked,
}: UseCargaDepositoHandlersParams) {
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: string; table: string } | null>(null);

  // Real-time inline update handlers for Data Grids
  const handleUpdateCargaRecord = (updatedCarga: CargaRecord) => {
    if (isDateLocked(updatedCarga.date)) {
      showToast('Operação bloqueada: o mês deste lançamento está trancado no Fechamento de Ciclo.');
      return;
    }
    mutateDatabase((prev) => ({
      ...prev,
      Cargas: prev.Cargas.map((c) => (c.id === updatedCarga.id ? updatedCarga : c)),
    }));
    upsertFirestoreRecord('cargas', updatedCarga);
  };

  const handleUpdateDepositoRecord = (updatedDeposito: DepositoKlabinRecord) => {
    if (isDateLocked(updatedDeposito.date)) {
      showToast('Operação bloqueada: o mês deste depósito está trancado no Fechamento de Ciclo.');
      return;
    }
    mutateDatabase((prev) => ({
      ...prev,
      Depositos_Klabin: prev.Depositos_Klabin.map((d) => (d.id === updatedDeposito.id ? updatedDeposito : d)),
    }));
    upsertFirestoreRecord('depositos', updatedDeposito);
  };

  // Delete Handlers with Firestore sync
  const handleDeleteCarga = (id: string) => {
    const item = database.Cargas.find((c) => c.id === id);
    if (item && item.date && isDateLocked(item.date)) {
      showToast('Operação bloqueada: o registro pertence a um mês trancado no Fechamento de Ciclo.');
      return;
    }
    setConfirmDeleteTarget({ id, table: 'Cargas' });
  };

  const handleDeleteDeposito = (id: string) => {
    const item = database.Depositos_Klabin.find((d) => d.id === id);
    if (item && item.date && isDateLocked(item.date)) {
      showToast('Operação bloqueada: o registro pertence a um mês trancado no Fechamento de Ciclo.');
      return;
    }
    setConfirmDeleteTarget({ id, table: 'Depositos_Klabin' });
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteTarget) return;
    const { id, table } = confirmDeleteTarget;

    if (table === 'Cargas') {
      mutateDatabase((prev) => ({
        ...prev,
        Cargas: prev.Cargas.filter((c) => c.id !== id),
      }));
      deleteFirestoreRecord('cargas', id);
      showToast('Carga excluída com sucesso.');
    } else if (table === 'Depositos_Klabin') {
      mutateDatabase((prev) => ({
        ...prev,
        Depositos_Klabin: prev.Depositos_Klabin.filter((d) => d.id !== id),
      }));
      deleteFirestoreRecord('depositos', id);
      showToast('Depósito excluído com sucesso.');
    }

    setConfirmDeleteTarget(null);
  };

  /** Dismiss the staged deletion without removing anything. */
  const cancelDelete = () => setConfirmDeleteTarget(null);

  /**
   * Upsert entry point for the generic `RecordModal` — used for both new and edited
   * Cargas/Depositos_Klabin. `modalTableType` selects the target: anything other than
   * `'Depositos_Klabin'` falls back to Cargas, matching the modal's own two-form design.
   */
  const handleSaveCargaOrDeposito = (modalTableType: TableType, savedRecord: any): boolean => {
    if (savedRecord && savedRecord.date && isDateLocked(savedRecord.date)) {
      showToast('Operação bloqueada: não é possível salvar lançamentos em mês trancado no Fechamento de Ciclo.');
      return false;
    }

    const targetTableKey: keyof KlabinDatabase =
      modalTableType === 'Depositos_Klabin' ? 'Depositos_Klabin' : 'Cargas';
    const firestoreCollection = targetTableKey === 'Depositos_Klabin' ? 'depositos' : 'cargas';

    mutateDatabase((prev) => {
      const currentList = [...((prev[targetTableKey] as any[]) || [])];
      const existingIndex = currentList.findIndex((item) => item.id === savedRecord.id);

      if (existingIndex >= 0) {
        currentList[existingIndex] = savedRecord;
      } else {
        currentList.push(savedRecord);
      }

      return {
        ...prev,
        [targetTableKey]: currentList,
      };
    });

    upsertFirestoreRecord(firestoreCollection, savedRecord);

    const entityLabel = targetTableKey === 'Depositos_Klabin' ? 'Depósito Klabin' : 'Carga';
    showToast(`${entityLabel} salvo com sucesso.`);
    return true;
  };

  return {
    handleUpdateCargaRecord,
    handleUpdateDepositoRecord,
    handleDeleteCarga,
    handleDeleteDeposito,
    handleConfirmDelete,
    confirmDeleteTarget,
    cancelDelete,
    handleSaveCargaOrDeposito,
  };
}
