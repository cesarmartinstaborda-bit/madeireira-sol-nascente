import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, testFirebaseConnection } from '../lib/firebase';
import { KlabinDatabase, CargaRecord, DepositoKlabinRecord, ClientRecord, VendaRecord, ProdutoRecord, MotoristaRecord, AppSettings } from '../types';
import { sanitizeDatabase } from './storage';

/**
 * Syncs database state with Firebase Firestore in real-time.
 */
export function subscribeToFirestore(
  onDataUpdate: (dbData: KlabinDatabase) => void
): () => void {
  // Run initial connection test
  testFirebaseConnection();

  const collections = {
    cargas: 'cargas',
    depositos: 'depositos',
    clientes: 'clientes',
    vendas: 'vendas',
    produtos: 'produtos',
    motoristas: 'motoristas',
    settings: 'settings',
  };

  const state: KlabinDatabase = {
    Cargas: [],
    Depositos_Klabin: [],
    Clientes: [],
    Vendas: [],
    Produtos: [],
    Motoristas: [],
  };

  let hasLoadedAnySnapshot = false;

  const unsubCargas = onSnapshot(
    collection(db, collections.cargas),
    (snapshot) => {
      state.Cargas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CargaRecord));
      notify();
    },
    (err) => handleFirestoreError(err, OperationType.GET, collections.cargas)
  );

  const unsubDepositos = onSnapshot(
    collection(db, collections.depositos),
    (snapshot) => {
      state.Depositos_Klabin = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DepositoKlabinRecord));
      notify();
    },
    (err) => handleFirestoreError(err, OperationType.GET, collections.depositos)
  );

  const unsubClientes = onSnapshot(
    collection(db, collections.clientes),
    (snapshot) => {
      state.Clientes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ClientRecord));
      notify();
    },
    (err) => handleFirestoreError(err, OperationType.GET, collections.clientes)
  );

  const unsubVendas = onSnapshot(
    collection(db, collections.vendas),
    (snapshot) => {
      state.Vendas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as VendaRecord));
      notify();
    },
    (err) => handleFirestoreError(err, OperationType.GET, collections.vendas)
  );

  const unsubProdutos = onSnapshot(
    collection(db, collections.produtos),
    (snapshot) => {
      state.Produtos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ProdutoRecord));
      notify();
    },
    (err) => handleFirestoreError(err, OperationType.GET, collections.produtos)
  );

  const unsubMotoristas = onSnapshot(
    collection(db, collections.motoristas),
    (snapshot) => {
      state.Motoristas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MotoristaRecord));
      notify();
    },
    (err) => handleFirestoreError(err, OperationType.GET, collections.motoristas)
  );

  const unsubSettings = onSnapshot(
    doc(db, collections.settings, 'appSettings'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        state.appSettings = {
          freightRatePerTon: data.freightRatePerTon ?? 15,
          companyName: data.companyName ?? 'Madeireira Sol Nascente',
        };
        state.customLogo = data.customLogo;
      }
      notify();
    },
    (err) => handleFirestoreError(err, OperationType.GET, `${collections.settings}/appSettings`)
  );

  function notify() {
    hasLoadedAnySnapshot = true;
    const clean = sanitizeDatabase(state);
    onDataUpdate(clean);
  }

  // Cleanup unsubscribers
  return () => {
    unsubCargas();
    unsubDepositos();
    unsubClientes();
    unsubVendas();
    unsubProdutos();
    unsubMotoristas();
    unsubSettings();
  };
}

/**
 * Recursively cleans undefined properties from an object/array,
 * ensuring Firestore setDoc never receives unsupported undefined field values.
 */
export function cleanUndefinedForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => cleanUndefinedForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanUndefinedForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

/**
 * Saves entire database state to Firebase Firestore collections.
 */
export async function syncDatabaseToFirestore(database: KlabinDatabase): Promise<void> {
  const clean = sanitizeDatabase(database);

  try {
    // 1. Sync Cargas
    for (const item of clean.Cargas) {
      if (item.id) {
        await setDoc(doc(db, 'cargas', item.id), cleanUndefinedForFirestore(item), { merge: true });
      }
    }

    // 2. Sync Depositos
    for (const item of clean.Depositos_Klabin) {
      if (item.id) {
        await setDoc(doc(db, 'depositos', item.id), cleanUndefinedForFirestore(item), { merge: true });
      }
    }

    // 3. Sync Clientes
    if (clean.Clientes) {
      for (const item of clean.Clientes) {
        if (item.id) {
          await setDoc(doc(db, 'clientes', item.id), cleanUndefinedForFirestore(item), { merge: true });
        }
      }
    }

    // 4. Sync Vendas
    if (clean.Vendas) {
      for (const item of clean.Vendas) {
        if (item.id) {
          await setDoc(doc(db, 'vendas', item.id), cleanUndefinedForFirestore(item), { merge: true });
        }
      }
    }

    // 5. Sync Produtos
    if (clean.Produtos) {
      for (const item of clean.Produtos) {
        if (item.id) {
          await setDoc(doc(db, 'produtos', item.id), cleanUndefinedForFirestore(item), { merge: true });
        }
      }
    }

    // 6. Sync Motoristas
    if (clean.Motoristas) {
      for (const item of clean.Motoristas) {
        if (item.id) {
          await setDoc(doc(db, 'motoristas', item.id), cleanUndefinedForFirestore(item), { merge: true });
        }
      }
    }

    // 7. Sync App Settings & Logo
    await setDoc(
      doc(db, 'settings', 'appSettings'),
      cleanUndefinedForFirestore({
        freightRatePerTon: clean.appSettings?.freightRatePerTon ?? 15,
        companyName: clean.appSettings?.companyName ?? 'Madeireira Sol Nascente',
        customLogo: clean.customLogo || null,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_sync');
  }
}

/**
 * Deletes a record from a Firestore collection
 */
export async function deleteFirestoreRecord(collectionName: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

/**
 * Checks if Firestore is currently empty and populates it with local database if needed
 */
export async function seedFirestoreIfEmpty(localDb: KlabinDatabase): Promise<void> {
  try {
    const cargasSnap = await getDocs(collection(db, 'cargas'));
    if (cargasSnap.empty) {
      console.log('Firestore collections empty. Seeding Firestore with local database...');
      await syncDatabaseToFirestore(localDb);
    }
  } catch (err) {
    console.warn('Could not seed Firestore (might be offline):', err);
  }
}
