/**
 * Liquid-glass video controls (replacing Android's stock player bar):
 * centre play/pause, seek bar you can tap or drag, elapsed / total time, mute.
 * Tap the video to show them; they fade out after a few seconds of playback.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useEvent } from 'expo';
import type { VideoPlayer } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { formatDuration } from '@/lib/format';

const HIDE_AFTER_MS = 3000;

// The player is an imperative native object; these helpers keep its writes in one place.
const setTimeUpdateInterval = (p: VideoPlayer, seconds: number) => {
  p.timeUpdateEventInterval = seconds;
};
const seekPlayer = (p: VideoPlayer, seconds: number) => {
  p.currentTime = seconds;
};
const setMuted = (p: VideoPlayer, muted: boolean) => {
  p.muted = muted;
};

export function VideoControls({ player }: { player: VideoPlayer }) {
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const { duration } = useEvent(player, 'sourceLoad', {
    duration: player.duration,
    videoSource: null,
    availableVideoTracks: [],
    availableSubtitleTracks: [],
    availableAudioTracks: [],
  });

  const [visible, setVisible] = useState(true);
  const [trackW, setTrackW] = useState(1);
  const [scrub, setScrub] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useSharedValue(1);

  useEffect(() => {
    setTimeUpdateInterval(player, 0.25);
  }, [player]);

  // Fade out while playing; stay up while paused or scrubbing.
  useEffect(() => {
    opacity.set(withTiming(visible ? 1 : 0, { duration: 200 }));
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (visible && isPlaying && scrub === null) hideTimer.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [visible, isPlaying, scrub, opacity]);

  const total = duration > 0 ? duration : 0;
  const shown = scrub ?? currentTime;
  const progress = total ? Math.min(1, shown / total) : 0;

  const seekTo = (x: number) => {
    const t = Math.max(0, Math.min(total, (x / trackW) * total));
    setScrub(t);
    return t;
  };
  const commit = (x: number) => {
    seekPlayer(player, seekTo(x));
    setScrub(null);
  };

  const seek = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(seekTo)(e.x);
    })
    .onUpdate((e) => {
      runOnJS(seekTo)(e.x);
    })
    .onEnd((e) => {
      runOnJS(commit)(e.x);
    });

  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible((v) => !v)}>
      <Animated.View style={[StyleSheet.absoluteFill, fade]} pointerEvents={visible ? 'box-none' : 'none'}>
        <View style={styles.center} pointerEvents="box-none">
          <Pressable
            onPress={() => (isPlaying ? player.pause() : player.play())}
            style={styles.bigButton}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Feather name={isPlaying ? 'pause' : 'play'} size={30} color="#fff" style={!isPlaying && { marginLeft: 4 }} />
          </Pressable>
        </View>

        <View style={styles.bar}>
          <Text style={styles.time}>{formatDuration(shown * 1000)}</Text>
          <GestureDetector gesture={seek}>
            <View style={styles.trackHit} onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width || 1)}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress * 100}%` }]} />
              </View>
              <View style={[styles.knob, { left: `${progress * 100}%` }]} />
            </View>
          </GestureDetector>
          <Text style={styles.time}>{formatDuration(total * 1000)}</Text>
          <Pressable onPress={() => setMuted(player, !muted)} hitSlop={10} accessibilityLabel={muted ? 'Unmute' : 'Mute'}>
            <Feather name={muted ? 'volume-x' : 'volume-2'} size={18} color="#fff" />
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  bigButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.45)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.6)',
    borderLeftColor: 'rgba(255,255,255,0.3)',
    borderRightColor: 'rgba(255,255,255,0.3)',
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: 'rgba(20,20,20,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  time: { color: '#fff', fontSize: 11, fontFamily: 'Outfit_400Regular', fontVariant: ['tabular-nums'], minWidth: 34 },
  trackHit: { flex: 1, height: 28, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: '#fff' },
  knob: { position: 'absolute', width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: '#fff' },
});
