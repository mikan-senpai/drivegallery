import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useSession } from '@/store/session';

const FEATURES = [
  { icon: 'shield' as const, text: 'Read-only access. Revoke anytime from Google.' },
  { icon: 'grid' as const, text: 'Timeline and folder views of your Drive media.' },
  { icon: 'cloud' as const, text: 'Originals never leave Drive — this is a viewer.' },
];

export default function Connect() {
  const { palette } = useTheme();
  const { status, connect, enterDemo } = useSession();
  const [busy, setBusy] = useState(false);

  if (status === 'signedIn') return <Redirect href="/(tabs)" />;

  const onConnect = async () => {
    setBusy(true);
    try {
      await connect();
    } catch (e) {
      Alert.alert('Sign-in failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]}>
      <View style={styles.center}>
        <View style={[styles.logo, { backgroundColor: palette.primary }]}>
          <Feather name="image" size={34} color={palette.onPrimary} />
        </View>
        <Text style={[type.displayMd, { color: palette.fg, marginTop: spacing.sm }]}>DriveGallery</Text>
        <Text style={[type.bodyMd, styles.tagline, { color: palette.fgVariant }]}>
          Your Drive photos, as a gallery.
        </Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View
              key={f.icon}
              style={[styles.feature, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <Feather name={f.icon} size={18} color={palette.primary} />
              <Text style={[type.bodySm, { color: palette.fg, flex: 1 }]}>{f.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.cta, { backgroundColor: palette.primary }]}
          onPress={onConnect}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={palette.onPrimary} />
          ) : (
            <>
              <Feather name="log-in" size={18} color={palette.onPrimary} />
              <Text style={[type.label, { color: palette.onPrimary }]}>Connect Google Drive</Text>
            </>
          )}
        </Pressable>
        <Pressable onPress={enterDemo} hitSlop={10} style={styles.demo}>
          <Text style={[type.caption, { color: palette.fgVariant }]}>Explore with demo photos</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  logo: { width: 72, height: 72, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  tagline: { textAlign: 'center' },
  features: { width: '100%', gap: spacing.sm, marginTop: spacing.lg },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: { paddingBottom: spacing.lg, gap: spacing.md, alignItems: 'center' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    width: '100%',
    paddingVertical: 15,
    borderRadius: radius.full,
  },
  demo: { paddingVertical: 4 },
});
