import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import type { ThemePreference } from '@/theme/ThemeProvider';
import { useSession } from '@/store/session';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'paper', label: 'Paper' },
  { key: 'twilight', label: 'Twilight' },
  { key: 'system', label: 'System' },
];

export default function Settings() {
  const { palette, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { email, demoMode, disconnect } = useSession();

  const onDisconnect = () => {
    Alert.alert('Disconnect', 'This clears the local index and signs you out of Drive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await disconnect();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <ScreenHeader title="You" subtitle={email ?? undefined} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 110, gap: spacing.lg }}>
        <Section title="Appearance" palette={palette}>
          <View style={[styles.segment, { backgroundColor: palette.surfaceAlt }]}>
            {THEME_OPTIONS.map((o) => {
              const active = o.key === preference;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => setPreference(o.key)}
                  style={[styles.segItem, active && { backgroundColor: palette.primary }]}
                >
                  <Text style={[type.label, { color: active ? palette.onPrimary : palette.fgVariant }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Storage" palette={palette}>
          <Row palette={palette} icon="trash-2" label="Clear thumbnail cache" onPress={() => Alert.alert('Cache', 'Thumbnail cache cleared.')} />
        </Section>

        <Section title="Account" palette={palette}>
          {demoMode ? (
            <Row palette={palette} icon="log-in" label="Connect real Drive" onPress={() => router.replace('/')} />
          ) : (
            <Row palette={palette} icon="log-out" label="Disconnect" destructive onPress={onDisconnect} />
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, palette, children }: { title: string; palette: any; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[type.uppercase, { color: palette.fgVariant, marginLeft: 4 }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  palette,
  icon,
  label,
  onPress,
  destructive,
}: {
  palette: any;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? palette.destructive : palette.fg;
  return (
    <Pressable onPress={onPress} style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Feather name={icon} size={18} color={color} />
      <Text style={[type.bodyMd, { color, flex: 1 }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={palette.fgVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.full },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.full },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
