import { alpha, createTheme } from '@mui/material/styles';

export type ThemeModeSetting = 'dark' | 'light';

export interface AppearanceSettings {
  app_display_name: string;
  system_logo_url: string;
  admin_avatar_url: string;
  theme_mode: ThemeModeSetting;
  theme_primary_color: string;
  theme_radius: string;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  app_display_name: 'Opera Residences',
  system_logo_url: '',
  admin_avatar_url: '',
  theme_mode: 'dark',
  theme_primary_color: '#C8A96B',
  theme_radius: '22',
};

export const THEME_PRESETS = [
  { id: 'obsidian-gold', label: 'Obsidian Gold', primary: '#C8A96B', secondary: '#F4E6C3', lightBg: '#F8F4EC', darkBg: '#0D0A08' },
  { id: 'arctic-glass', label: 'Arctic Glass', primary: '#86A9D6', secondary: '#EAF4FF', lightBg: '#F5FAFF', darkBg: '#0B1220' },
  { id: 'royal-emerald', label: 'Royal Emerald', primary: '#1E7A63', secondary: '#D9C07D', lightBg: '#F4F7F1', darkBg: '#07140F' },
  { id: 'midnight-sapphire', label: 'Midnight Sapphire', primary: '#4F79FF', secondary: '#DCE7FF', lightBg: '#F4F7FF', darkBg: '#081120' },
  { id: 'sandstone-luxury', label: 'Sandstone Luxury', primary: '#B88C5A', secondary: '#FFF0DA', lightBg: '#FBF5ED', darkBg: '#17110B' },
  { id: 'rose-platinum', label: 'Rose Platinum', primary: '#B98FA0', secondary: '#F8E7EE', lightBg: '#FCF7F9', darkBg: '#151013' },
] as const;

function toRadius(value?: string) {
  const raw = (value || DEFAULT_APPEARANCE.theme_radius).trim().toLowerCase();
  if (raw === 'small') return 16;
  if (raw === 'medium') return 22;
  if (raw === 'large') return 28;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 22;
}

function findPreset(primary?: string) {
  return THEME_PRESETS.find((preset) => preset.primary.toLowerCase() === (primary || '').toLowerCase()) || THEME_PRESETS[0];
}

export function buildTheme(partial?: Partial<AppearanceSettings>) {
  const settings = { ...DEFAULT_APPEARANCE, ...partial };
  const mode: 'light' | 'dark' = settings.theme_mode === 'light' ? 'light' : 'dark';
  const radius = toRadius(settings.theme_radius);
  const preset = findPreset(settings.theme_primary_color);
  const isLight = mode === 'light';

  const palette = isLight
    ? {
        mode,
        primary: { main: preset.primary, light: alpha(preset.primary, 0.8), dark: '#1F2937', contrastText: '#FFFFFF' },
        secondary: { main: preset.secondary, light: '#FFFFFF', dark: preset.primary, contrastText: '#1B1B1B' },
        success: { main: '#1F8A5B', contrastText: '#FFFFFF' },
        warning: { main: '#C47A2C', contrastText: '#FFFFFF' },
        error: { main: '#CC4E4E', contrastText: '#FFFFFF' },
        background: { default: preset.lightBg, paper: alpha('#FFFFFF', 0.78) },
        text: { primary: '#1A1A1A', secondary: 'rgba(32,32,32,0.68)' },
        divider: 'rgba(24, 24, 27, 0.10)',
      }
    : {
        mode,
        primary: { main: preset.primary, light: preset.secondary, dark: '#8B6A35', contrastText: '#FFFFFF' },
        secondary: { main: preset.secondary, light: '#FFF9F0', dark: preset.primary, contrastText: '#151515' },
        success: { main: '#5DC28E', contrastText: '#08120D' },
        warning: { main: '#E8B15F', contrastText: '#24190A' },
        error: { main: '#F07A7A', contrastText: '#2A0D0D' },
        background: { default: preset.darkBg, paper: alpha('#FFFFFF', 0.06) },
        text: { primary: '#F6F1E8', secondary: 'rgba(246,241,232,0.72)' },
        divider: 'rgba(255,255,255,0.10)',
      };

  const tokens = {
    bgPrimary: isLight ? preset.lightBg : preset.darkBg,
    bgSecondary: isLight ? alpha('#FFFFFF', 0.68) : alpha('#FFFFFF', 0.035),
    surfaceGlass: isLight ? alpha('#FFFFFF', 0.62) : alpha('#FFFFFF', 0.065),
    surfaceElevated: isLight ? alpha('#FFFFFF', 0.84) : alpha('#FFFFFF', 0.09),
    surfaceStrong: isLight ? '#FFFFFF' : alpha('#FFFFFF', 0.12),
    popupSurface: isLight ? '#FFFFFF' : '#111827',
    popupSurfaceSoft: isLight ? '#FFFFFF' : '#0F172A',
    textPrimary: palette.text.primary,
    textSecondary: palette.text.secondary,
    textMuted: isLight ? 'rgba(40,40,40,0.52)' : 'rgba(246,241,232,0.52)',
    accentPrimary: preset.primary,
    accentHover: alpha(preset.primary, isLight ? 0.16 : 0.24),
    accentSoft: alpha(preset.primary, isLight ? 0.10 : 0.18),
    borderSoft: isLight ? 'rgba(20,20,24,0.08)' : 'rgba(255,255,255,0.08)',
    borderStrong: isLight ? 'rgba(20,20,24,0.14)' : 'rgba(255,255,255,0.14)',
    shadowLuxury: isLight ? '0 22px 60px rgba(15, 23, 42, 0.14)' : '0 24px 80px rgba(0, 0, 0, 0.42)',
    shadowSoft: isLight ? '0 12px 30px rgba(15, 23, 42, 0.08)' : '0 14px 30px rgba(0, 0, 0, 0.24)',
    glow: alpha(preset.primary, isLight ? 0.14 : 0.22),
  };

  return createTheme({
    breakpoints: {
      values: { xs: 0, sm: 600, md: 768, lg: 1024, xl: 1440 },
    },
    palette,
    shape: { borderRadius: radius },
    typography: {
      fontFamily: '"Inter", "SF Pro Display", "SF Pro Text", "Roboto", sans-serif',
      h1: { fontWeight: 700, color: palette.text.primary, letterSpacing: '-0.03em' },
      h2: { fontWeight: 700, color: palette.text.primary, letterSpacing: '-0.028em' },
      h3: { fontWeight: 700, color: palette.text.primary, letterSpacing: '-0.022em' },
      h4: { fontWeight: 700, color: palette.text.primary, letterSpacing: '-0.02em' },
      h5: { fontWeight: 650, color: palette.text.primary, letterSpacing: '-0.018em' },
      h6: { fontWeight: 650, color: palette.text.primary, letterSpacing: '-0.015em' },
      subtitle1: { fontWeight: 650, color: palette.text.primary },
      subtitle2: { fontWeight: 600, color: palette.text.primary, letterSpacing: '0.01em' },
      body1: { color: palette.text.primary, fontSize: '0.975rem', lineHeight: 1.7 },
      body2: { color: palette.text.primary, fontSize: '0.92rem', lineHeight: 1.65 },
      caption: { color: palette.text.secondary, lineHeight: 1.55 },
      button: { fontWeight: 650, fontSize: '0.94rem', letterSpacing: '-0.01em', textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--bg-primary': tokens.bgPrimary,
            '--bg-secondary': tokens.bgSecondary,
            '--surface-glass': tokens.surfaceGlass,
            '--surface-elevated': tokens.surfaceElevated,
            '--surface-strong': tokens.surfaceStrong,
            '--text-primary': tokens.textPrimary,
            '--text-secondary': tokens.textSecondary,
            '--text-muted': tokens.textMuted,
            '--accent-primary': tokens.accentPrimary,
            '--accent-hover': tokens.accentHover,
            '--accent-soft': tokens.accentSoft,
            '--border-soft': tokens.borderSoft,
            '--border-strong': tokens.borderStrong,
            '--shadow-luxury': tokens.shadowLuxury,
            '--shadow-soft': tokens.shadowSoft,
            '--glow-luxury': tokens.glow,
          },
          'html, body': {
            background: `radial-gradient(circle at top left, ${alpha(preset.primary, isLight ? 0.08 : 0.18)} 0%, transparent 28%), radial-gradient(circle at top right, ${alpha(preset.secondary, isLight ? 0.16 : 0.12)} 0%, transparent 24%), ${tokens.bgPrimary}`,
            color: tokens.textPrimary,
            minHeight: '100%',
          },
          body: {
            color: tokens.textPrimary,
          },
          '*': { boxSizing: 'border-box' },
          '::-webkit-scrollbar': { width: 10, height: 10 },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '::-webkit-scrollbar-thumb': {
            background: alpha(preset.primary, isLight ? 0.24 : 0.30),
            borderRadius: 999,
            border: '2px solid transparent',
            backgroundClip: 'padding-box',
          },
          a: { color: 'inherit' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: tokens.surfaceGlass,
            color: tokens.textPrimary,
            border: `1px solid ${tokens.borderSoft}`,
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
          },
          rounded: { borderRadius: radius },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
            backgroundColor: tokens.surfaceGlass,
            border: `1px solid ${tokens.borderSoft}`,
            boxShadow: '0 14px 32px rgba(15, 23, 42, 0.10)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: alpha(isLight ? '#FFFFFF' : '#080808', isLight ? 0.92 : 0.94),
            color: tokens.textPrimary,
            borderBottom: `1px solid ${tokens.borderSoft}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: tokens.popupSurfaceSoft,
            borderRight: `1px solid ${tokens.borderSoft}`,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
            color: tokens.textPrimary,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 46,
            paddingInline: 18,
            borderRadius: Math.max(16, radius - 2),
            boxShadow: 'none',
            transition: 'background-color .18s ease, border-color .18s ease, box-shadow .18s ease',
            '&:hover': { boxShadow: 'none' },
          },
          contained: {
            background: `linear-gradient(135deg, ${alpha(preset.primary, 0.96)}, ${preset.primary})`,
            color: palette.primary.contrastText,
          },
          outlined: {
            borderColor: tokens.borderStrong,
            color: tokens.textPrimary,
            backgroundColor: alpha('#FFFFFF', isLight ? 0.36 : 0.03),
            '&:hover': { backgroundColor: tokens.accentSoft, borderColor: alpha(preset.primary, 0.55) },
          },
          text: {
            color: tokens.textPrimary,
            '&:hover': { backgroundColor: alpha(preset.primary, isLight ? 0.08 : 0.14) },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            width: 42,
            height: 42,
            borderRadius: 14,
            color: tokens.textSecondary,
            transition: 'background-color .18s ease, color .18s ease',
            '&:hover': {
              backgroundColor: alpha(preset.primary, isLight ? 0.10 : 0.18),
              color: tokens.textPrimary,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            backgroundColor: alpha('#FFFFFF', isLight ? 0.52 : 0.06),
            color: tokens.textPrimary,
            border: `1px solid ${tokens.borderSoft}`,
            fontWeight: 700,
          },
          outlined: { borderColor: tokens.borderStrong },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            minHeight: 46,
            paddingInline: 14,
            borderRadius: Math.max(16, radius - 4),
            marginBottom: 4,
            color: tokens.textSecondary,
            transition: 'background-color .18s ease, color .18s ease, box-shadow .18s ease',
            '&:hover': {
              backgroundColor: alpha(preset.primary, isLight ? 0.08 : 0.14),
              color: tokens.textPrimary,
            },
            '&.Mui-selected': {
              background: `linear-gradient(135deg, ${alpha(preset.primary, isLight ? 0.18 : 0.22)}, ${alpha(preset.secondary, isLight ? 0.22 : 0.12)})`,
              color: isLight ? '#111111' : '#FFFFFF',
              boxShadow: `inset 0 1px 0 ${alpha('#FFFFFF', 0.14)}, 0 10px 24px ${alpha(preset.primary, isLight ? 0.16 : 0.24)}`,
              '&:hover': { backgroundColor: alpha(preset.primary, isLight ? 0.18 : 0.22) },
            },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: radius,
            border: `1px solid ${tokens.borderSoft}`,
            backgroundColor: alpha('#FFFFFF', isLight ? 0.80 : 0.04),
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${tokens.borderSoft}`,
            color: tokens.textPrimary,
            paddingTop: 14,
            paddingBottom: 14,
          },
          head: {
            backgroundColor: alpha('#FFFFFF', isLight ? 0.44 : 0.05),
            color: tokens.textSecondary,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontSize: '0.72rem',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 48,
            borderRadius: Math.max(16, radius - 4),
            backgroundColor: alpha('#FFFFFF', isLight ? 0.82 : 0.045),
            color: tokens.textPrimary,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.borderSoft },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.borderStrong },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(preset.primary, 0.88),
            },
          },
          input: { paddingTop: 13, paddingBottom: 13 },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: tokens.textSecondary,
            '&.Mui-focused': { color: preset.primary },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: Math.max(22, radius),
            backgroundImage: 'none',
            backgroundColor: tokens.popupSurface,
            boxShadow: '0 16px 36px rgba(15, 23, 42, 0.16)',
            border: `1px solid ${tokens.borderSoft}`,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: tokens.popupSurface,
            border: `1px solid ${tokens.borderSoft}`,
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.16)',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: tokens.popupSurface,
            border: `1px solid ${tokens.borderSoft}`,
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.16)',
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: tokens.popupSurface,
            border: `1px solid ${tokens.borderSoft}`,
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.16)',
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${preset.primary}, ${preset.secondary})`,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            color: tokens.textSecondary,
            minHeight: 52,
            '&.Mui-selected': { color: tokens.textPrimary },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: alpha('#111111', 0.92),
            color: '#FFFFFF',
            borderRadius: 12,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: tokens.borderSoft },
        },
      },
    },
  });
}

const theme = buildTheme();
export default theme;
