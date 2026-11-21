import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GlassView } from '@/components/GlassView';
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
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
      <View style={styles.shadow}>
        <GlassView radius={radius.full}>
          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const icon = ICONS[route.name] ?? 'circle';
              const onPress = () => {
                Haptics.selectionAsync();
                if (!focused) router.navigate(HREFS[route.name] ?? '/');
              };
              return (
                <Pressable key={route.key} onPress={onPress} style={styles.item} hitSlop={8}>
                  {/* Active tab sits in its own small glass lens. */}
                  <View
                    style={[
                      styles.lens,
                      focused && {
                        backgroundColor: palette.primary + '26',
                        borderColor: palette.primary + '55',
                      },
                    ]}
                  >
                    <Feather name={icon} size={21} color={focused ? palette.primary : palette.fgVariant} />
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
      ios: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } },
      android: { elevation: 10 },
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
