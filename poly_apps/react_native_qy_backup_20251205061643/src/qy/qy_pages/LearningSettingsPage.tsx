/**
 * Learning Settings Page
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { Picker } from '@react-native-picker/picker';

const LearningSettingsPage: React.FC = () => {
  const { themeData, settings, updateSettings } = useStore();
  const styles = createStyles(themeData);

  if (!settings) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 16 }]}>
          学习目标
        </Text>

        <View style={localStyles.settingItem}>
          <Text style={styles.text}>每日学习单词数</Text>
          <Picker
            selectedValue={settings.learning.dailyWordGoal}
            onValueChange={(value) => updateSettings({ learning: { ...settings.learning, dailyWordGoal: value } })}
            style={{ width: 150 }}
          >
            <Picker.Item label="10" value={10} />
            <Picker.Item label="20" value={20} />
            <Picker.Item label="30" value={30} />
            <Picker.Item label="50" value={50} />
            <Picker.Item label="100" value={100} />
          </Picker>
        </View>

        <View style={localStyles.settingItem}>
          <Text style={styles.text}>每日复习单词数</Text>
          <Picker
            selectedValue={settings.learning.dailyReviewGoal}
            onValueChange={(value) => updateSettings({ learning: { ...settings.learning, dailyReviewGoal: value } })}
            style={{ width: 150 }}
          >
            <Picker.Item label="20" value={20} />
            <Picker.Item label="50" value={50} />
            <Picker.Item label="100" value={100} />
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

export default LearningSettingsPage;

