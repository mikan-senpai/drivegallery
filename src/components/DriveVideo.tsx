/**
 * Video page for the viewer. Shows the poster with a play button; the player
 * (and the network stream) is only created after the user taps play, and is
 * torn down when the page is swiped away — so paging through a timeline never
 * runs more than one video.
 *
 * Streams straight from Drive (`files/{id}?alt=media`) with the auth header;
 * the player uses HTTP range requests, so large files start without a full download.
 */
import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';

interface Props {
  uri: string;
  headers?: Record<string, string>;
  poster?: ImageSource;
  width: number;
  height: number;
  /** Whether this page is the one on screen. Leaving it stops playback. */
  active: boolean;
}

export function DriveVideo({ uri, headers, poster, width, height, active }: Props) {
  const [started, setStarted] = useState(false);
  const [wasActive, setWasActive] = useState(active);

  // Swiped away → reset to the poster (React's "adjust state on prop change" pattern).
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setStarted(false);
  }

  if (started && active) {
    return <Player uri={uri} headers={headers} width={width} height={height} />;
  }

  return (
    <View style={{ width, height }}>
      <Image source={poster} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
      <Pressable
        style={styles.playWrap}
        onPress={() => setStarted(true)}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        <View style={styles.play}>
          <Feather name="play" size={30} color="#fff" style={{ marginLeft: 4 }} />
        </View>
      </Pressable>
    </View>
  );
}

function Player({ uri, headers, width, height }: Omit<Props, 'poster' | 'active'>) {
  const player = useVideoPlayer({ uri, headers }, (p) => {
    p.play();
  });
  return <VideoView player={player} style={{ width, height }} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  playWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
