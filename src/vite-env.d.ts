/// <reference types="vite/client" />

interface GoogleSignInTokens {
  idToken: string;
  accessToken: string;
}

interface GoogleRestoredSession {
  idToken: string | null;
  accessToken: string;
}

interface Window {
  electron?: {
    isElectron: boolean;
    googleSignIn: () => Promise<GoogleSignInTokens>;
    googleRestoreSession: () => Promise<GoogleRestoredSession | null>;
    googleClearSession: () => Promise<boolean>;
  };
}
