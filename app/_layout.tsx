import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useFonts, Lora_400Regular, Lora_500Medium } from '@expo-google-fonts/lora';
import { Outfit_300Light, Outfit_400Regular, Outfit_500Medium } from '@expo-google-fonts/outfit';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { useSession } from '@/store/session';

export { ErrorBoundary } from '@/components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 2, refetchOnWindowFocus: false } },
});

function Navigator() {
  const { palette, name } = useTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.bg);
  }, [palette.bg]);

  return (
    <>
      <StatusBar style={name === 'twilight' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
        <Stack.Screen name="connect" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="folders" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="album/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cleanup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="photo/[id]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const restore = useSession((s) => s.restore);
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_500Medium,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
  });

  useEffect(() => {
    void restore();
  }, [restore]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Navigator />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
