import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { clsx } from 'clsx';

interface HoloCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  isActive?: boolean;
}

export const HoloCard: React.FC<HoloCardProps> = ({ 
  children, 
  style, 
  onPress, 
  isActive = false 
}) => {
  const cardStyle = [
    styles.card,
    isActive && styles.cardActive,
    style
  ];

  if (onPress) {
    return (
      <TouchableOpacity 
        onPress={onPress}
        activeOpacity={0.9}
        style={cardStyle}
      >
        <View style={styles.content}>
          {children}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle}>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 8,
  },
  cardActive: {
    borderWidth: 2,
    borderColor: '#a78bfa',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#a78bfa',
    shadowOpacity: 0.2,
    transform: [{ scale: 1.02 }],
  },
  content: {
    position: 'relative',
    zIndex: 10,
  },
});

