/**
 * Word Group Detail Page
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { wordGroupApi, wordApi } from '@/qy/qy_services/api-service';
import { WordGroup, Word } from '@/qy/qy_types';
import Icon from 'react-native-vector-icons/Feather';

const WordGroupDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { themeData } = useStore();
  const styles = createStyles(themeData);
  const [group, setGroup] = useState<WordGroup | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const groupId = (route.params as any)?.groupId;

  useEffect(() => {
    if (groupId) {
      loadData();
    }
  }, [groupId]);

  const loadData = async () => {
    try {
      const [groupResponse, wordsResponse] = await Promise.all([
        wordGroupApi.getDetail(groupId),
        wordApi.list(groupId),
      ]);
      
      if (groupResponse.success && groupResponse.data) {
        setGroup(groupResponse.data);
      }
      
      if (wordsResponse.success && wordsResponse.data) {
        setWords(wordsResponse.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
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
      {group && (
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={[styles.text, { fontSize: 20, fontWeight: 'bold', marginBottom: 8 }]}>
            {group.name}
          </Text>
          <Text style={styles.textSecondary}>
            已学: {group.learnedCount} / {group.wordCount}
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 16 }]}>
          单词列表
        </Text>
        {words.map((word) => (
          <TouchableOpacity
            key={word.id}
            style={localStyles.wordItem}
            onPress={() => navigation.navigate('WordDetail' as never, { wordId: word.id } as never)}
          >
            <Text style={[styles.text, { fontSize: 16 }]}>{word.word}</Text>
            <Icon name="chevron-right" size={24} color={themeData.colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[localStyles.startButton, { backgroundColor: themeData.colors.primary }]}
        onPress={() => navigation.navigate('ReadingMode' as never, { groupId } as never)}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          开始学习
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  startButton: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
});

export default WordGroupDetailPage;

