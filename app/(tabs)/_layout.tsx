import React, { useRef, type ComponentRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { BlurTargetView } from 'expo-blur';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { BlurTargetContext } from '@/theme/BlurTarget';
import { useSession } from '@/store/session';

export default function TabsLayout() {
  const status = useSession((s) => s.status);
  const blurTarget = useRef<ComponentRef<typeof View>>(null);

  if (status === 'signedOut') return <Redirect href="/connect" />;

  return (
    <BlurTargetContext.Provider value={blurTarget}>
      <View style={styles.root}>
        {/* Screens are the blur source; the glass tab bar must sit outside this target. */}
        <BlurTargetView ref={blurTarget} style={styles.root}>
          <Tabs screenOptions={{ headerShown: false }} tabBar={() => null}>
            <Tabs.Screen name="index" options={{ title: 'Photos' }} />
            <Tabs.Screen name="albums" options={{ title: 'Albums' }} />
            <Tabs.Screen name="search" options={{ title: 'Search' }} />
            <Tabs.Screen name="settings" options={{ title: 'You' }} />
          </Tabs>
        </BlurTargetView>
        <FloatingTabBar />
      </View>
    </BlurTargetContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
