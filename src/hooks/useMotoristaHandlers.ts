import { KlabinDatabase, MotoristaRecord } from '../types';
import { upsertFirestoreRecord, deleteFirestoreRecord } from '../utils/firebaseSync';

interface UseMotoristaHandlersParams {
  database: KlabinDatabase;
  mutateDatabase: (updater: (prev: KlabinDatabase) => KlabinDatabase) => void;
  showToast: (msg: string) => void;
}

/**
 * CRUD handlers for the Motoristas registry.
 *
 * Takes the whole `database` rather than just the Motoristas slice: deleting a driver
 * checks Cargas and Vendas for linked records and soft-deletes (INACTIVE) when any exist.
 *
 * Note: this is not the only writer of `Motoristas` — the generic modal path in
 * `handleSaveRecord` also writes the collection when `modalTableType === 'Motoristas'`.
 * Freight payment handlers live in `useFreightHandlers`: they are keyed by driver but
 * write Cargas/Vendas, not Motoristas.
 */
export function useMotoristaHandlers({
  database,
  mutateDatabase,
  showToast,
}: UseMotoristaHandlersParams) {
  const handleAddMotorista = (motorista: MotoristaRecord) => {
    mutateDatabase((prev) => ({
      ...prev,
      Motoristas: [...(prev.Motoristas || []), motorista],
    }));
    upsertFirestoreRecord('motoristas', motorista);
    showToast(`Motorista ${motorista.name} cadastrado com sucesso.`);
  };

  const handleUpdateMotorista = (motorista: MotoristaRecord) => {
    mutateDatabase((prev) => ({
      ...prev,
      Motoristas: (prev.Motoristas || []).map((m) => (m.id === motorista.id ? motorista : m)),
    }));
    upsertFirestoreRecord('motoristas', motorista);
    showToast(`Cadastro do motorista ${motorista.name} atualizado.`);
  };

  const handleDeleteDriver = (id: string) => {
    const driver = (database.Motoristas || []).find((m) => m.id === id);
    if (!driver) return;

    // Relational safety check: Check if driver has linked historical data in Cargas or Vendas
    const driverPlateFormatted = `${driver.name} / ${driver.licensePlate}`;
    const hasInCargas = (database.Cargas || []).some(
      (c) =>
        c.motoristaId === driver.id ||
        c.driverId === driver.id ||
        c.driverPlate === driver.id ||
        (c.driverPlate && c.driverPlate.trim() === driverPlateFormatted) ||
        (c.licensePlate && c.licensePlate.trim() === driver.licensePlate) ||
        (c.driverPlate && c.driverPlate.trim() === driver.name) ||
        (c.driverPlate && c.driverPlate.trim() === driver.licensePlate)
    );

    const hasInVendas = (database.Vendas || []).some(
      (v) =>
        v.motoristaId === driver.id ||
        v.driverId === driver.id ||
        v.driverPlate === driver.id ||
        (v.driverPlate && v.driverPlate.trim() === driverPlateFormatted) ||
        (v.licensePlate && v.licensePlate.trim() === driver.licensePlate) ||
        (v.driverPlate && v.driverPlate.trim() === driver.name) ||
        (v.driverPlate && v.driverPlate.trim() === driver.licensePlate)
    );

    const hasLinkedRecords = hasInCargas || hasInVendas;

    if (hasLinkedRecords) {
      // Soft Delete: update status to 'INACTIVE' to preserve relational history
      const inactived = { ...driver, status: 'INACTIVE' as const };
      mutateDatabase((prev) => ({
        ...prev,
        Motoristas: (prev.Motoristas || []).map((m) =>
          m.id === id ? inactived : m
        ),
      }));
      upsertFirestoreRecord('motoristas', inactived);
      showToast(`Motorista "${driver.name}" possui lançamentos vinculados e foi inativado (Soft Delete).`);
    } else {
      // Hard Delete: remove permanently from database and Firestore
      mutateDatabase((prev) => ({
        ...prev,
        Motoristas: (prev.Motoristas || []).filter((m) => m.id !== id),
      }));
      deleteFirestoreRecord('motoristas', id);
      showToast(`Motorista "${driver.name}" foi excluído permanentemente.`);
    }
  };

  return { handleAddMotorista, handleUpdateMotorista, handleDeleteDriver };
}
