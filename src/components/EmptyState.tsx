import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, type } from '@/theme/tokens';

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  hint?: string;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.wrap}>
      <Feather name={icon} size={30} color={palette.fgVariant} />
      <Text style={[type.headlineSm, { color: palette.fg }]}>{title}</Text>
      {hint ? <Text style={[type.bodySm, styles.hint, { color: palette.fgVariant }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: spacing.sm },
  hint: { textAlign: 'center', maxWidth: 260 },
});
