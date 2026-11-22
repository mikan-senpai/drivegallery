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
    glass: 'rgba(128,128,128,0.16)',
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
    glass: 'rgba(128,128,128,0.16)',
    destructive: '#7f1d1d',
  },
};

/**
 * Frosted-glass material: tier 2 of the glass UI spec (glass-ui-design.md,
 * sections 4 and 5). Blur, tint, rim and shadow. The edge refraction of tier 3
 * needs a shader on the backdrop, which this app does not have.
 */
export const glass = {
  /** Backdrop blur in dp. Wider than the spec's 8 because no lens breaks up the text behind. */
  blurRadius: 16,
  /** Body colour of the slab, as RGB so its opacity can be shared with expo-blur's own tint. */
  tint: { paper: '250,250,250', twilight: '18,18,18' } satisfies Record<ThemeName, string>,
  tintOpacity: 0.4,
  /**
   * The spec's rim is white at 50%, lit from 45°, which a shader spreads from
   * 0 to 50% around the edge. Without one this is the value a straight edge
   * gets (50% × cos 45°), drawn evenly.
   */
  rim: { width: 0.5, color: 'rgba(255,255,255,0.35)' },
  shadow: { offsetY: 4, blurRadius: 24, color: 'rgba(0,0,0,0.10)' },
  /** Selected-item pill on a glass bar: a bright lift in both themes. */
  indicator: {
    paper: 'rgba(255,255,255,0.5)',
    twilight: 'rgba(255,255,255,0.14)',
  } satisfies Record<ThemeName, string>,
} as const;

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
