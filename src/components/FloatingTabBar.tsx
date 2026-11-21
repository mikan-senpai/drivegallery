import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Platform, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlassView } from '@/components/GlassView';
import { useBlurTarget } from '@/theme/BlurTarget';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const TABS: { href: Href; path: string; icon: keyof typeof Feather.glyphMap }[] = [
  { href: '/', path: '/', icon: 'grid' },
  { href: '/albums', path: '/albums', icon: 'folder' },
  { href: '/search', path: '/search', icon: 'search' },
  { href: '/settings', path: '/settings', icon: 'user' },
];

const BAR_HEIGHT = 58;
/** How far the active lens bulges past the bar, top/bottom and left/right. */
const LENS_OVERFLOW_Y = 6;
const LENS_OVERFLOW_X = 4;

/**
 * iOS 26-style tab bar: a near-clear glass bar with a raised glass lens over the
 * active tab that springs between tabs. Rendered by the tabs layout outside the
 * blur target, so both the bar and the lens blur the screens behind them.
 */
export function FloatingTabBar() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const blurTarget = useBlurTarget();
  const [barWidth, setBarWidth] = useState(0);

  const activeIndex = Math.max(0, TABS.findIndex((t) => t.path === pathname));
  const itemW = barWidth / TABS.length;

  const lensX = useSharedValue(0);
  useEffect(() => {
    if (itemW > 0) lensX.value = withSpring(activeIndex * itemW - LENS_OVERFLOW_X, { damping: 18, stiffness: 180 });
  }, [activeIndex, itemW, lensX]);

  const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: lensX.value }] }));

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 18 }]} pointerEvents="box-none">
      <View style={styles.bar} onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}>
        {/* Bar body: nearly clear glass. */}
        <View style={styles.shadow}>
          <GlassView radius={radius.full} blurTarget={blurTarget} style={styles.fill} />
        </View>

        {/* Active lens: a raised glass droplet that bulges past the bar. */}
        {itemW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.lens, { width: itemW + LENS_OVERFLOW_X * 2 }, lensStyle]}
          >
            <View style={styles.lensShadow}>
              <GlassView radius={radius.full} blurTarget={blurTarget} style={styles.fill} />
            </View>
          </Animated.View>
        )}

        {/* Icons on top of both glass layers. */}
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
  fill: { flex: 1 },
  shadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.full,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
      android: {},
    }),
  },
  lens: {
    position: 'absolute',
    left: 0,
    top: -LENS_OVERFLOW_Y,
    bottom: -LENS_OVERFLOW_Y,
  },
  lensShadow: {
    flex: 1,
    borderRadius: radius.full,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: {},
    }),
  },
  row: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
});
