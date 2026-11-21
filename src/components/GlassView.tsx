/**
 * Liquid-glass surface (Apple-style approximation).
 *
 * Layers, bottom → top: background blur, a light theme tint, a top specular
 * sheen, the content, a soft bottom edge glow, then a bright rim. Native iOS 26
 * Liquid Glass isn't exposed through Expo yet; this reproduces the look with
 * expo-blur + expo-linear-gradient.
 *
 * Android: pass `blurTarget` (see BlurTarget.tsx) for a real blur. Without it
 * Android falls back to the tint only, so use it for glass that floats OUTSIDE
 * the blurred content.
 */
import React from 'react';
import type { BlurTargetRef } from '@/theme/BlurTarget';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  blurTarget?: BlurTargetRef | null;
}

export function GlassView({ children, style, radius = 28, intensity = 80, blurTarget }: Props) {
  const { name, palette } = useTheme();
  const dark = name === 'twilight';

  const tint: BlurTint =
    Platform.OS === 'ios' ? (dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight') : dark ? 'dark' : 'light';

  const androidBlur = Platform.OS === 'android' && blurTarget;

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        blurMethod={androidBlur ? 'dimezisBlurView' : 'none'}
        blurTarget={androidBlur ? blurTarget : undefined}
        blurReductionFactor={2.5}
        style={StyleSheet.absoluteFill}
      />
      {/* Light tint — low opacity so the blurred content shows through. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass }]} pointerEvents="none" />
      {/* Top specular sheen. */}
      <LinearGradient
        colors={dark ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.45 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
      {/* Soft bottom edge glow — the "refraction" lip liquid glass has. */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.14)']}
        start={{ x: 0, y: 0.6 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Bright rim. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor: dark ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.9)',
          },
        ]}
      />
    </View>
  );
}
