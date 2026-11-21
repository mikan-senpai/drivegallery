/* eslint-disable react-hooks/refs -- the Pan gesture is configured during render, but its
   callbacks only run on the UI thread while dragging; refs are never read during render. */
/**
 * Samsung Gallery–style fast scroller for long lists.
 *
 * - A slim handle on the right edge appears while the list scrolls, then fades.
 * - Dragging it seeks the list directly; a date bubble shows where you are.
 * - Hidden (and non-interactive) until scrolling, so it never eats taps on
 *   the right-hand column; only shown when content is > 2 screens tall.
 *
 * The list drives it imperatively via `update()` from its onScroll, which keeps
 * per-frame scroll work out of React state.
 */
import React, { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { type } from '@/theme/tokens';

export interface FastScrollerHandle {
  /** Call from the list's onScroll. */
  update: (offset: number, contentHeight: number, viewportHeight: number) => void;
}

interface Props {
  ref?: Ref<FastScrollerHandle>;
  /** Distance from the screen top / bottom the track should keep clear of. */
  top: number;
  bottom: number;
  /** Scroll the list to an absolute offset. */
  onSeek: (offset: number) => void;
  /** Label for the content at an offset, e.g. "November 2024". */
  labelForOffset: (offset: number) => string | null;
}

const THUMB_H = 46;
const THUMB_W = 30;
const HIDE_AFTER_MS = 1400;
/** Only worth showing when the content is this many screens tall. */
const MIN_SCREENS = 2;

export function FastScroller({ ref, top, bottom, onSeek, labelForOffset }: Props) {
  const { palette } = useTheme();
  const [trackH, setTrackH] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  const progress = useSharedValue(0);
  const startProgress = useSharedValue(0);
  const opacity = useSharedValue(0);

  const maxScroll = useRef(0);
  const draggingRef = useRef(false);
  const visibleRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setShown = (shown: boolean) => {
    if (visibleRef.current === shown) return;
    visibleRef.current = shown;
    setVisible(shown);
    opacity.value = withTiming(shown ? 1 : 0, { duration: shown ? 140 : 260 });
  };

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!draggingRef.current) setShown(false);
    }, HIDE_AFTER_MS);
  };

  useImperativeHandle(ref, () => ({
    update(offset, contentHeight, viewportHeight) {
      maxScroll.current = Math.max(0, contentHeight - viewportHeight);
      if (contentHeight < viewportHeight * MIN_SCREENS) return;
      if (!draggingRef.current && maxScroll.current > 0) {
        progress.value = Math.min(1, Math.max(0, offset / maxScroll.current));
      }
      setShown(true);
      scheduleHide();
    },
  }));

  const travel = Math.max(1, trackH - THUMB_H);

  const seek = (p: number) => {
    const offset = p * maxScroll.current;
    onSeek(offset);
    setLabel(labelForOffset(offset));
  };
  const begin = () => {
    draggingRef.current = true;
    setDragging(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShown(true);
    Haptics.selectionAsync();
  };
  const end = () => {
    draggingRef.current = false;
    setDragging(false);
    scheduleHide();
  };

  const pan = Gesture.Pan()
    // A slim handle is fiddly to grab; widen the touch area toward the content.
    .hitSlop({ left: 18, top: 10, bottom: 10 })
    .onBegin(() => {
      startProgress.set(progress.get());
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      const p = Math.min(1, Math.max(0, startProgress.get() + e.translationY / travel));
      progress.set(p);
      runOnJS(seek)(p);
    })
    .onFinalize(() => {
      runOnJS(end)();
    });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateY: progress.get() * travel }] }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.track, { top, bottom }, fadeStyle]}
      onLayout={(e) => setTrackH(e.nativeEvent.layout.height)}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumbRow, thumbStyle]}>
          {dragging && label ? (
            <View style={[styles.bubble, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[type.label, { color: palette.fg }]}>{label}</Text>
            </View>
          ) : null}
          <View style={[styles.thumb, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Feather name="chevron-up" size={13} color={palette.fg} />
            <Feather name="chevron-down" size={13} color={palette.fg} />
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', right: 6, width: 220, alignItems: 'flex-end' },
  thumbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: THUMB_H },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: THUMB_W / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
