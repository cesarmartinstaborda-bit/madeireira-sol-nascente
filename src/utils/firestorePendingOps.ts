/**
 * Operações locais que ainda não foram confirmadas pelo Firestore, além da fila de upserts
 * de `firebaseSync.ts`: exclusões pendentes e restauração de backup pendente.
 *
 * Tudo fica no localStorage para sobreviver ao fechamento do app e só é removido depois da
 * confirmação do servidor. Sem isso, uma exclusão feita sem login voltava no próximo
 * snapshot, e uma restauração sem login perdia a fila antes de chegar à nuvem.
 */
const PENDING_DELETES_KEY = 'klabin_firestore_pending_deletes_v1';
const PENDING_RESTORE_KEY = 'klabin_firestore_pending_restore_v1';

export interface PendingFirestoreDelete {
  collection: string;
  id: string;
}

export function readPendingFirestoreDeletes(): PendingFirestoreDelete[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_DELETES_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingFirestoreDelete => typeof item?.collection === 'string' && typeof item?.id === 'string' && Boolean(item.id)
    );
  } catch {
    return [];
  }
}

function writePendingFirestoreDeletes(items: PendingFirestoreDelete[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(PENDING_DELETES_KEY);
    else localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('[Firestore] Falha ao persistir exclusões pendentes:', error);
  }
}

const sameDoc = (item: PendingFirestoreDelete, collection: string, id: string) =>
  item.collection === collection && item.id === String(id);

export function queueFirestoreDelete(collection: string, id: string): void {
  const pending = readPendingFirestoreDeletes().filter((item) => !sameDoc(item, collection, id));
  writePendingFirestoreDeletes([...pending, { collection, id: String(id) }]);
}

/** Remove a exclusão da fila: confirmada pelo servidor ou superada por uma gravação nova do mesmo id. */
export function clearPendingFirestoreDelete(collection: string, id: string): void {
  const pending = readPendingFirestoreDeletes();
  const remaining = pending.filter((item) => !sameDoc(item, collection, id));
  if (remaining.length !== pending.length) writePendingFirestoreDeletes(remaining);
}

export function clearAllPendingFirestoreDeletes(): void {
  writePendingFirestoreDeletes([]);
}

/** Ids da coleção aguardando exclusão; snapshots remotos não podem trazê-los de volta. */
export function pendingDeleteIds(collection: string): Set<string> {
  return new Set(readPendingFirestoreDeletes().filter((item) => item.collection === collection).map((item) => item.id));
}

/**
 * Marca uma restauração de backup ainda não aplicada na nuvem. Enquanto existir, o banco
 * local é a fonte da verdade: snapshots remotos são ignorados e, no próximo login, a
 * restauração é refeita com o estado local atual.
 */
export function markPendingFirestoreRestore(): void {
  try {
    localStorage.setItem(PENDING_RESTORE_KEY, new Date().toISOString());
  } catch (error) {
    console.error('[Firestore] Falha ao registrar restauração pendente:', error);
  }
}

export function clearPendingFirestoreRestore(): void {
  try {
    localStorage.removeItem(PENDING_RESTORE_KEY);
  } catch {
    // ignore
  }
}

export function hasPendingFirestoreRestore(): boolean {
  try {
    return Boolean(localStorage.getItem(PENDING_RESTORE_KEY));
  } catch {
    return false;
  }
}
