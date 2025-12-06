/**
 * Review Page
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { memoryApi, statisticsApi } from '@/qy/qy_services/api-service';
import { MemoryRecord, Statistics } from '@/qy/qy_types';
import Icon from 'react-native-vector-icons/Feather';

const ReviewPage: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { themeData } = useStore();
  const styles = createStyles(themeData);
  const [todayReviewCount, setTodayReviewCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviewData();
  }, []);

  const loadReviewData = async () => {
    try {
      const statsResponse = await statisticsApi.get();
      if (statsResponse.success && statsResponse.data) {
        setTodayReviewCount(statsResponse.data.todayReviewCount);
        setOverdueCount(statsResponse.data.overdueCount);
      }
    } catch (error) {
      console.error('Failed to load review data:', error);
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

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 20, fontWeight: 'bold', marginBottom: 16 }]}>
          {t('review.title')}
        </Text>

        <TouchableOpacity
          style={localStyles.reviewCard}
          onPress={() => {
            // Navigate to review session
          }}
        >
          <Icon name="calendar" size={32} color={themeData.colors.primary} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={[styles.text, { fontSize: 18, fontWeight: '600' }]}>
              {t('review.today')}
            </Text>
            <Text style={styles.textSecondary}>
              {todayReviewCount} 个单词待复习
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color={themeData.colors.textSecondary} />
        </TouchableOpacity>

        {overdueCount > 0 && (
          <TouchableOpacity
            style={[localStyles.reviewCard, { backgroundColor: themeData.colors.error + '20' }]}
            onPress={() => {
              // Navigate to overdue review
            }}
          >
            <Icon name="alert-circle" size={32} color={themeData.colors.error} />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={[styles.text, { fontSize: 18, fontWeight: '600' }]}>
                {t('review.overdue')}
              </Text>
              <Text style={styles.textSecondary}>
                {overdueCount} 个单词逾期
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={themeData.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 12,
  },
});

export default ReviewPage;

