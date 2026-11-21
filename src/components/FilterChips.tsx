import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';

export type MediaFilter = 'all' | 'photos' | 'videos' | 'favorites';

const OPTIONS: { key: MediaFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'photos', label: 'Photos' },
  { key: 'videos', label: 'Videos' },
  { key: 'favorites', label: 'Favorites' },
];

export function FilterChips({ value, onChange }: { value: MediaFilter; onChange: (f: MediaFilter) => void }) {
  const { palette } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {OPTIONS.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? palette.primary : 'transparent',
                borderColor: active ? 'transparent' : palette.border,
              },
            ]}
          >
            <Text style={[type.label, { color: active ? palette.onPrimary : palette.fgVariant }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexGrow:0 stops the horizontal ScrollView from expanding to fill the column.
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { gap: 7, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, alignItems: 'center' },
  chip: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
