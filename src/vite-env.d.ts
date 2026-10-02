/// <reference types="vite/client" />

/** Versão do `package.json`, injetada pelo Vite no build. Ausente nos testes. */
declare const __APP_VERSION__: string | undefined;

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
