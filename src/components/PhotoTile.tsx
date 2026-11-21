import React from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDuration } from '@/lib/format';
import { useAuthHeaders } from '@/lib/tokenStore';
import type { MediaItem } from '@/lib/types';

interface Props {
  item: MediaItem;
  size: number;
  onPress: (item: MediaItem) => void;
  onLongPress?: (item: MediaItem) => void;
  /** Grid is in selection mode: show check circles. */
  selecting?: boolean;
  selected?: boolean;
}

/** Below this tile size (dense grids), drop the small overlays — they'd just be noise. */
const COMPACT = 70;

function PhotoTileBase({ item, size, onPress, onLongPress, selecting, selected }: Props) {
  const headers = useAuthHeaders();
  const { palette } = useTheme();
  const compact = size < COMPACT;
  // Corner radius scales down with the tile so dense grids don't look like dots.
  const corner = Math.min(radius.sm, Math.max(4, size * 0.12));

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      delayLongPress={280}
      style={{ width: size, height: size, padding: compact ? 1.5 : 2.5 }}
    >
      <View
        style={[
          styles.inner,
          { borderRadius: corner },
          selected && { transform: [{ scale: 0.86 }], borderWidth: 2, borderColor: palette.primary },
        ]}
      >
        <Image
          // Drive thumbnail URLs rotate every few hours, so cache by file id, not URL.
          source={item.thumbnailUrl ? { uri: item.thumbnailUrl, headers, cacheKey: `${item.id}-grid` } : undefined}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={160}
          recyclingKey={item.id}
        />
        {!compact && !selecting ? (
          <Feather name="cloud" size={13} color="rgba(255,255,255,0.92)" style={styles.cloud} />
        ) : null}
        {!compact && item.kind === 'video' && item.durationMs != null ? (
          <Text style={styles.badge}>{`▶ ${formatDuration(item.durationMs)}`}</Text>
        ) : null}
        {compact && item.kind === 'video' ? (
          <Feather name="play" size={10} color="#fff" style={styles.compactPlay} />
        ) : null}
      </View>

      {selecting ? (
        <View
          style={[
            styles.check,
            compact && styles.checkCompact,
            selected
              ? { backgroundColor: palette.primary, borderColor: palette.primary }
              : { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: '#fff' },
          ]}
        >
          {selected ? <Feather name="check" size={compact ? 10 : 13} color={palette.onPrimary} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.12)' },
  cloud: { position: 'absolute', left: 6, top: 6 },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 5,
    color: '#fff',
    fontSize: 10,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  compactPlay: { position: 'absolute', right: 3, bottom: 3 },
  check: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCompact: { top: 4, left: 4, width: 16, height: 16, borderRadius: 8 },
});

export const PhotoTile = React.memo(PhotoTileBase);
