import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlassView } from '@/components/GlassView';
import { useBlurTarget } from '@/theme/BlurTarget';
import { useSelection } from '@/store/selection';
import { useTheme } from '@/theme/ThemeProvider';
import { glass, radius } from '@/theme/tokens';

const TABS: { href: Href; path: string; icon: keyof typeof Feather.glyphMap }[] = [
  { href: '/', path: '/', icon: 'grid' },
  { href: '/albums', path: '/albums', icon: 'folder' },
  { href: '/search', path: '/search', icon: 'search' },
  { href: '/settings', path: '/settings', icon: 'user' },
];

const BAR_HEIGHT = 58;
/** How far the active pill bulges past the bar, top/bottom and left/right. */
const LENS_OVERFLOW_Y = 6;
const LENS_OVERFLOW_X = 4;

/**
 * iOS 26-style tab bar: a frosted glass bar with a raised pill over the active
 * tab that springs between tabs. Rendered by the tabs layout outside the blur
 * target, so the bar blurs the screens behind it.
 */
export function FloatingTabBar() {
  const { palette, name } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const blurTarget = useBlurTarget();
  const selecting = useSelection((s) => s.active);
  const [barWidth, setBarWidth] = useState(0);

  const activeIndex = Math.max(0, TABS.findIndex((t) => t.path === pathname));
  const itemW = barWidth / TABS.length;

  const lensX = useSharedValue(0);
  useEffect(() => {
    if (itemW > 0) lensX.value = withSpring(activeIndex * itemW - LENS_OVERFLOW_X, { damping: 18, stiffness: 180 });
  }, [activeIndex, itemW, lensX]);

  const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: lensX.value }] }));

  // The Photos screen shows its selection actions in this spot while selecting.
  if (selecting) return null;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 18 }]} pointerEvents="box-none">
      <View style={styles.bar} onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}>
        {/* Bar body: frosted glass, which draws its own shadow. */}
        <GlassView variant="frost" radius={radius.full} blurTarget={blurTarget} style={StyleSheet.absoluteFill} />

        {/* Active pill: a flat bright lift that bulges past the bar. Flat, not a
            second glass: on Android a blur here would sample the screens and not
            the bar under it, and show them sharper than the bar around it. */}
        {itemW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.lens, { width: itemW + LENS_OVERFLOW_X * 2 }, lensStyle]}
          >
            <View style={[styles.pill, { backgroundColor: glass.indicator[name] }]} />
          </Animated.View>
        )}

        {/* Icons on top of the bar and the pill. */}
        <View style={styles.row}>
          {TABS.map((tab, i) => {
            const focused = i === activeIndex;
            const onPress = () => {
              Haptics.selectionAsync();
              if (!focused) router.navigate(tab.href);
            };
            return (
              <Pressable key={tab.path} onPress={onPress} style={styles.item} hitSlop={6}>
                <Feather name={tab.icon} size={22} color={focused ? palette.fg : palette.fgVariant} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 22, right: 22 },
  bar: { height: BAR_HEIGHT },
  lens: {
    position: 'absolute',
    left: 0,
    top: -LENS_OVERFLOW_Y,
    bottom: -LENS_OVERFLOW_Y,
  },
  pill: {
    flex: 1,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: glass.rim.width,
    borderColor: glass.rim.color,
  },
  row: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
});
