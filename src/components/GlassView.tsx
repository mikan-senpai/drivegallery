/**
 * Liquid-glass surface (Apple iOS 26 style approximation).
 *
 * The look comes from the EDGE, not the fill:
 *  - body: nearly clear — light blur, almost no tint, so colour behind shows through
 *  - outer rim: directional light — brightest on top, softer bottom, faint sides
 *  - inner rim: a faint second line just inside, which reads as a lens edge
 *
 * Native Liquid Glass isn't exposed through Expo yet; this reproduces it with
 * expo-blur + per-side border colours (no extra dependencies).
 *
 * Android: pass `blurTarget` (see BlurTarget.tsx) for a real blur. Without it
 * Android shows the tint only, so use it for glass that floats OUTSIDE the
 * blurred content.
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

  const tint: BlurTint = isAndroid ? (dark ? 'dark' : 'light') : dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight';

  // Edge light. Light theme gets a slightly stronger top so it reads on pale content.
  const rim = dark
    ? { top: 'rgba(255,255,255,0.7)', bottom: 'rgba(255,255,255,0.32)', side: 'rgba(255,255,255,0.18)' }
    : { top: 'rgba(255,255,255,0.95)', bottom: 'rgba(255,255,255,0.55)', side: 'rgba(255,255,255,0.4)' };

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        // Android: intensity also sets an opaque tint (alpha ≈ intensity × 0.7), so keep it
        // low and use the reduction factor for a ~10px blur. iOS: ultra-thin material.
        intensity={isAndroid ? 14 : 40}
        tint={tint}
        blurMethod={androidBlur ? 'dimezisBlurView' : 'none'}
        blurTarget={androidBlur ? blurTarget : undefined}
        blurReductionFactor={1.4}
        style={StyleSheet.absoluteFill}
      />
      {/* Near-clear body tint. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass }]} pointerEvents="none" />
      {/* A whisper of top light — the rim does the real work. */}
      <LinearGradient
        colors={dark ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
      {/* Outer rim: directional light catch. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderTopColor: rim.top,
            borderBottomColor: rim.bottom,
            borderLeftColor: rim.side,
            borderRightColor: rim.side,
          },
        ]}
      />
      {/* Inner rim: faint second line → lens edge. */}
      <View
        pointerEvents="none"
        style={[
          styles.inner,
          {
            borderRadius: Math.max(0, radius - 1),
            borderTopColor: dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.4)',
            borderBottomColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.2)',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderWidth: 1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
