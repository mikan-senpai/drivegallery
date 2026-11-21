/**
 * Android real-blur plumbing.
 *
 * On Android, expo-blur only blurs when a BlurView is given `blurTarget`: a ref
 * to a BlurTargetView wrapping the content behind it. The BlurView must sit
 * OUTSIDE that target. The tabs layout wraps its screens in the target and
 * exposes the ref here so floating glass (the tab bar) can blur them.
 */
import { createContext, useContext, type ComponentRef, type RefObject } from 'react';
import type { View } from 'react-native';

export type BlurTargetRef = RefObject<ComponentRef<typeof View> | null>;

export const BlurTargetContext = createContext<BlurTargetRef | null>(null);

export function useBlurTarget(): BlurTargetRef | null {
  return useContext(BlurTargetContext);
}
