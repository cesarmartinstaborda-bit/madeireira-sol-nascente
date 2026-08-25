import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  signInWithPopup,
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

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

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

  try {
    isSigningIn = true;
    const provider = getGoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso Google Drive');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    // Gracefully handle normal user actions like closing the popup window
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.code === 'auth/user-cancelled' ||
      error?.message?.includes('popup-closed-by-user') ||
      error?.message?.includes('cancelled-popup-request')
    ) {
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
  }
};
