/**
 * Pronunciation Settings Page
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { Picker } from '@react-native-picker/picker';

const PronunciationSettingsPage: React.FC = () => {
  const { themeData, settings, updateSettings } = useStore();
  const styles = createStyles(themeData);

  if (!settings) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 16 }]}>
          发音设置
        </Text>

        <View style={localStyles.settingItem}>
          <Text style={styles.text}>默认发音引擎</Text>
          <Picker
            selectedValue={settings.pronunciation.defaultEngine}
            onValueChange={(value) => updateSettings({ pronunciation: { ...settings.pronunciation, defaultEngine: value } })}
            style={{ width: 150 }}
          >
            <Picker.Item label="美式英语" value="us" />
            <Picker.Item label="英式英语" value="uk" />
            <Picker.Item label="澳式英语" value="au" />
          </Picker>
        </View>

        <View style={localStyles.settingItem}>
          <Text style={styles.text}>发音速度</Text>
          <Picker
            selectedValue={settings.pronunciation.speed}
            onValueChange={(value) => updateSettings({ pronunciation: { ...settings.pronunciation, speed: value } })}
            style={{ width: 150 }}
          >
            <Picker.Item label="0.5x" value={0.5} />
            <Picker.Item label="0.75x" value={0.75} />
            <Picker.Item label="1.0x" value={1.0} />
            <Picker.Item label="1.25x" value={1.25} />
            <Picker.Item label="1.5x" value={1.5} />
            <Picker.Item label="2.0x" value={2.0} />
          </Picker>
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

export default PronunciationSettingsPage;

