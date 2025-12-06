/**
 * Theme Settings Page
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import Icon from 'react-native-vector-icons/Feather';

const ThemeSettingsPage: React.FC = () => {
  const { themeData, settings, setTheme, updateSettings } = useStore();
  const styles = createStyles(themeData);

  if (!settings) {
    return null;
  }

  const themes = [
    { key: 'light', label: '浅色', icon: 'sun' },
    { key: 'dark', label: '深色', icon: 'moon' },
    { key: 'auto', label: '自动', icon: 'monitor' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 16 }]}>
          主题设置
        </Text>

        {themes.map((theme) => (
          <TouchableOpacity
            key={theme.key}
            style={localStyles.themeItem}
            onPress={() => {
              if (theme.key !== 'auto') {
                setTheme(theme.key as 'light' | 'dark');
              }
              updateSettings({ theme: { ...settings.theme, mode: theme.key as any } });
            }}
          >
            <Icon name={theme.icon} size={24} color={themeData.colors.primary} />
            <Text style={[styles.text, { marginLeft: 16, flex: 1 }]}>{theme.label}</Text>
            {settings.theme.mode === theme.key && (
              <Icon name="check" size={24} color={themeData.colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});

export default ThemeSettingsPage;

