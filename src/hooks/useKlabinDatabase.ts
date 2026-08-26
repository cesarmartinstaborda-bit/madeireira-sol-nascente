import { useState, useEffect } from 'react';
import { KlabinDatabase } from '../types';
import { loadDatabase, saveDatabase, sanitizeDatabase } from '../utils/storage';
import { subscribeToFirestore, checkAndSeedFirestoreIfEmpty } from '../utils/firebaseSync';

/**
 * Owns the application database state: local persistence and real-time Firestore sync.
 *
 * - `database`: current sanitized state, seeded from localStorage.
 * - `setDatabase`: raw setter, for callers that persist/sync on their own.
 * - `mutateDatabase`: applies a user mutation, sanitizing and auto-backing up the result.
 */
export function useKlabinDatabase() {
  const [database, setDatabase] = useState<KlabinDatabase>(() => loadDatabase());

  // Persist locally whenever state changes (without triggering auto-backup on mount/reload/snapshots)
  useEffect(() => {
    saveDatabase(database, { createBackup: false });
  }, [database]);

  // Helper for applying user mutations with immediate auto-backup trigger
  const mutateDatabase = (updater: (prev: KlabinDatabase) => KlabinDatabase) => {
    setDatabase((prev) => {
      const next = sanitizeDatabase(updater(prev));
      saveDatabase(next, { createBackup: true });
      return next;
    });
  };

  // Real-time Firestore sync with authoritative collections
  useEffect(() => {
    checkAndSeedFirestoreIfEmpty(database).catch((err) => {
      console.warn('[Firestore] Inicialização:', err);
    });

    const unsubscribe = subscribeToFirestore((collectionKey, data) => {
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

    return () => unsubscribe();
  }, []);

  return { database, setDatabase, mutateDatabase };
}
