import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
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

/** Rendered by the tabs layout outside the blur target, so it can blur the screens. */
export function FloatingTabBar() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const blurTarget = useBlurTarget();

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
      <View style={styles.shadow}>
        <GlassView radius={radius.full} blurTarget={blurTarget}>
          <View style={styles.row}>
            {TABS.map((tab) => {
              const focused = pathname === tab.path;
              const onPress = () => {
                Haptics.selectionAsync();
                if (!focused) router.navigate(tab.href);
              };
              return (
                <Pressable key={tab.path} onPress={onPress} style={styles.item} hitSlop={8}>
                  {/* Active tab sits in its own small glass lens. */}
                  <View
                    style={[
                      styles.lens,
                      focused && {
                        backgroundColor: palette.primary + '2e',
                        borderColor: palette.primary + '66',
                      },
                    ]}
                  >
                    <Feather name={tab.icon} size={21} color={focused ? palette.primary : palette.fg} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </GlassView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24 },
  shadow: {
    borderRadius: radius.full,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
      android: { elevation: 8 },
    }),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  item: { flex: 1, alignItems: 'center' },
  lens: {
    width: 56,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
});
