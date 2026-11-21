/**
 * Small popover menu anchored to the top-right (the viewer's ⋮ button).
 * Dark glass card over a dim backdrop; tap outside to close.
 */
import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface MenuAction {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export function ActionMenu({ visible, onClose, actions }: { visible: boolean; onClose: () => void; actions: MenuAction[] }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <View style={[styles.card, { top: insets.top + 52 }]}>
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={({ pressed }) => [styles.item, i > 0 && styles.divider, pressed && styles.pressed]}
            >
              <Feather name={a.icon} size={18} color={a.destructive ? '#ff6b6b' : '#fff'} />
              <Text style={[styles.label, a.destructive && { color: '#ff6b6b' }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  card: {
    position: 'absolute',
    right: 12,
    minWidth: 220,
    paddingVertical: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(32,31,30,0.97)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  pressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  label: { color: '#fff', fontFamily: 'Outfit_400Regular', fontSize: 15 },
});
