/**
 * Statistics Page
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { statisticsApi } from '@/qy/qy_services/api-service';
import { Statistics } from '@/qy/qy_types';
import Icon from 'react-native-vector-icons/Feather';

const StatisticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { themeData } = useStore();
  const styles = createStyles(themeData);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const response = await statisticsApi.get();
      if (response.success && response.data) {
        setStatistics(response.data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={themeData.colors.primary} />
      </View>
    );
  }

  if (!statistics) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>暂无数据</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 20, fontWeight: 'bold', marginBottom: 16 }]}>
          {t('statistics.title')}
        </Text>

        <View style={localStyles.statCard}>
          <Icon name="book" size={24} color={themeData.colors.primary} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.textSecondary}>{t('statistics.totalWords')}</Text>
            <Text style={[styles.text, { fontSize: 24, fontWeight: 'bold', marginTop: 4 }]}>
              {statistics.totalWords}
            </Text>
          </View>
        </View>

        <View style={localStyles.statCard}>
          <Icon name="calendar" size={24} color={themeData.colors.primary} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.textSecondary}>{t('statistics.todayWords')}</Text>
            <Text style={[styles.text, { fontSize: 24, fontWeight: 'bold', marginTop: 4 }]}>
              {statistics.todayWords}
            </Text>
          </View>
        </View>

        <View style={localStyles.statCard}>
          <Icon name="trending-up" size={24} color={themeData.colors.primary} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.textSecondary}>{t('statistics.streakDays')}</Text>
            <Text style={[styles.text, { fontSize: 24, fontWeight: 'bold', marginTop: 4 }]}>
              {statistics.streakDays}
            </Text>
          </View>
        </View>

        <View style={localStyles.statCard}>
          <Icon name="target" size={24} color={themeData.colors.primary} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.textSecondary}>{t('statistics.masteryRate')}</Text>
            <Text style={[styles.text, { fontSize: 24, fontWeight: 'bold', marginTop: 4 }]}>
              {statistics.masteryRate}%
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 12,
  },
});

export default StatisticsPage;

