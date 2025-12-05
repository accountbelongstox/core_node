/**
 * Reading Mode Page - Core Learning Feature
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { wordApi, memoryApi } from '@/qy/qy_services/api-service';
import { Word, MemoryRecord } from '@/qy/qy_types';
import Tts from 'react-native-tts';
import Icon from 'react-native-vector-icons/Feather';

const ReadingModePage: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute();
  const { themeData, settings } = useStore();
  const styles = createStyles(themeData);
  const groupId = (route.params as any)?.groupId;
  
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    loadWords();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      Tts.stop();
    };
  }, []);

  const loadWords = async () => {
    try {
      const response = await wordApi.list(groupId);
      if (response.success && response.data) {
        setWords(response.data.slice(0, 100)); // Default 100 words
      }
    } catch (error) {
      console.error('Failed to load words:', error);
    } finally {
      setLoading(false);
    }
  };

  const speakWord = async (word: Word) => {
    const text = `${word.word}. ${word.definitions[0]?.meaning || ''}`;
    await Tts.speak(text);
  };

  const playNext = () => {
    if (currentIndex < words.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      historyRef.current.push(currentIndex);
      if (historyRef.current.length > 10) {
        historyRef.current.shift();
      }
      speakWord(words[nextIndex]);
      updateMemoryRecord(words[nextIndex].id);
    }
  };

  const playPrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      speakWord(words[prevIndex]);
    }
  };

  const instantReview = () => {
    if (historyRef.current.length > 0) {
      const prevIndex = historyRef.current.pop()!;
      setCurrentIndex(prevIndex);
      speakWord(words[prevIndex]);
    }
  };

  const startPlayback = () => {
    if (words.length === 0) return;
    
    setIsPlaying(true);
    const speed = settings?.learning.readingSpeed || 3;
    
    const playNextWord = () => {
      if (currentIndex < words.length - 1) {
        playNext();
        timerRef.current = setTimeout(playNextWord, speed * 1000);
      } else {
        setIsPlaying(false);
      }
    };
    
    speakWord(words[currentIndex]);
    timerRef.current = setTimeout(playNextWord, speed * 1000);
  };

  const pausePlayback = () => {
    setIsPlaying(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    Tts.stop();
  };

  const stopPlayback = () => {
    pausePlayback();
    setCurrentIndex(0);
    historyRef.current = [];
  };

  const updateMemoryRecord = async (wordId: string) => {
    try {
      const response = await memoryApi.getRecords();
      if (response.success && response.data) {
        const record = response.data.find(r => r.wordId === wordId);
        if (record) {
          await memoryApi.update(wordId, {
            isRead: true,
            readCount: record.readCount + 1,
            lastReviewedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to update memory record:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={themeData.colors.primary} />
      </View>
    );
  }

  if (words.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>暂无单词</Text>
      </View>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <View style={styles.container}>
      <View style={localStyles.progressBar}>
        <View
          style={[
            localStyles.progressFill,
            {
              width: `${((currentIndex + 1) / words.length) * 100}%`,
              backgroundColor: themeData.colors.primary,
            },
          ]}
        />
      </View>
      <Text style={localStyles.progressText}>
        {currentIndex + 1} / {words.length}
      </Text>

      <View style={localStyles.wordContainer}>
        <Text style={localStyles.wordText}>{currentWord.word}</Text>
        {currentWord.phonetic && (
          <Text style={localStyles.phoneticText}>{currentWord.phonetic}</Text>
        )}
        {currentWord.definitions[0] && (
          <Text style={localStyles.meaningText}>
            {currentWord.definitions[0].meaning}
          </Text>
        )}
      </View>

      <View style={localStyles.controls}>
        <TouchableOpacity
          style={localStyles.controlButton}
          onPress={playPrevious}
          disabled={currentIndex === 0}
        >
          <Icon name="skip-back" size={24} color={themeData.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.controlButton}
          onPress={isPlaying ? pausePlayback : startPlayback}
        >
          <Icon
            name={isPlaying ? 'pause' : 'play'}
            size={32}
            color={themeData.colors.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.controlButton}
          onPress={playNext}
          disabled={currentIndex === words.length - 1}
        >
          <Icon name="skip-forward" size={24} color={themeData.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.controlButton}
          onPress={instantReview}
          disabled={historyRef.current.length === 0}
        >
          <Icon name="rotate-ccw" size={24} color={themeData.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.controlButton}
          onPress={stopPlayback}
        >
          <Icon name="square" size={24} color={themeData.colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#757575',
  },
  wordContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  wordText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  phoneticText: {
    fontSize: 20,
    color: '#757575',
    marginBottom: 16,
  },
  meaningText: {
    fontSize: 18,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  controlButton: {
    padding: 12,
  },
});

export default ReadingModePage;

