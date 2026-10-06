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

/** Envelope de resposta da ponte de anexos locais (electron/attachmentsIpc.js). */
type LocalAttachmentResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

interface LocalAttachmentEntry {
  id: string;
  fileName: string;
  sizeBytes: number;
  addedAt: string;
}

interface LocalAttachmentsBridge {
  list: (cargaId: string) => Promise<LocalAttachmentResult<LocalAttachmentEntry[]>>;
  summary: () => Promise<LocalAttachmentResult<Record<string, number>>>;
  add: (cargaId: string) => Promise<
    LocalAttachmentResult<{
      canceled: boolean;
      added: LocalAttachmentEntry[];
      failed: { fileName: string; code: string; message: string }[];
    }>
  >;
  open: (cargaId: string, attachmentId: string) => Promise<LocalAttachmentResult<true>>;
  exportCopy: (
    cargaId: string,
    attachmentId: string
  ) => Promise<LocalAttachmentResult<{ canceled: boolean; path?: string }>>;
  remove: (cargaId: string, attachmentId: string) => Promise<LocalAttachmentResult<true>>;
  removeForCarga: (cargaId: string) => Promise<LocalAttachmentResult<true>>;
}

interface Window {
  electron?: {
    isElectron: boolean;
    googleSignIn: () => Promise<GoogleSignInTokens>;
    googleRestoreSession: () => Promise<GoogleRestoredSession | null>;
    googleClearSession: () => Promise<boolean>;
    attachments?: LocalAttachmentsBridge;
  };
}
