/**
 * "Sign in with Google" button following Google's branding guidelines:
 * standard 4-colour G mark, "Sign in with Google" label, Google's light/dark
 * fill and stroke colours, pill shape, system font (Roboto on Android).
 *
 * Plain RN + expo-image (G logo as inline SVG), so it renders in Expo Go too —
 * the library's own GoogleSigninButton would load the native module eagerly.
 */
import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/ThemeProvider';

const G_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
      '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
      '</svg>'
  );

interface Props {
  onPress: () => void;
  busy?: boolean;
}

export function GoogleSignInButton({ onPress, busy }: Props) {
  const { name } = useTheme();
  const dark = name === 'twilight';
  // Google brand colours for the light / dark button variants.
  const colors = dark
    ? { fill: '#131314', stroke: '#8E918F', text: '#E3E3E3' }
    : { fill: '#FFFFFF', stroke: '#747775', text: '#1F1F1F' };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Google"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.fill, borderColor: colors.stroke, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          <Image source={{ uri: G_LOGO }} style={styles.logo} contentFit="contain" />
          <Text style={[styles.label, { color: colors.text }]}>Sign in with Google</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 52,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 20, height: 20 },
  label: { fontSize: 15, fontWeight: '500', letterSpacing: 0.25 },
});
