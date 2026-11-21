/**
 * Full-screen slideshow of an album (or the whole library): photos only, slow
 * cross-fade with a gentle Ken Burns zoom, loops. Tap to pause and show
 * controls. Keeps the screen awake while playing.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLockedItems, useMediaItems } from '@/hooks/useMedia';
import { useFavorites } from '@/store/favorites';
import { LOCKED_ALBUM } from '@/store/locked';
import { itemsInAlbum } from '@/lib/albums';
import { useAuthHeaders } from '@/lib/tokenStore';

const SLIDE_MS = 4500;

/** Keeps the screen on; expo-keep-awake is required lazily so older builds just skip it. */
function useKeepScreenOn(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let release: (() => void) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const KA = require('expo-keep-awake') as typeof import('expo-keep-awake');
      void KA.activateKeepAwakeAsync('slideshow');
      release = () => void KA.deactivateKeepAwake('slideshow');
    } catch {
      // Not in this build — the slideshow still works, the screen may just dim.
    }
    return () => release?.();
  }, [on]);
}

export default function Slideshow() {
  const { album, start } = useLocalSearchParams<{ album?: string; start?: string }>();
  const router = useRouter();
  const headers = useAuthHeaders();
  const { items: library } = useMediaItems();
  const locked = useLockedItems(album === LOCKED_ALBUM);
  const [favoritesAtOpen] = useState(() => useFavorites.getState().ids);

  const photos = useMemo(() => {
    const source =
      album === LOCKED_ALBUM ? (locked.data ?? []) : album ? itemsInAlbum(library, album, favoritesAtOpen) : library;
    return source.filter((i) => i.kind === 'photo');
  }, [album, locked.data, library, favoritesAtOpen]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [started, setStarted] = useState(false);

  // Start on the photo the slideshow was opened from.
  if (!started && photos.length) {
    setStarted(true);
    setIndex(Math.max(0, photos.findIndex((p) => p.id === start)));
  }

  useKeepScreenOn(playing);

  useEffect(() => {
    if (!playing || photos.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % photos.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [playing, index, photos.length]);

  // Ken Burns: each slide eases from 1.0 to 1.08 over its time on screen.
  const zoom = useSharedValue(1);
  useEffect(() => {
    zoom.set(1);
    zoom.set(withTiming(1.08, { duration: SLIDE_MS + 900, easing: Easing.out(Easing.quad) }));
  }, [index, zoom]);
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.get() }] }));

  const current = photos[index];
  const next = photos.length > 1 ? photos[(index + 1) % photos.length] : undefined;

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setPlaying((p) => !p)}>
        {current ? (
          <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
            <Image
              source={{ uri: current.previewUrl ?? current.thumbnailUrl, headers, cacheKey: `${current.id}-full` }}
              placeholder={current.thumbnailUrl ? { uri: current.thumbnailUrl, headers, cacheKey: `${current.id}-grid` } : undefined}
              cachePolicy="memory-disk"
              contentFit="contain"
              transition={{ duration: 900, effect: 'cross-dissolve' }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        {/* Preload the next slide off-screen so the cross-fade never waits on the network. */}
        {next ? (
          <Image
            source={{ uri: next.previewUrl ?? next.thumbnailUrl, headers, cacheKey: `${next.id}-full` }}
            cachePolicy="memory-disk"
            style={styles.preload}
          />
        ) : null}
      </Pressable>

      {!playing || !current ? (
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close slideshow">
              <Feather name="x" size={26} color="#fff" />
            </Pressable>
            <Text style={styles.count}>{photos.length ? `${index + 1} / ${photos.length}` : 'No photos to show'}</Text>
            <View style={{ width: 26 }} />
          </View>
          {current ? (
            <Pressable onPress={() => setPlaying(true)} style={styles.play} accessibilityLabel="Resume slideshow">
              <Feather name="play" size={30} color="#fff" style={{ marginLeft: 4 }} />
            </Pressable>
          ) : null}
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  preload: { width: 1, height: 1, opacity: 0, position: 'absolute' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.35)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8 },
  count: { color: '#fff', fontFamily: 'Outfit_400Regular', fontSize: 14, fontVariant: ['tabular-nums'] },
  play: {
    alignSelf: 'center',
    marginBottom: '45%',
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
