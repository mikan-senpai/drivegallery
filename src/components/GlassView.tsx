/**
 * Liquid-glass surface (Apple-style approximation).
 *
 * Layers, bottom → top: background blur, translucent theme tint, a vertical
 * specular sheen, the content, then a bright hairline rim. Native iOS 26
 * Liquid Glass isn't exposed through Expo yet; this reproduces the look with
 * expo-blur + expo-linear-gradient on both platforms.
 */
import React from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
}

export function GlassView({ children, style, radius = 28, intensity = 60 }: Props) {
  const { name, palette } = useTheme();
  const dark = name === 'twilight';

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={intensity}
        tint={dark ? 'dark' : 'light'}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bar }]} pointerEvents="none" />
      <LinearGradient
        colors={dark ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.7 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)',
          },
        ]}
      />
    </View>
  );
}
