import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Theme } from '../types';

type EffectiveTheme = 'light' | 'dark' | 'sepia' | 'high-contrast';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: EffectiveTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'voyena:theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as Theme) || 'system';
  });

  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('dark');

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const applyTheme = async () => {
      let resolved: EffectiveTheme = 'dark';

      if (theme === 'system') {
        const systemTheme = await window.electronAPI?.getTheme();
        resolved = systemTheme ?? 'dark';
      } else {
        resolved = theme;
      }

      setEffectiveTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyTheme();

    // Listen for system theme changes
    const handleSystemChange = (newTheme: 'dark' | 'light') => {
      if (theme === 'system') {
        setEffectiveTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };

    window.electronAPI?.onThemeChange(handleSystemChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
