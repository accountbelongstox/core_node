/**
 * Notification Settings Page
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';

const NotificationSettingsPage: React.FC = () => {
  const { themeData, settings, updateSettings } = useStore();
  const styles = createStyles(themeData);

  if (!settings) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 16 }]}>
          通知设置
        </Text>

        <View style={localStyles.settingItem}>
          <Text style={styles.text}>每日学习提醒</Text>
          <Switch
            value={settings.notifications.dailyReminder}
            onValueChange={(value) => updateSettings({ notifications: { ...settings.notifications, dailyReminder: value } })}
          />
        </View>

        <View style={localStyles.settingItem}>
          <Text style={styles.text}>复习提醒</Text>
          <Switch
            value={settings.notifications.reviewReminder}
            onValueChange={(value) => updateSettings({ notifications: { ...settings.notifications, reviewReminder: value } })}
          />
        </View>

        <View style={localStyles.settingItem}>
          <Text style={styles.text}>成就通知</Text>
          <Switch
            value={settings.notifications.achievementNotification}
            onValueChange={(value) => updateSettings({ notifications: { ...settings.notifications, achievementNotification: value } })}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});

export default NotificationSettingsPage;

