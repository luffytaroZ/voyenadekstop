import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Theme
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChange: (callback: (theme: 'dark' | 'light') => void) => {
    ipcRenderer.on('theme-changed', (_, theme) => callback(theme));
  },

  // Persistent storage
  store: {
    get: (key: string) => ipcRenderer.invoke('store-get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store-set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store-delete', key),
  },

  // Platform info
  platform: process.platform,

  // App info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});

// Type declarations for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getTheme: () => Promise<'dark' | 'light'>;
      onThemeChange: (callback: (theme: 'dark' | 'light') => void) => void;
      store: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
      };
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
    };
  }
}
