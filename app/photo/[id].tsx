import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMediaItems } from '@/hooks/useMedia';
import { trashItem } from '@/lib/drive';
import { useSession } from '@/store/session';
import { formatBytes, formatDate } from '@/lib/format';
import { type as typeTokens } from '@/theme/tokens';

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function Viewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const demoMode = useSession((s) => s.demoMode);
  const { items } = useMediaItems();
  const item = useMemo(() => items.find((i) => i.id === id), [items, id]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomed = scale.value > 1;
      scale.value = withTiming(zoomed ? 1 : 2.5);
      savedScale.value = zoomed ? 1 : 2.5;
      if (zoomed) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = e.translationX;
        ty.value = e.translationY;
      }
    })
    .onEnd(() => {
      tx.value = withTiming(0);
      ty.value = withTiming(0);
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const onRemove = () => {
    Alert.alert('Remove from Drive', 'Moves this item to Google Drive Trash. You can restore it from Drive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to Trash',
        style: 'destructive',
        onPress: async () => {
          if (demoMode) return router.back();
          try {
            await trashItem(id);
            router.back();
          } catch (e) {
            Alert.alert('Could not remove', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const info = () =>
    item &&
    Alert.alert(
      item.name,
      [
        formatDate(item.takenAt),
        formatBytes(item.sizeBytes),
        item.width && item.height ? `${item.width} × ${item.height}` : null,
      ]
        .filter(Boolean)
        .join('  ·  ')
    );

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <AnimatedImage source={item?.thumbnailUrl} style={[styles.image, imageStyle]} contentFit="contain" transition={120} />
      </GestureDetector>

      <SafeAreaView style={styles.top} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color="#fff" />
        </Pressable>
        <View style={styles.chip}>
          <Feather name="cloud" size={12} color="#fff" />
          <Text style={styles.chipText}>In Drive · {formatBytes(item?.sizeBytes)}</Text>
        </View>
        <Feather name="more-vertical" size={22} color="#fff" />
      </SafeAreaView>

      <SafeAreaView style={styles.bottom} pointerEvents="box-none">
        <Action icon="share" label="Share" onPress={() => Alert.alert('Share', 'Native share sheet (stub).')} />
        <Action icon="heart" label="Favorite" onPress={() => Alert.alert('Favorite', 'Toggled (stub).')} />
        <Action icon="info" label="Info" onPress={info} />
        <Action icon="trash-2" label="Remove" onPress={onRemove} />
      </SafeAreaView>
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.action} hitSlop={8}>
      <Feather name={icon} size={20} color="#fff" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  image: { flex: 1 },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  chipText: { ...typeTokens.uppercase, color: '#fff' },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  action: { alignItems: 'center', gap: 5 },
  actionLabel: { color: '#fff', fontSize: 10, fontFamily: 'Outfit_300Light' },
});
