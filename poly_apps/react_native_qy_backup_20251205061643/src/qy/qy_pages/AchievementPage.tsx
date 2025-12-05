/**
 * Achievement Page
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import Icon from 'react-native-vector-icons/Feather';

const AchievementPage: React.FC = () => {
  const { themeData } = useStore();
  const styles = createStyles(themeData);

  const achievements = [
    { id: '1', title: '初出茅庐', description: '学习第一个单词', icon: 'book', unlocked: true },
    { id: '2', title: '百词斩', description: '学习100个单词', icon: 'award', unlocked: true },
    { id: '3', title: '千词斩', description: '学习1000个单词', icon: 'star', unlocked: false },
    { id: '4', title: '连续学习7天', description: '连续学习7天', icon: 'calendar', unlocked: false },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 16 }]}>
          成就
        </Text>

        {achievements.map((achievement) => (
          <View
            key={achievement.id}
            style={[
              localStyles.achievementItem,
              { opacity: achievement.unlocked ? 1 : 0.5 },
            ]}
          >
            <Icon
              name={achievement.icon}
              size={32}
              color={achievement.unlocked ? themeData.colors.primary : themeData.colors.textDisabled}
            />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={[styles.text, { fontWeight: '600' }]}>{achievement.title}</Text>
              <Text style={styles.textSecondary}>{achievement.description}</Text>
            </View>
            {achievement.unlocked && (
              <Icon name="check-circle" size={24} color={themeData.colors.success} />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});

export default AchievementPage;

