import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import {
  KlabinDatabase,
  CargaRecord,
  DepositoKlabinRecord,
  ClientRecord,
  VendaRecord,
  ProdutoRecord,
  MotoristaRecord,
} from '../types';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Read Firebase configuration directly from config json with fallback to Vite environment
const rawConfig = firebaseConfigJson as Record<string, any>;
const firebaseConfig = {
  apiKey: rawConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: rawConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: rawConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: rawConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: rawConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: rawConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID,
};
const firestoreDatabaseId = rawConfig.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_DATABASE_ID;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export type FirebaseSyncStatus =
  | 'CONNECTED'
  | 'SYNCING'
  | 'OFFLINE'
  | 'NOT_CONFIGURED'
  | 'ERROR';

const LAST_SYNC_KEY = 'klabin_last_successful_sync_at';

export function getStoredLastSyncTime(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export function recordSuccessfulSync(): void {
  try {
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, now);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Performs a safe, read-only verification of the Firebase connection without writing or deleting any document.
 */
export async function testFirebaseConnection(): Promise<{ success: boolean; message: string; error?: any }> {
  if (!isFirebaseConfigured()) {
    return { success: false, message: 'Firebase não está configurado neste ambiente.' };
  }

  const firestore = getFirestoreDb();
  if (!firestore) {
    return { success: false, message: 'Não foi possível inicializar o Firestore.' };
  }

  try {
    const docRef = doc(firestore, 'settings', 'global');
    await getDoc(docRef);
    recordSuccessfulSync();
    return { success: true, message: 'Conexão com Firebase funcionando.' };
  } catch (error: any) {
    console.error('[Firestore Test Error]:', error);
    return { success: false, message: 'Não foi possível conectar ao Firebase.', error };
  }
}

/**
 * Returns current real-time diagnostic status of the Firebase sync subsystem.
 */
export function getFirebaseSyncState(): {
  isConfigured: boolean;
  status: FirebaseSyncStatus;
  lastSuccessfulSyncAt: string | null;
} {
  const isConfigured = isFirebaseConfigured();
  if (!isConfigured) {
    return {
      isConfigured: false,
      status: 'NOT_CONFIGURED',
      lastSuccessfulSyncAt: getStoredLastSyncTime(),
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      isConfigured: true,
      status: 'OFFLINE',
      lastSuccessfulSyncAt: getStoredLastSyncTime(),
    };
  }

  return {
    isConfigured: true,
    status: 'CONNECTED',
    lastSuccessfulSyncAt: getStoredLastSyncTime(),
  };
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let hasLoggedConfigWarning = false;
let isSyncSuspended = false;

export function setFirestoreSyncSuspended(suspended: boolean): void {
  isSyncSuspended = suspended;
}

export function isFirestoreSyncSuspended(): boolean {
  return isSyncSuspended;
}

export function getFirestoreDb(): Firestore | null {
  if (!isFirebaseConfigured()) {
    if (!hasLoggedConfigWarning) {
      console.info('Firebase não configurado. Aplicação funcionando somente com armazenamento local.');
      hasLoggedConfigWarning = true;
    }
    return null;
  }

  try {
    if (!db) {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
    }
    return db;
  } catch (error) {
    console.error('[Firestore] Erro ao inicializar o Firestore:', error);
    return null;
  }
}

export type FirestoreCollectionKey =
  | 'cargas'
  | 'depositos'
  | 'clientes'
  | 'vendas'
  | 'produtos'
  | 'motoristas';

/**
 * Normalizes entity/table names to Firestore collection names
 */
export function toFirestoreCollectionName(name: string): FirestoreCollectionKey | null {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('carga')) return 'cargas';
  if (normalized.includes('deposito')) return 'depositos';
  if (normalized.includes('cliente')) return 'clientes';
  if (normalized.includes('venda')) return 'vendas';
  if (normalized.includes('produto')) return 'produtos';
  if (normalized.includes('motorista')) return 'motoristas';
  return null;
}

/**
 * Upserts a single document in Firestore (Create or Update)
 */
export async function upsertFirestoreRecord(
  collectionName: FirestoreCollectionKey | string,
  record: any
): Promise<void> {
  const firestore = getFirestoreDb();
  if (!firestore || !record || !record.id) return;

  const colKey = toFirestoreCollectionName(collectionName) || (collectionName.toLowerCase() as FirestoreCollectionKey);
  try {
    // Strip undefined properties because Firestore rejects undefined values
    const cleanData: Record<string, any> = {};
    Object.keys(record).forEach((key) => {
      if (record[key] !== undefined) {
        cleanData[key] = record[key];
      }
    });

    const docRef = doc(firestore, colKey, String(record.id));
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error) {
    console.error(`[Firestore Error] upsert ${colKey}/${record?.id}:`, error);
  }
}

/**
 * Deletes a single document from Firestore
 */
export async function deleteFirestoreRecord(
  collectionName: FirestoreCollectionKey | string,
  id: string
): Promise<void> {
  const firestore = getFirestoreDb();
  if (!firestore || !id) return;

  const colKey = toFirestoreCollectionName(collectionName) || (collectionName.toLowerCase() as FirestoreCollectionKey);
  try {
    const docRef = doc(firestore, colKey, String(id));
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`[Firestore Error] delete ${colKey}/${id}:`, error);
  }
}

/**
 * Sinks global settings (freight rate, custom logo) to settings/global
 */
export async function syncFirestoreSettings(settings: {
  appSettings?: any;
  customLogo?: string | null;
}): Promise<void> {
  const firestore = getFirestoreDb();
  if (!firestore) return;

  try {
    const cleanSettings: Record<string, any> = {};
    if (settings.appSettings !== undefined) cleanSettings.appSettings = settings.appSettings;
    if (settings.customLogo !== undefined) cleanSettings.customLogo = settings.customLogo;

    const docRef = doc(firestore, 'settings', 'global');
    await setDoc(docRef, cleanSettings, { merge: true });
  } catch (error) {
    console.error('[Firestore Error] sync settings/global:', error);
  }
}

/**
 * Checks if a database contains only the default initial demo data
 */
export function isDemoDatabase(database: KlabinDatabase): boolean {
  if (!database) return true;

  const demoCargaIds = new Set(['crg-101', 'crg-102']);
  const demoDepositoIds = new Set(['dep-201']);
  const demoClientIds = new Set(['cli-1', 'cli-2']);
  const demoVendaIds = new Set(['vnd-301']);
  const demoProdIds = new Set(['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5']);
  const demoMotIds = new Set(['mot-1', 'mot-2', 'mot-3']);

  const hasNonDemoCarga = database.Cargas.some((c) => !demoCargaIds.has(c.id));
  const hasNonDemoDeposito = database.Depositos_Klabin.some((d) => !demoDepositoIds.has(d.id));
  const hasNonDemoCliente = (database.Clientes || []).some((c) => !demoClientIds.has(c.id));
  const hasNonDemoVenda = (database.Vendas || []).some((v) => !demoVendaIds.has(v.id));
  const hasNonDemoProduto = (database.Produtos || []).some((p) => !demoProdIds.has(p.id));
  const hasNonDemoMotorista = (database.Motoristas || []).some((m) => !demoMotIds.has(m.id));

  return !(
    hasNonDemoCarga ||
    hasNonDemoDeposito ||
    hasNonDemoCliente ||
    hasNonDemoVenda ||
    hasNonDemoProduto ||
    hasNonDemoMotorista
  );
}

/**
 * Checks if Firestore is completely empty across all 6 collections.
 * Only seeds local data if Firestore is completely empty AND local data contains real user records (not demo).
 */
export async function checkAndSeedFirestoreIfEmpty(database: KlabinDatabase): Promise<boolean> {
  const firestore = getFirestoreDb();
  if (!firestore) return false;

  try {
    const [cargasSnap, depositosSnap, clientesSnap, vendasSnap, produtosSnap, motoristasSnap] =
      await Promise.all([
        getDocs(collection(firestore, 'cargas')),
        getDocs(collection(firestore, 'depositos')),
        getDocs(collection(firestore, 'clientes')),
        getDocs(collection(firestore, 'vendas')),
        getDocs(collection(firestore, 'produtos')),
        getDocs(collection(firestore, 'motoristas')),
      ]);

    const isCompletelyEmpty =
      cargasSnap.empty &&
      depositosSnap.empty &&
      clientesSnap.empty &&
      vendasSnap.empty &&
      produtosSnap.empty &&
      motoristasSnap.empty;

    if (isCompletelyEmpty) {
      if (isDemoDatabase(database)) {
        console.info(
          '[Firestore] Banco Firestore vazio detectado. Dados padrão de demonstração NÃO foram propagados para a nuvem.'
        );
        return false;
      } else {
        console.info(
          '[Firestore] Banco Firestore vazio e dados reais detectados localmente. Inicializando banco na nuvem com dados existentes.'
        );
        for (const c of database.Cargas) await upsertFirestoreRecord('cargas', c);
        for (const d of database.Depositos_Klabin) await upsertFirestoreRecord('depositos', d);
        for (const cli of database.Clientes || []) await upsertFirestoreRecord('clientes', cli);
        for (const v of database.Vendas || []) await upsertFirestoreRecord('vendas', v);
        for (const p of database.Produtos || []) await upsertFirestoreRecord('produtos', p);
        for (const m of database.Motoristas || []) await upsertFirestoreRecord('motoristas', m);
        if (database.appSettings || database.customLogo) {
          await syncFirestoreSettings({
            appSettings: database.appSettings,
            customLogo: database.customLogo,
          });
        }
        return true;
      }
    }
    return false;
  } catch (error) {
    console.warn('[Firestore] Falha na verificação de inicialização do Firestore:', error);
    return false;
  }
}

/**
 * Subscribes to all 6 Firestore collections and settings in realtime.
 * Sends authoritative collection snapshots to the callback to ensure creations, updates,
 * and remote deletions are accurately reflected without resurrection.
 */
export function subscribeToFirestore(
  onCollectionUpdate: (collectionKey: string, data: any) => void
): () => void {
  const firestore = getFirestoreDb();
  if (!firestore) {
    return () => {};
  }

  const unsubscribes: (() => void)[] = [];

  try {
    // 1. Cargas
    const unsubCargas = onSnapshot(
      collection(firestore, 'cargas'),
      (snap) => {
        if (isSyncSuspended) return;
        recordSuccessfulSync();
        const list: CargaRecord[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as CargaRecord));
        onCollectionUpdate('Cargas', list);
      },
      (err) => console.error('[Firestore Error] snapshot cargas:', err)
    );
    unsubscribes.push(unsubCargas);

    // 2. Depositos
    const unsubDepositos = onSnapshot(
      collection(firestore, 'depositos'),
      (snap) => {
        if (isSyncSuspended) return;
        recordSuccessfulSync();
        const list: DepositoKlabinRecord[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as DepositoKlabinRecord));
        onCollectionUpdate('Depositos_Klabin', list);
      },
      (err) => console.error('[Firestore Error] snapshot depositos:', err)
    );
    unsubscribes.push(unsubDepositos);

    // 3. Clientes
    const unsubClientes = onSnapshot(
      collection(firestore, 'clientes'),
      (snap) => {
        if (isSyncSuspended) return;
        recordSuccessfulSync();
        const list: ClientRecord[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as ClientRecord));
        onCollectionUpdate('Clientes', list);
      },
      (err) => console.error('[Firestore Error] snapshot clientes:', err)
    );
    unsubscribes.push(unsubClientes);

    // 4. Vendas
    const unsubVendas = onSnapshot(
      collection(firestore, 'vendas'),
      (snap) => {
        if (isSyncSuspended) return;
        recordSuccessfulSync();
        const list: VendaRecord[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as VendaRecord));
        onCollectionUpdate('Vendas', list);
      },
      (err) => console.error('[Firestore Error] snapshot vendas:', err)
    );
    unsubscribes.push(unsubVendas);

    // 5. Produtos
    const unsubProdutos = onSnapshot(
      collection(firestore, 'produtos'),
      (snap) => {
        if (isSyncSuspended) return;
        recordSuccessfulSync();
        const list: ProdutoRecord[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as ProdutoRecord));
        onCollectionUpdate('Produtos', list);
      },
      (err) => console.error('[Firestore Error] snapshot produtos:', err)
    );
    unsubscribes.push(unsubProdutos);

    // 6. Motoristas
    const unsubMotoristas = onSnapshot(
      collection(firestore, 'motoristas'),
      (snap) => {
        if (isSyncSuspended) return;
        recordSuccessfulSync();
        const list: MotoristaRecord[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as MotoristaRecord));
        onCollectionUpdate('Motoristas', list);
      },
      (err) => console.error('[Firestore Error] snapshot motoristas:', err)
    );
    unsubscribes.push(unsubMotoristas);

    // 7. Settings (global doc)
    const unsubSettings = onSnapshot(
      collection(firestore, 'settings'),
      (snap) => {
        if (isSyncSuspended) return;
        recordSuccessfulSync();
        snap.forEach((d) => {
          if (d.id === 'global') {
            const data = d.data();
            onCollectionUpdate('Settings', data);
          }
        });
      },
      (err) => console.error('[Firestore Error] snapshot settings:', err)
    );
    unsubscribes.push(unsubSettings);
  } catch (err) {
    console.error('[Firestore Error] Falha ao registrar listeners do Firestore:', err);
  }

  return () => {
    unsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        console.error('[Firestore Error] Falha ao cancelar inscrição:', e);
      }
    });
  };
}

/**
 * Authoritatively synchronizes a restored backup into Firestore.
 * 1. Suspends incoming snapshots to prevent race conditions.
 * 2. Compares existing remote documents in all 6 collections against restored data.
 * 3. Deletes any remote document not in the restored data (no resurrection / ghost data).
 * 4. Upserts all restored documents.
 * 5. Syncs global settings.
 * 6. Executes operations in safe chunks using Firestore writeBatch (<= 400 ops per batch).
 * 7. Resumes snapshot listeners.
 */
export async function restoreFirestoreAuthoritatively(
  database: KlabinDatabase
): Promise<{ success: boolean; error?: any }> {
  const firestore = getFirestoreDb();
  if (!firestore) {
    return { success: true };
  }

  setFirestoreSyncSuspended(true);

  try {
    const collectionsToSync: {
      key: FirestoreCollectionKey;
      records: any[];
    }[] = [
      { key: 'cargas', records: database.Cargas || [] },
      { key: 'depositos', records: database.Depositos_Klabin || [] },
      { key: 'clientes', records: database.Clientes || [] },
      { key: 'vendas', records: database.Vendas || [] },
      { key: 'produtos', records: database.Produtos || [] },
      { key: 'motoristas', records: database.Motoristas || [] },
    ];

    interface QueuedOp {
      type: 'set' | 'delete';
      colKey: string;
      docId: string;
      data?: any;
    }

    const operations: QueuedOp[] = [];

    // 1. Process all 6 entity collections
    for (const col of collectionsToSync) {
      const snap = await getDocs(collection(firestore, col.key));
      const targetIdSet = new Set(col.records.map((r) => String(r.id)));

      // Delete orphaned documents (documents in Firestore that are absent in backup)
      for (const remoteDoc of snap.docs) {
        if (!targetIdSet.has(remoteDoc.id)) {
          operations.push({
            type: 'delete',
            colKey: col.key,
            docId: remoteDoc.id,
          });
        }
      }

      // Upsert restored documents
      for (const rec of col.records) {
        if (rec && rec.id) {
          const cleanData: Record<string, any> = {};
          Object.keys(rec).forEach((k) => {
            if (rec[k] !== undefined) {
              cleanData[k] = rec[k];
            }
          });
          operations.push({
            type: 'set',
            colKey: col.key,
            docId: String(rec.id),
            data: cleanData,
          });
        }
      }
    }

    // 2. Process Settings (global doc)
    const cleanSettings: Record<string, any> = {};
    if (database.appSettings !== undefined) cleanSettings.appSettings = database.appSettings;
    if (database.customLogo !== undefined) cleanSettings.customLogo = database.customLogo || null;
    operations.push({
      type: 'set',
      colKey: 'settings',
      docId: 'global',
      data: cleanSettings,
    });

    // 3. Execute queued operations in batches of max 400 (Firestore limit is 500)
    const BATCH_SIZE = 400;
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(firestore);

      for (const op of chunk) {
        const docRef = doc(firestore, op.colKey, op.docId);
        if (op.type === 'delete') {
          batch.delete(docRef);
        } else {
          batch.set(docRef, op.data, { merge: true });
        }
      }

      await batch.commit();
    }

    setFirestoreSyncSuspended(false);
    return { success: true };
  } catch (error) {
    setFirestoreSyncSuspended(false);
    console.error('[Firestore Error] Falha durante restauração autoritativa:', error);
    return { success: false, error };
  }
}
