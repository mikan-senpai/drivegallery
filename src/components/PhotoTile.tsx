import React from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { radius } from '@/theme/tokens';
import { formatDuration } from '@/lib/format';
import type { MediaItem } from '@/lib/types';

interface Props {
  item: MediaItem;
  size: number;
  onPress: (item: MediaItem) => void;
}

function PhotoTileBase({ item, size, onPress }: Props) {
  return (
    <Pressable onPress={() => onPress(item)} style={{ width: size, height: size, padding: 2.5 }}>
      <View style={styles.inner}>
        <Image
          source={item.thumbnailUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={160}
          recyclingKey={item.id}
        />
        <Feather name="cloud" size={13} color="rgba(255,255,255,0.92)" style={styles.cloud} />
        {item.kind === 'video' && item.durationMs != null && (
          <Text style={styles.badge}>{`▶ ${formatDuration(item.durationMs)}`}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.12)' },
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
});

export const PhotoTile = React.memo(PhotoTileBase);
