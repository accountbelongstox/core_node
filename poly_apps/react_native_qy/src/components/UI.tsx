import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { palette, radius, shadow } from '../theme';

type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  className?: string;
  variant?: 'default' | 'primary' | 'muted' | 'holo';
  gradient?: string[];
};

export const Card = ({
  children,
  onPress,
  style,
  className,
  variant = 'default',
  gradient,
}: CardProps) => {
  const body = (
    <View
      style={[
        styles.card,
        variant === 'primary' && styles.cardPrimary,
        variant === 'muted' && styles.cardMuted,
        variant === 'holo' && styles.cardHolo,
        style,
      ]}
      className={className}>
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientFill}
        />
      ) : null}
      <View style={styles.cardContent}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {body}
      </Pressable>
    );
  }
  return body;
};

type ButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'secondary';
  style?: ViewStyle | ViewStyle[];
  className?: string;
};

export const Button = ({
  children,
  onPress,
  variant = 'primary',
  style,
  className,
}: ButtonProps) => {
  if (variant === 'primary') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
        <LinearGradient
          colors={[palette.primary, palette.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, style]}
          className={className as any}>
          <Text style={[styles.buttonText]}>{children}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'secondary' && styles.buttonSecondary,
        pressed && styles.pressed,
        style,
      ]}>
      <Text
        style={[
          styles.buttonText,
          variant === 'ghost' && styles.buttonTextGhost,
          variant === 'secondary' && styles.buttonTextSecondary,
        ]}>
        {children}
      </Text>
    </Pressable>
  );
};

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.sectionTitle} className="uppercase tracking-[0.2em] text-xs text-slate-400 font-extrabold mb-2">
    {children}
  </Text>
);

export const Avatar = ({ uri, size = 48 }: { uri?: string; size?: number }) => (
  <Image
    source={{ uri: uri || 'https://ui-avatars.com/api/?name=User' }}
    style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: '#fff' }}
  />
);

export const Tag = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.tag} className="bg-slate-100">
    <Text style={styles.tagText} className="text-slate-700 font-bold text-xs">
      {children}
    </Text>
  </View>
);

export const ProgressBar = ({ percent, color }: { percent: number; color?: string }) => (
  <View style={styles.progressTrack}>
    <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color || '#2563eb' }]} />
  </View>
);

export const StatPill = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) => (
  <View style={[styles.statPill, { borderColor: color || '#cbd5e1' }]}>
    <Text style={[styles.statValue, { color: color || '#0f172a' }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const Row = ({
  children,
  spaced,
  className,
}: {
  children: React.ReactNode;
  spaced?: boolean;
  className?: string;
}) => (
  <View
    style={[styles.row, spaced && { justifyContent: 'space-between' }]}
    className={className}>
    {children}
  </View>
);

export const PillButton = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.pill,
      active ? styles.pillActive : styles.pillInactive,
    ]}>
    <Text style={active ? styles.pillTextActive : styles.pillText}>{label}</Text>
  </Pressable>
);

export const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    marginBottom: 14,
    ...shadow.card,
  },
  cardPrimary: {
    backgroundColor: palette.primary,
    borderColor: palette.primaryDark,
  },
  cardMuted: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  cardHolo: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(255,255,255,0.8)',
  },
  gradientFill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  cardContent: {
    padding: 16,
  },
  button: {
    backgroundColor: palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#0ea5e9',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonTextSecondary: {
    color: '#fff',
  },
  buttonTextGhost: {
    color: '#0f172a',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tagText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
  statPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  statValue: {
    fontWeight: '800',
    fontSize: 16,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: '#2563eb',
  },
  pillInactive: {
    backgroundColor: '#e2e8f0',
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  pillText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
});
