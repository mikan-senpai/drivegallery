import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface Props {
  uri?: string;
  width: number;
  height: number;
  /** Fires when this page becomes zoomed / unzoomed, so the pager can lock. */
  onZoomChange?: (zoomed: boolean) => void;
}

export function ZoomableImage({ uri, width, height, onZoomChange }: Props) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const stx = useSharedValue(0);
  const sty = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    onZoomChange?.(zoomed);
  }, [zoomed, onZoomChange]);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    saved.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    stx.value = 0;
    sty.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, saved.value * e.scale);
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value > 1) {
        runOnJS(setZoomed)(true);
      } else {
        reset();
        runOnJS(setZoomed)(false);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
        runOnJS(setZoomed)(false);
      } else {
        scale.value = withTiming(2.5);
        saved.value = 2.5;
        runOnJS(setZoomed)(true);
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
      <AnimatedImage source={uri} style={[{ width, height }, animated]} contentFit="contain" transition={120} />
    </GestureDetector>
  );
}
