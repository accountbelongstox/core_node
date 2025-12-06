/**
 * Learn Page
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { wordGroupApi } from '@/qy/qy_services/api-service';
import { WordGroup } from '@/qy/qy_types';
import Icon from 'react-native-vector-icons/Feather';

const LearnPage: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { themeData } = useStore();
  const styles = createStyles(themeData);
  const [wordGroups, setWordGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWordGroups();
  }, []);

  const loadWordGroups = async () => {
    try {
      const response = await wordGroupApi.list();
      if (response.success && response.data) {
        setWordGroups(response.data);
      }
    } catch (error) {
      console.error('Failed to load word groups:', error);
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
          {t('learning.title')}
        </Text>

        {wordGroups.length === 0 ? (
          <Text style={styles.textSecondary}>{t('wordGroup.empty')}</Text>
        ) : (
          wordGroups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={localStyles.groupItem}
              onPress={() => navigation.navigate('ReadingMode' as never, { groupId: group.id } as never)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.text, { fontSize: 16, fontWeight: '600' }]}>
                  {group.name}
                </Text>
                <Text style={styles.textSecondary}>
                  {group.learnedCount} / {group.wordCount} 已学
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={themeData.colors.textSecondary} />
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={localStyles.addButton}
          onPress={() => navigation.navigate('WordGroupList' as never)}
        >
          <Icon name="plus" size={20} color={themeData.colors.primary} />
          <Text style={[styles.text, { color: themeData.colors.primary, marginLeft: 8 }]}>
            {t('wordGroup.create')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
  },
});

export default LearnPage;

