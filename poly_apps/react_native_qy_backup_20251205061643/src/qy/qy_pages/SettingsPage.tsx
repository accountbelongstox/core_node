/**
 * Settings Page
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import Icon from 'react-native-vector-icons/Feather';

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { themeData } = useStore();
  const styles = createStyles(themeData);

  const settingsItems = [
    {
      key: 'language',
      title: t('settings.language'),
      icon: 'globe',
      screen: 'ThemeSettings' as never,
    },
    {
      key: 'theme',
      title: t('settings.theme'),
      icon: 'moon',
      screen: 'ThemeSettings' as never,
    },
    {
      key: 'pronunciation',
      title: t('settings.pronunciation'),
      icon: 'volume-2',
      screen: 'PronunciationSettings' as never,
    },
    {
      key: 'learning',
      title: t('settings.learning'),
      icon: 'book',
      screen: 'LearningSettings' as never,
    },
    {
      key: 'notification',
      title: t('settings.notification'),
      icon: 'bell',
      screen: 'NotificationSettings' as never,
    },
    {
      key: 'dataSync',
      title: '数据同步',
      icon: 'cloud',
      screen: 'DataSyncSettings' as never,
    },
    {
      key: 'about',
      title: t('settings.about'),
      icon: 'info',
      screen: 'About' as never,
    },
    {
      key: 'help',
      title: '帮助',
      icon: 'help-circle',
      screen: 'Help' as never,
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        {settingsItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={localStyles.settingItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Icon name={item.icon} size={24} color={themeData.colors.primary} />
            <Text style={[styles.text, { marginLeft: 16, flex: 1, fontSize: 16 }]}>
              {item.title}
            </Text>
            <Icon name="chevron-right" size={24} color={themeData.colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});

export default SettingsPage;

