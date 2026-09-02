const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  googleSignIn: () => ipcRenderer.invoke('google-sign-in'),
  googleRestoreSession: () => ipcRenderer.invoke('google-restore-session'),
  googleClearSession: () => ipcRenderer.invoke('google-clear-session'),
});
