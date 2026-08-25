const { app, BrowserWindow } = require('electron');
const path = require('path');

const gotTheLock = app.requestSingleInstanceLock();
let mainWindow = null;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 700,
      title: 'Madeireira Sol Nascente',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    const isDev = !app.isPackaged;
    const startUrl = process.env.ELECTRON_START_URL || (isDev ? 'http://localhost:3000' : null);
    if (startUrl) {
      mainWindow.loadURL(startUrl);
    } else {
      mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
