import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

const rawConfig = firebaseConfigJson as Record<string, any>;
const firebaseConfig = {
  apiKey: rawConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: rawConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: rawConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: rawConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: rawConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: rawConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID,
};

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
];

let authInstance: Auth | null = null;

export const getFirebaseAuth = (): Auth | null => {
  if (typeof window === 'undefined') return null;
  if (!authInstance) {
    try {
      const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      authInstance = getAuth(app);
    } catch (e) {
      console.warn('[GoogleAuth] Failed to initialize Firebase Auth:', e);
      return null;
    }
  }
  return authInstance;
};

export const getGoogleAuthProvider = (): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  GOOGLE_DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
};

// Observe Firebase independently of the short-lived Drive access token.
export const onFirebaseUser = (callback: (user: User | null) => void): (() => void) => {
  const auth = getFirebaseAuth();
  if (!auth) { callback(null); return () => {}; }
  return onAuthStateChanged(auth, callback);
};

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;
// Guards the one-shot silent session restore per app run
let restorePromise: Promise<void> | null = null;

/**
 * Silently restores a previously persisted Google Drive session (desktop only).
 * The refresh_token lives encrypted in the Electron main process; here we just
 * ask it for a fresh access_token and re-hydrate Firebase auth so every
 * component subscribed via initAuth() sees the user as connected — no
 * interactive login. Safe to call multiple times: it runs at most once.
 */
export const restoreGoogleSession = (): Promise<void> => {
  if (restorePromise) return restorePromise;

  if (typeof window === 'undefined' || !window.electron?.googleRestoreSession) {
    restorePromise = Promise.resolve();
    return restorePromise;
  }

  // Set synchronously so initAuth()'s onAuthStateChanged listener does not fire
  // a premature onAuthFailure() while the async restore is still in flight.
  isSigningIn = true;

  restorePromise = (async () => {
    try {
      const auth = getFirebaseAuth();
      if (!auth || cachedAccessToken) return;

      const session = await window.electron!.googleRestoreSession();
      if (!session?.accessToken) return;

      cachedAccessToken = session.accessToken;
      const credential = GoogleAuthProvider.credential(session.idToken ?? null, session.accessToken);
      const result = await signInWithCredential(auth, credential);
      cachedUser = result.user;
    } catch (err) {
      cachedAccessToken = null;
      console.warn('[GoogleAuth] Falha ao restaurar sessão persistente do Google Drive:', err);
    } finally {
      isSigningIn = false;
    }
  })();

  return restorePromise;
};

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      if (onAuthFailure) onAuthFailure();
      return () => {};
    }

    // Kick off the one-shot silent reconnect (persistent login). When it
    // succeeds, signInWithCredential re-triggers the listener below with
    // cachedAccessToken populated, so onAuthSuccess fires normally.
    void restoreGoogleSession();

    return onAuthStateChanged(auth, async (user: User | null) => {
      cachedUser = user;
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          // User is logged in to Firebase but we need to prompt or refresh token for Drive access
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  } catch (err) {
    console.warn('[GoogleAuth] Error in initAuth:', err);
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Serviço de autenticação não disponível ou não configurado');
  }
  if (!window.electron?.googleSignIn) {
    throw new Error('Login com Google Drive só está disponível no aplicativo desktop.');
  }

  try {
    isSigningIn = true;
    const { idToken, accessToken } = await window.electron.googleSignIn();

    // Set before awaiting signInWithCredential: that call is what triggers Firebase's
    // onAuthStateChanged internally, and components subscribed via initAuth() (e.g.
    // GoogleDriveExplorer.tsx, independently of Header.tsx) read cachedAccessToken
    // synchronously inside that callback. Assigning it after the await left a race
    // where the listener could fire while cachedAccessToken was still null, silently
    // skipping both onAuthSuccess and onAuthFailure and leaving that component stuck
    // signed-out forever.
    cachedAccessToken = accessToken;
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(auth, credential);

    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    cachedAccessToken = null;
    // Gracefully handle normal user actions like closing the browser tab or denying consent
    if (error?.message?.includes('cancelado') || error?.message?.includes('Tempo esgotado')) {
      return null;
    }
    console.error('[GoogleAuth] Erro no login:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentGoogleUser = (): User | null => {
  if (cachedUser) return cachedUser;
  try {
    const auth = getFirebaseAuth();
    return auth?.currentUser || null;
  } catch {
    return null;
  }
};

export const googleSignOut = async (): Promise<void> => {
  // Manual logout only: drop the persisted refresh_token so the app stops
  // auto-reconnecting on the next launch.
  try {
    await window.electron?.googleClearSession?.();
  } catch (e) {
    console.warn('[GoogleAuth] Erro ao limpar sessão persistente:', e);
  }
  try {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
  } catch (e) {
    console.warn('[GoogleAuth] Erro ao fazer logout:', e);
  } finally {
    cachedAccessToken = null;
    cachedUser = null;
    restorePromise = null;
  }
};
