/**
 * Data Sync Settings Page
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';

const DataSyncSettingsPage: React.FC = () => {
  const { themeData, settings, updateSettings } = useStore();
  const styles = createStyles(themeData);

  if (!settings) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 16 }]}>
          数据同步设置
        </Text>

        <View style={localStyles.settingItem}>
          <Text style={styles.text}>自动同步</Text>
          <Switch
            value={settings.dataSync.autoSync}
            onValueChange={(value) => updateSettings({ dataSync: { ...settings.dataSync, autoSync: value } })}
          />
        </View>

        <View style={localStyles.settingItem}>
          <Text style={styles.text}>仅WiFi同步</Text>
          <Switch
            value={settings.dataSync.wifiOnly}
            onValueChange={(value) => updateSettings({ dataSync: { ...settings.dataSync, wifiOnly: value } })}
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

export default DataSyncSettingsPage;

