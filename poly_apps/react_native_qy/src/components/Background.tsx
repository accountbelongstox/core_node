import React from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export const Background = ({ children }: { children: React.ReactNode }) => {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#e0f2fe', '#eef2ff', '#f8fafc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blobA} />
      <View style={styles.blobB} />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  blobA: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#c7d2fe',
    opacity: 0.25,
    top: -60,
    right: -40,
    transform: [{ scale: 1 }],
  } as any,
  blobB: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#bae6fd',
    opacity: 0.3,
    bottom: -120,
    left: -80,
    transform: [{ scale: 1 }],
  } as any,
});
