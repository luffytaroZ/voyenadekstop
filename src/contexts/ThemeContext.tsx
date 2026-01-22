import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { settingsCommands } from '../services/tauriCommands';
import type { Theme } from '../types';

type EffectiveTheme = 'light' | 'dark' | 'sepia' | 'high-contrast';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: EffectiveTheme;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_SETTING = 'theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from store on mount
  useEffect(() => {
    (async () => {
      try {
        const storedTheme = await settingsCommands.get(THEME_SETTING);
        if (storedTheme && ['light', 'dark', 'sepia', 'high-contrast', 'system'].includes(storedTheme)) {
          setThemeState(storedTheme as Theme);
        }
      } catch (error) {
        console.error('[Theme] Failed to load:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      await settingsCommands.set(THEME_SETTING, newTheme);
    } catch (error) {
      console.error('[Theme] Failed to save:', error);
    }
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      let resolved: EffectiveTheme = 'dark';

      if (theme === 'system') {
        resolved = getSystemTheme();
      } else {
        resolved = theme;
      }

      setEffectiveTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const newTheme = e.matches ? 'dark' : 'light';
        setEffectiveTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme, isLoading }}>
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
