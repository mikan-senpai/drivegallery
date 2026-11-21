import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

/** Expo Router renders this when a route throws. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.msg} numberOfLines={4}>
        {error.message}
      </Text>
      <Pressable style={styles.btn} onPress={() => void retry()}>
        <Text style={styles.btnText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: '#151413' },
  title: { color: '#eae6db', fontSize: 20, fontFamily: 'Lora_400Regular' },
  msg: { color: '#9a9893', fontSize: 13, textAlign: 'center', fontFamily: 'Outfit_300Light' },
  btn: { marginTop: 8, backgroundColor: '#c9bba5', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 9999 },
  btnText: { color: '#151413', fontFamily: 'Outfit_400Regular' },
});
