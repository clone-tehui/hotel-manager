'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { buildTheme, DEFAULT_APPEARANCE, THEME_PRESETS, type AppearanceSettings } from '@/theme/theme';

interface AppearanceContextValue {
  appearance: AppearanceSettings;
  setAppearance: (next: Partial<AppearanceSettings>) => void;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => undefined,
});

const STORAGE_KEY = 'hotel_theme_settings';
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function normalize(input?: Record<string, any>): AppearanceSettings {
  return {
    app_display_name: input?.app_display_name || DEFAULT_APPEARANCE.app_display_name,
    system_logo_url: input?.system_logo_url || DEFAULT_APPEARANCE.system_logo_url,
    admin_avatar_url: input?.admin_avatar_url || DEFAULT_APPEARANCE.admin_avatar_url,
    theme_mode: input?.theme_mode === 'light' ? 'light' : 'dark',
    theme_primary_color: input?.theme_primary_color || DEFAULT_APPEARANCE.theme_primary_color || THEME_PRESETS[0].primary,
    theme_radius: String(input?.theme_radius || DEFAULT_APPEARANCE.theme_radius),
  };
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) setAppearanceState(normalize(JSON.parse(cached)));
    } catch {}

    const token = localStorage.getItem('hotel_token');
    if (!token) return;

    fetch(`${BASE}/api/system/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('settings fetch failed');
        return res.json();
      })
      .then((payload) => {
        const next = normalize(payload?.data);
        setAppearanceState(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      })
      .catch(() => undefined);
  }, []);

  const setAppearance = (next: Partial<AppearanceSettings>) => {
    setAppearanceState((prev) => {
      const merged = normalize({ ...prev, ...next });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  const theme = useMemo(() => buildTheme(appearance), [appearance]);
  const value = useMemo(() => ({ appearance, setAppearance }), [appearance]);

  return (
    <AppearanceContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppearanceContext.Provider>
  );
}

export const useAppearance = () => useContext(AppearanceContext);
