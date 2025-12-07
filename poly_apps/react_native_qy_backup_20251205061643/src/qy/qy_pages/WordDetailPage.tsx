/**
 * Word Detail Page
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { wordApi, dictionaryApi } from '@/qy/qy_services/api-service';
import { Word, DictionaryData } from '@/qy/qy_types';
import Icon from 'react-native-vector-icons/Feather';

const WordDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute();
  const { themeData } = useStore();
  const styles = createStyles(themeData);
  const [word, setWord] = useState<Word | null>(null);
  const [dictionary, setDictionary] = useState<DictionaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const wordId = (route.params as any)?.wordId;

  useEffect(() => {
    if (wordId) {
      loadData();
    }
  }, [wordId]);

  const loadData = async () => {
    try {
      const wordResponse = await wordApi.getDetail(wordId);
      if (wordResponse.success && wordResponse.data) {
        setWord(wordResponse.data);
        
        // Load dictionary data
        const dictResponse = await dictionaryApi.lookup(wordResponse.data.word);
        if (dictResponse.success && dictResponse.data) {
          setDictionary(dictResponse.data);
        }
      }
    } catch (error) {
      console.error('Failed to load word data:', error);
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

  const displayData = dictionary || word;

  return (
    <ScrollView style={styles.container}>
      {displayData && (
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={[styles.text, { fontSize: 32, fontWeight: 'bold', marginBottom: 8 }]}>
            {displayData.word}
          </Text>
          {displayData.phonetic && (
            <Text style={styles.textSecondary}>{displayData.phonetic}</Text>
          )}

          <View style={{ marginTop: 24 }}>
            {displayData.definitions.map((def, index) => (
              <View key={index} style={localStyles.definitionItem}>
                <Text style={[styles.text, { fontWeight: '600' }]}>
                  {def.partOfSpeech}. {def.meaning}
                </Text>
              </View>
            ))}
          </View>

          {displayData.examples && displayData.examples.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 12 }]}>
                例句
              </Text>
              {displayData.examples.map((example, index) => (
                <View key={index} style={localStyles.exampleItem}>
                  <Text style={styles.text}>{example.sentence}</Text>
                  <Text style={styles.textSecondary}>{example.translation}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={localStyles.playButton}>
            <Icon name="volume-2" size={24} color={themeData.colors.primary} />
            <Text style={[styles.text, { color: themeData.colors.primary, marginLeft: 8 }]}>
              播放发音
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  definitionItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  exampleItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
});

export default WordDetailPage;

