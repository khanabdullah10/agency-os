'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // 1. Read existing saved preference from localStorage or system preference
    const savedTheme = localStorage.getItem('madomedia_theme') as Theme | null;
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    } else if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      setThemeState('dark');
      applyTheme('dark');
    } else {
      setThemeState('light');
      applyTheme('light');
    }

    // 2. Listen for storage events across tabs/windows
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'madomedia_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue);
        applyTheme(e.newValue);
      }
    };

    // 3. Custom event for immediate same-window synchronization
    const handleCustomChange = (e: Event) => {
      const custom = e as CustomEvent<Theme>;
      if (custom.detail === 'light' || custom.detail === 'dark') {
        setThemeState(custom.detail);
        applyTheme(custom.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('madomedia_theme_change', handleCustomChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('madomedia_theme_change', handleCustomChange);
    };
  }, []);

  const applyTheme = (t: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem('madomedia_theme', newTheme);
      window.dispatchEvent(
        new CustomEvent('madomedia_theme_change', { detail: newTheme })
      );
    } catch {}
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'light' as Theme,
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return context;
}
