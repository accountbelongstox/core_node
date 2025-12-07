/**
 * Card Component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Theme } from '@/common/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  theme: Theme;
}

const Card: React.FC<CardProps> = ({ children, style, theme }) => {
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: 12,
          padding: 16,
          margin: 8,
          shadowColor: theme.colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export default Card;

