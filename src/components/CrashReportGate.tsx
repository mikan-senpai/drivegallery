/**
 * On launch, if the app died last time (native crash, OOM, ANR), show what
 * happened so the user can screenshot it. Uses the local CrashReporter module;
 * does nothing on builds without it.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CrashReporter from '../../modules/crash-reporter';

export function CrashReportGate() {
  const [report, setReport] = useState<string | null>(null);

  useEffect(() => {
    if (!CrashReporter) return;
    CrashReporter.getLastCrash()
      .then((text) => setReport(text))
      .catch(() => {});
  }, []);

  const dismiss = () => {
    CrashReporter?.clearLastCrash();
    setReport(null);
  };

  return (
    <Modal visible={!!report} animationType="fade" onRequestClose={dismiss}>
      <SafeAreaView style={styles.root}>
        <Text style={styles.title}>DriveGallery closed unexpectedly</Text>
        <Text style={styles.hint}>Take a screenshot of this screen and send it to the developer.</Text>
        <ScrollView style={styles.box} contentContainerStyle={{ padding: 14 }}>
          <Text selectable style={styles.trace}>
            {report}
          </Text>
        </ScrollView>
        <Pressable onPress={dismiss} style={styles.button}>
          <Text style={styles.buttonText}>Dismiss</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#151413', padding: 20, gap: 12 },
  title: { color: '#eae6db', fontSize: 22, fontFamily: 'Lora_400Regular', marginTop: 8 },
  hint: { color: '#9a9893', fontSize: 13, fontFamily: 'Outfit_300Light' },
  box: { flex: 1, backgroundColor: '#1f1e1d', borderRadius: 16, borderWidth: 1, borderColor: '#2a2927' },
  trace: { color: '#eae6db', fontSize: 11, fontFamily: 'monospace', lineHeight: 15 },
  button: { backgroundColor: '#c9bba5', borderRadius: 9999, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#151413', fontSize: 15, fontFamily: 'Outfit_400Regular' },
});
