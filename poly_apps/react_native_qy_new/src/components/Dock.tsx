import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius } from '../theme';
import { useAppContext, PageKey } from '../state/AppContext';

type DockButton = {
  key: PageKey;
  label: string;
  icon: string;
};

const buttons: DockButton[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'playlist', label: 'Playlist', icon: '▶' },
  { key: 'reading_setup', label: 'Play', icon: '⏵' },
  { key: 'quiz_run', label: 'Quiz', icon: '?' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
];

export const Dock = () => {
  const { currentPage, navigate } = useAppContext();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 12 }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.6)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {buttons.map(btn => {
          const active = currentPage === btn.key;
          return (
            <Pressable
              key={btn.key}
              onPress={() => navigate(btn.key)}
              style={({ pressed }) => [
                styles.button,
                active && styles.buttonActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.icon, active && styles.iconActive]}>{btn.icon}</Text>
              <Text style={[styles.label, active && styles.labelActive]}>{btn.label}</Text>
            </Pressable>
          );
        })}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  buttonActive: {
    backgroundColor: '#e0f2fe',
  },
  icon: {
    fontSize: 18,
    color: palette.inkMuted,
    fontWeight: '800',
  },
  iconActive: {
    color: palette.primary,
  },
  label: {
    fontSize: 11,
    color: palette.inkMuted,
    fontWeight: '700',
    marginTop: 2,
  },
  labelActive: {
    color: palette.primary,
  },
});
