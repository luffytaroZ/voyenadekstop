/// <reference types="vite/client" />

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
