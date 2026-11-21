import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorageFallback from '@/lib/persist';
import { palettes, type Palette, type ThemeName } from './tokens';

export type ThemePreference = ThemeName | 'system';

interface ThemeContextValue {
  palette: Palette;
  name: ThemeName;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'theme.preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('paper');

  useEffect(() => {
    AsyncStorageFallback.getItem(STORAGE_KEY).then((v) => {
      if (v === 'paper' || v === 'twilight' || v === 'system') setPreferenceState(v);
    });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    void AsyncStorageFallback.setItem(STORAGE_KEY, p);
  }, []);

  const name: ThemeName =
    preference === 'system' ? (system === 'dark' ? 'twilight' : 'paper') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ palette: palettes[name], name, preference, setPreference }),
    [name, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
