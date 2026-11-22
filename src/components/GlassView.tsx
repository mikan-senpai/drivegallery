/**
 * Glass surface, in two materials.
 *
 * `clear` (the default) is modelled on clear "liquid glass" UI: the background
 * stays almost SHARP through the glass — the material is a thin neutral tint, a
 * crisp hairline edge, and slight inner shading at the edges that suggests lens
 * thickness.
 *
 * `frost` is tier 2 of the glass UI spec (glass-ui-design.md): the background
 * is blurred past legibility under a theme-coloured slab, with a rim and a soft
 * shadow. See `glass` in theme/tokens.ts for its numbers.
 *
 * Not reproduced by either: true refraction (the background bending at the glass
 * edge). That needs a GPU shader sampling the pixels behind the view — available
 * as native Liquid Glass on iOS 26 (expo-glass-effect) or a custom AGSL module on
 * Android, both requiring a development build.
 *
 * Android: pass `blurTarget` (see BlurTarget.tsx) for the blur.
 */
import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  PixelRatio,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { glass } from '@/theme/tokens';
import type { BlurTargetRef } from '@/theme/BlurTarget';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  blurTarget?: BlurTargetRef | null;
  /** `clear` keeps the background nearly sharp; `frost` blurs it past legibility. */
  variant?: 'clear' | 'frost';
}

export function GlassView({ variant = 'clear', ...props }: Props) {
  return variant === 'frost' ? <FrostGlass {...props} /> : <ClearGlass {...props} />;
}

type MaterialProps = Omit<Props, 'variant'>;

function ClearGlass({ children, style, radius = 28, blurTarget }: MaterialProps) {
  const { name, palette } = useTheme();
  const dark = name === 'twilight';
  const isAndroid = Platform.OS === 'android';
  const androidBlur = isAndroid && blurTarget;
  const tint: BlurTint = isAndroid ? 'default' : dark ? 'dark' : 'light';

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        // Barely-there softening (~2–3px). On Android intensity also adds a tint
        // overlay (alpha ≈ intensity × 0.44 for 'default'), so it stays tiny.
        intensity={isAndroid ? 4 : 12}
        tint={tint}
        blurMethod={androidBlur ? 'dimezisBlurView' : 'none'}
        blurTarget={androidBlur ? blurTarget : undefined}
        blurReductionFactor={1.5}
        style={StyleSheet.absoluteFill}
      />
      {/* Neutral grey film: greys out light areas, lifts dark ones — like real glass. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass }]} pointerEvents="none" />
      {/* Edge thickness: faint inner shading at top, faint light at bottom. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.14)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.28 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)']}
        start={{ x: 0, y: 0.72 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
      {/* Crisp hairline edge, a touch brighter on top. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderTopColor: dark ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.7)',
            borderBottomColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.45)',
            borderLeftColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)',
            borderRightColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)',
          },
        ]}
      />
    </View>
  );
}

const IS_ANDROID = Platform.OS === 'android';

/**
 * expo-blur ties blur strength and its own tint overlay to one `intensity`
 * number. Android gets a low intensity so that overlay stays faint and the
 * slab's colour comes from the tokens; its blur radius is then set separately
 * through `blurReductionFactor`. iOS has no such split: half of the system
 * material is about the right blur, and brings most of the tint with it.
 */
const FROST_INTENSITY = IS_ANDROID ? 10 : 50;

/** Alpha of expo-blur's own tint overlay at intensity 100, per its tint tables. */
const LIB_TINT_ALPHA = IS_ANDROID ? { light: 0.78, dark: 0.69 } : { light: 0.78, dark: 0.78 };

/**
 * Android's blur library (Dimezis BlurView 3.x) blurs a downscaled copy of the
 * target, so one unit of its radius covers about this many physical pixels.
 * An assumption from the library's defaults, not measured: tune on a device.
 */
const ANDROID_BLUR_DOWNSCALE = 4;

/** `blurReductionFactor` that turns FROST_INTENSITY into glass.blurRadius dp on Android. */
function androidReductionFactor(): number {
  const libraryRadius = (glass.blurRadius * PixelRatio.get()) / ANDROID_BLUR_DOWNSCALE;
  return FROST_INTENSITY / Math.min(25, Math.max(1, libraryRadius));
}

/** What the slab's own tint layer must add on top of expo-blur's to reach glass.tintOpacity. */
function slabTintOpacity(dark: boolean): number {
  const libraryAlpha = (FROST_INTENSITY / 100) * (dark ? LIB_TINT_ALPHA.dark : LIB_TINT_ALPHA.light);
  return Math.max(0, 1 - (1 - glass.tintOpacity) / (1 - libraryAlpha));
}

/** iOS "Reduce Transparency". Android has no such setting and stays false. */
function useReduceTransparency(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (live) setEnabled(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setEnabled);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return enabled;
}

function FrostGlass({ children, style, radius = 28, blurTarget }: MaterialProps) {
  const { name, palette } = useTheme();
  const dark = name === 'twilight';
  const reduceTransparency = useReduceTransparency();

  // Android blurs only with a target, and only cheaply from API 31. Unblurred
  // content under a 40% tint is not legible, so anything short of a real blur
  // gets the opaque surface instead (tier 0 of the spec).
  const canBlur =
    !IS_ANDROID || (!!blurTarget && typeof Platform.Version === 'number' && Platform.Version >= 31);
  const solid = reduceTransparency || !canBlur;

  const shape: ViewStyle = { borderRadius: radius, borderCurve: 'continuous' };

  return (
    <View style={[shape, styles.frostShadow, style]}>
      <View style={[StyleSheet.absoluteFill, shape, styles.clip]} pointerEvents="none">
        {solid ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.surface }]} />
        ) : (
          <>
            <BlurView
              intensity={FROST_INTENSITY}
              tint={dark ? 'dark' : 'light'}
              blurMethod={IS_ANDROID ? 'dimezisBlurViewSdk31Plus' : 'none'}
              blurTarget={IS_ANDROID && blurTarget ? blurTarget : undefined}
              blurReductionFactor={IS_ANDROID ? androidReductionFactor() : undefined}
              style={[StyleSheet.absoluteFill, shape]}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: `rgba(${glass.tint[name]},${slabTintOpacity(dark)})` },
              ]}
            />
          </>
        )}
      </View>
      {children}
      {/* Rim on glass; the theme's own hairline where the surface is opaque. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          shape,
          { borderWidth: glass.rim.width, borderColor: solid ? palette.border : glass.rim.color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  frostShadow: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: glass.shadow.offsetY,
        blurRadius: glass.shadow.blurRadius,
        spreadDistance: 0,
        color: glass.shadow.color,
      },
    ],
  },
});
