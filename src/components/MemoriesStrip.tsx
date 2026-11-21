/** "On this day" cards at the top of Photos. Fixed height so grid row maths stays exact. */
import React from 'react';
import { ScrollView, Pressable, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useAuthHeaders } from '@/lib/tokenStore';
import type { Memory } from '@/lib/memories';

/** Total height the strip occupies in the list (label + cards + spacing). */
export const MEMORIES_H = 214;
const CARD_W = 128;
const CARD_H = 170;

export function MemoriesStrip({ memories, onOpen }: { memories: Memory[]; onOpen: (m: Memory) => void }) {
  const { palette } = useTheme();
  const headers = useAuthHeaders();
  return (
    <View style={styles.wrap}>
      <Text style={[type.uppercase, styles.label, { color: palette.fgVariant }]}>On this day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {memories.map((m) => (
          <Pressable key={m.id} onPress={() => onOpen(m)} style={[styles.card, { backgroundColor: palette.surfaceAlt }]}>
            {m.cover.thumbnailUrl ? (
              <Image
                source={{ uri: m.cover.thumbnailUrl, headers, cacheKey: `${m.cover.id}-grid` }}
                cachePolicy="memory-disk"
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
            ) : null}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.shade} pointerEvents="none" />
            <View style={styles.caption}>
              <Text style={styles.title}>{m.title}</Text>
              <Text style={styles.subtitle}>
                {m.subtitle} · {m.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: MEMORIES_H, paddingTop: spacing.xs },
  label: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  row: { gap: 10, paddingHorizontal: spacing.md },
  card: { width: CARD_W, height: CARD_H, borderRadius: radius.lg, overflow: 'hidden' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  caption: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  title: { color: '#fff', fontFamily: 'Lora_400Regular', fontSize: 16 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: 'Outfit_300Light', fontSize: 11, marginTop: 2 },
});
