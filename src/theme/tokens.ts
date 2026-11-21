/**
 * Twilight Stillness design tokens — Paper (light) + Twilight (dark).
 * Single source of truth for color, radius, spacing, and type.
 */

export type ThemeName = 'paper' | 'twilight';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  fg: string;
  fgVariant: string;
  primary: string;
  onPrimary: string;
  accent: string;
  border: string;
  bar: string;
  /** Liquid-glass tint: light enough that the blur behind stays visible. */
  glass: string;
  destructive: string;
}

export const palettes: Record<ThemeName, Palette> = {
  paper: {
    bg: '#faf8f3',
    surface: '#ffffff',
    surfaceAlt: '#ece7dc',
    fg: '#2a2824',
    fgVariant: '#8a8276',
    primary: '#9c8a6b',
    onPrimary: '#ffffff',
    accent: '#8c9a8d',
    border: 'rgba(42,40,36,0.12)',
    bar: 'rgba(250,248,243,0.7)',
    glass: 'rgba(255,255,255,0.1)',
    destructive: '#7f1d1d',
  },
  twilight: {
    bg: '#151413',
    surface: '#1f1e1d',
    surfaceAlt: '#2a2927',
    fg: '#eae6db',
    fgVariant: '#9a9893',
    primary: '#c9bba5',
    onPrimary: '#151413',
    accent: '#8c9a8d',
    border: 'rgba(234,230,219,0.14)',
    bar: 'rgba(21,20,19,0.72)',
    glass: 'rgba(32,30,28,0.28)',
    destructive: '#7f1d1d',
  },
};

export const radius = {
  sm: 16,
  md: 22,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  gutter: 24,
  section: 40,
} as const;

/** Font family keys map to loaded @expo-google-fonts faces. */
export const fonts = {
  serif: 'Lora_400Regular',
  serifMedium: 'Lora_500Medium',
  body: 'Outfit_300Light',
  bodyRegular: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
} as const;

export const type = {
  displayMd: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36 },
  headlineLg: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, letterSpacing: 0.24 },
  headlineSm: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 24 },
  bodyMd: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  bodySm: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  label: { fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 18, letterSpacing: 0.26 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  uppercase: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
  },
} as const;
