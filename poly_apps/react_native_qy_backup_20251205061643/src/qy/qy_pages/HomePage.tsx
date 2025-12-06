/**
 * Home Page
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { statisticsApi } from '@/qy/qy_services/api-service';
import { Statistics } from '@/qy/qy_types';
import Icon from 'react-native-vector-icons/Feather';

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
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

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 24, fontWeight: 'bold', marginBottom: 16 }]}>
          {t('app.welcome')}
        </Text>
        
        {statistics && (
          <View>
            <View style={localStyles.statItem}>
              <Icon name="book" size={20} color={themeData.colors.primary} />
              <Text style={styles.text}>
                {t('statistics.totalWords')}: {statistics.totalWords}
              </Text>
            </View>
            <View style={localStyles.statItem}>
              <Icon name="calendar" size={20} color={themeData.colors.primary} />
              <Text style={styles.text}>
                {t('statistics.todayWords')}: {statistics.todayWords}
              </Text>
            </View>
            <View style={localStyles.statItem}>
              <Icon name="trending-up" size={20} color={themeData.colors.primary} />
              <Text style={styles.text}>
                {t('statistics.streakDays')}: {statistics.streakDays}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={localStyles.actionButton}
          onPress={() => navigation.navigate('WordGroupList' as never)}
        >
          <Icon name="folder" size={24} color={themeData.colors.primary} />
          <Text style={[styles.text, { marginLeft: 12, fontSize: 16 }]}>
            {t('wordGroup.title')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.actionButton}
          onPress={() => navigation.navigate('LearnTab' as never)}
        >
          <Icon name="book-open" size={24} color={themeData.colors.primary} />
          <Text style={[styles.text, { marginLeft: 12, fontSize: 16 }]}>
            {t('learning.title')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.actionButton}
          onPress={() => navigation.navigate('ReviewTab' as never)}
        >
          <Icon name="refresh-cw" size={24} color={themeData.colors.primary} />
          <Text style={[styles.text, { marginLeft: 12, fontSize: 16 }]}>
            {t('review.title')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});

export default HomePage;

