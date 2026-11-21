/**
 * Liquid-glass surface.
 *
 * Modelled on clear "liquid glass" UI: the background stays almost SHARP
 * through the glass — the material is a thin neutral tint, a crisp hairline
 * edge, and slight inner shading at the edges that suggests lens thickness.
 *
 * Not reproduced: true refraction (the background bending at the glass edge).
 * That needs a GPU shader sampling the pixels behind the view — available as
 * native Liquid Glass on iOS 26 (expo-glass-effect) or a custom AGSL module on
 * Android, both requiring a development build.
 *
 * Android: pass `blurTarget` (see BlurTarget.tsx) for the slight softening blur.
 */
import React from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import type { BlurTargetRef } from '@/theme/BlurTarget';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  blurTarget?: BlurTargetRef | null;
}

export function GlassView({ children, style, radius = 28, blurTarget }: Props) {
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
