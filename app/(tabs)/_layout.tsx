import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useSession } from '@/store/session';

export default function TabsLayout() {
  const status = useSession((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Photos' }} />
      <Tabs.Screen name="albums" options={{ title: 'Albums' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="settings" options={{ title: 'You' }} />
    </Tabs>
  );
}
