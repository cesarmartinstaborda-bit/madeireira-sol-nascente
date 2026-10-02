import { useState, useEffect, useRef } from 'react';
import { KlabinDatabase } from '../types';
import { loadDatabase, saveDatabase, sanitizeDatabase, createAutoBackup } from '../utils/storage';
import { onFirebaseUser } from '../utils/googleAuth';
import {
  subscribeToFirestore,
  checkAndSeedFirestoreIfEmpty,
  flushPendingFirestoreUpserts,
  isFirebaseConfigured,
} from '../utils/firebaseSync';

/**
 * Owns the application database state: local persistence and real-time Firestore sync.
 *
 * - `database`: current sanitized state, seeded from localStorage.
 * - `setDatabase`: raw setter, for callers that persist/sync on their own.
 * - `mutateDatabase`: applies a user mutation, sanitizing and auto-backing up the result.
 */
export function useKlabinDatabase() {
  const [database, setDatabase] = useState<KlabinDatabase>(() => loadDatabase());

  const databaseRef = useRef(database);
  databaseRef.current = database;

  // Persist locally whenever state changes (without triggering auto-backup on mount/reload/snapshots)
  useEffect(() => {
    saveDatabase(database, { createBackup: false });
  }, [database]);

  // Helper for applying user mutations. The state updater stays pure: the
  // primary localStorage write is handled by the effect above on every change.
  // Auto-backup is fired here (throttled inside createAutoBackup) and off the
  // click, so a status toggle no longer serializes the whole DB synchronously.
  const mutateDatabase = (updater: (prev: KlabinDatabase) => KlabinDatabase) => {
    // Compute from the latest committed/mutated value ourselves instead of
    // putting the updater inside React's queue. Domain handlers may need the
    // record produced by the mutation immediately to mirror it to Firestore;
    // React is free to defer a setState updater, which previously made those
    // handlers occasionally skip their cloud write.
    const next = sanitizeDatabase(updater(databaseRef.current));
    databaseRef.current = next;
    setDatabase(next);
    setTimeout(() => createAutoBackup(next), 0);
    return next;
  };

  // Auth gates synchronization; without configuration/session the app stays local.
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let unsubscribe = () => {};
    let activeUser: string | null = null;
    const stopAuth = onFirebaseUser((user) => {
      const uid = user?.uid ?? null;
      if (uid === activeUser) return;
      unsubscribe();
      unsubscribe = () => {};
      activeUser = uid;
      if (!user) return;
      // Seed first: if the cloud is genuinely empty, the complete local database
      // must be uploaded before retrying individual queued records. Running both
      // checks concurrently could make one queued document render the cloud
      // non-empty and prevent the remaining local records from being seeded.
      checkAndSeedFirestoreIfEmpty(databaseRef.current)
        .catch((err) => {
          console.warn('[Firestore] Inicialização:', err);
        })
        .then(() => flushPendingFirestoreUpserts())
        .catch((err) => {
          console.warn('[Firestore] Reenvio de alterações locais pendentes:', err);
        });

      unsubscribe = subscribeToFirestore((collectionKey, data) => {
        if (activeUser !== uid) return;
        setDatabase((prev) => {
          if (collectionKey === 'Settings') {
            const updated = {
              ...prev,
              appSettings: data.appSettings !== undefined ? data.appSettings : prev.appSettings,
              customLogo: data.customLogo !== undefined ? data.customLogo : prev.customLogo,
            };
            return sanitizeDatabase(updated);
          }

          const updated = {
            ...prev,
            [collectionKey]: data,
          };
          return sanitizeDatabase(updated);
        });
      });
    });
    return () => { activeUser = null; stopAuth(); unsubscribe(); };
  }, []);

  return { database, setDatabase, mutateDatabase };
}
