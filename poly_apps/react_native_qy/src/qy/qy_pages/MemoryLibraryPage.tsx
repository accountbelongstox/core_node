/**
 * Memory Library Page
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { memoryApi, wordApi } from '@/qy/qy_services/api-service';
import { MemoryRecord, Word } from '@/qy/qy_types';
import Icon from 'react-native-vector-icons/Feather';

const MemoryLibraryPage: React.FC = () => {
  const navigation = useNavigation();
  const { themeData } = useStore();
  const styles = createStyles(themeData);
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [words, setWords] = useState<Record<string, Word>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const recordsResponse = await memoryApi.getRecords();
      if (recordsResponse.success && recordsResponse.data) {
        setRecords(recordsResponse.data);
        
        // Load words
        const wordsMap: Record<string, Word> = {};
        for (const record of recordsResponse.data) {
          const wordResponse = await wordApi.getDetail(record.wordId);
          if (wordResponse.success && wordResponse.data) {
            wordsMap[record.wordId] = wordResponse.data;
          }
        }
        setWords(wordsMap);
      }
    } catch (error) {
      console.error('Failed to load memory records:', error);
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
          记忆库 ({records.length})
        </Text>
        {records.map((record) => {
          const word = words[record.wordId];
          if (!word) return null;
          
          return (
            <TouchableOpacity
              key={record.wordId}
              style={localStyles.recordItem}
              onPress={() => navigation.navigate('WordDetail' as never, { wordId: record.wordId } as never)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.text, { fontSize: 16, fontWeight: '600' }]}>
                  {word.word}
                </Text>
                <Text style={styles.textSecondary}>
                  掌握度: {record.mastery}% | 阅读次数: {record.readCount}
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={themeData.colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});

export default MemoryLibraryPage;

