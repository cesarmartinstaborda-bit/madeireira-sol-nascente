const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  googleSignIn: () => ipcRenderer.invoke('google-sign-in'),
  googleRestoreSession: () => ipcRenderer.invoke('google-restore-session'),
  googleClearSession: () => ipcRenderer.invoke('google-clear-session'),
  // Anexos PDF das cargas (armazenamento local). O renderer não informa caminhos de arquivo:
  // a escolha do PDF e do destino de exportação é feita por diálogos do processo principal.
  attachments: {
    list: (cargaId) => ipcRenderer.invoke('attachments-list', cargaId),
    summary: () => ipcRenderer.invoke('attachments-summary'),
    add: (cargaId) => ipcRenderer.invoke('attachments-add', cargaId),
    open: (cargaId, attachmentId) => ipcRenderer.invoke('attachments-open', cargaId, attachmentId),
    exportCopy: (cargaId, attachmentId) => ipcRenderer.invoke('attachments-export', cargaId, attachmentId),
    remove: (cargaId, attachmentId) => ipcRenderer.invoke('attachments-remove', cargaId, attachmentId),
    removeForCarga: (cargaId) => ipcRenderer.invoke('attachments-remove-carga', cargaId),
  },
});
