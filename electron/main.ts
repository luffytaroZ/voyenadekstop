import { app, BrowserWindow, shell, ipcMain, nativeTheme } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize electron-store for persistent storage
const store = new Store();

// Disable GPU acceleration if issues on some Macs
// app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  // Get saved window bounds or use defaults
  const windowBounds = store.get('windowBounds', {
    width: 1200,
    height: 800,
    x: undefined,
    y: undefined,
  }) as { width: number; height: number; x?: number; y?: number };

  mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 800,
    minHeight: 600,
    title: 'Voyena',
    titleBarStyle: 'hiddenInset', // macOS native title bar
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'sidebar', // macOS vibrancy effect
    visualEffectState: 'active',
    backgroundColor: '#00000000', // Transparent for vibrancy
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load the app
  if (isDev) {
    const port = process.env.VITE_PORT || '5173';
    mainWindow.loadURL(`http://localhost:${port}`);
    // mainWindow.webContents.openDevTools(); // Uncomment to debug
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle('store-get', (_, key: string) => {
  return store.get(key);
});

ipcMain.handle('store-set', (_, key: string, value: unknown) => {
  store.set(key, value);
});

ipcMain.handle('store-delete', (_, key: string) => {
  store.delete(key);
});

// Listen for system theme changes
nativeTheme.on('updated', () => {
  mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});
