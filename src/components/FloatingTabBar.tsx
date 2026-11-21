import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

/** Minimal shape of the props expo-router's Tabs passes to a custom tabBar. */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
}

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'grid',
  albums: 'folder',
  search: 'search',
  settings: 'user',
};

const HREFS: Record<string, Href> = {
  index: '/',
  albums: '/albums',
  search: '/search',
  settings: '/settings',
};

export function FloatingTabBar({ state }: TabBarProps) {
  const { palette, name } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
      <BlurView
        intensity={40}
        tint={name === 'twilight' ? 'dark' : 'light'}
        style={[styles.bar, { backgroundColor: palette.bar, borderColor: palette.border }]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const icon = ICONS[route.name] ?? 'circle';
          const onPress = () => {
            Haptics.selectionAsync();
            if (!focused) router.navigate(HREFS[route.name] ?? '/');
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item} hitSlop={8}>
              <View
                style={
                  focused && Platform.OS === 'ios'
                    ? {
                        shadowColor: palette.primary,
                        shadowOpacity: 0.8,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 0 },
                      }
                    : undefined
                }
              >
                <Feather name={icon} size={22} color={focused ? palette.primary : palette.fgVariant} />
              </View>
              <View style={[styles.dot, { backgroundColor: focused ? palette.primary : 'transparent' }]} />
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24, alignItems: 'stretch' },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 16 } },
      android: { elevation: 12 },
    }),
  },
  item: { alignItems: 'center', gap: 5, flex: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
