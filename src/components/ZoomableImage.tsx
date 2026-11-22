import React, { useEffect, useRef, useState } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface Props {
  source: ImageSource;
  /** Shown instantly while `source` loads (e.g. the cached grid thumbnail). */
  placeholder?: ImageSource;
  width: number;
  height: number;
  /** Fires when this page becomes zoomed / unzoomed, so the pager can lock. */
  onZoomChange?: (zoomed: boolean) => void;
}

export function ZoomableImage({ source, placeholder, width, height, onZoomChange }: Props) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const stx = useSharedValue(0);
  const sty = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);

  // Every page gets a new inline callback on each render; firing on that would
  // let an unzoomed neighbour re-enable paging. Fire only when `zoomed` changes.
  const onZoomChangeRef = useRef(onZoomChange);
  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  });
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    onZoomChangeRef.current?.(zoomed);
  }, [zoomed]);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    saved.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    stx.value = 0;
    sty.value = 0;
  };

  // Pinch and double-tap set React state, so they run on the JS thread
  // (worklet->JS handoff via runOnJS crashed in worklets 0.13).
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onUpdate((e) => {
      scale.value = Math.max(1, saved.value * e.scale);
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value > 1) {
        setZoomed(true);
      } else {
        reset();
        setZoomed(false);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
        setZoomed(false);
      } else {
        scale.value = withTiming(2.5);
        saved.value = 2.5;
        setZoomed(true);
      }
    });

  // Pan only while zoomed — otherwise it would swallow the pager's horizontal swipe.
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate((e) => {
      tx.value = stx.value + e.translationX;
      ty.value = sty.value + e.translationY;
    })
    .onEnd(() => {
      stx.value = tx.value;
      sty.value = ty.value;
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <AnimatedImage
        source={source}
        placeholder={placeholder}
        placeholderContentFit="contain"
        cachePolicy="memory-disk"
        style={[{ width, height }, animated]}
        contentFit="contain"
        transition={120}
      />
    </GestureDetector>
  );
}
