import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../../services/api';

interface Word {
  word_id: number;
  word: string;
  proficiency: number;
  read_count: number;
  review_count: number;
  next_review_at: string;
  weight: number;
}

const { width } = Dimensions.get('window');

export default function StudySession() {
  const route = useRoute();
  const navigation = useNavigation();
  const { gid } = route.params as { gid: string };

  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    total: 0,
  });

  const fadeAnim = useState(new Animated.Value(1))[0];
  const scaleAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    loadReviewWords();
  }, [gid]);

  const loadReviewWords = async () => {
    try {
      setLoading(true);
      const response = await api.post('/app_qy_v1/group/get_review_words', {
        gid,
        limit: 20,
        proficiency_max: 95,
      });

      if (response.data.status === 'success') {
        const reviewWords = response.data.data.words || [];
        if (reviewWords.length === 0) {
          Alert.alert(
            'All Caught Up!',
            'No words need review right now. Great job!',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else {
          setWords(reviewWords);
          setSessionStats({ ...sessionStats, total: reviewWords.length });
        }
      }
    } catch (error) {
      console.error('Error loading review words:', error);
      Alert.alert('Error', 'Failed to load words for review');
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (isCorrect: boolean) => {
    const currentWord = words[currentIndex];

    try {
      await api.post('/app_qy_v1/group/update_progress', {
        gid,
        word_id: currentWord.word_id,
        action: 'review',
        is_correct: isCorrect,
      });

      setSessionStats((prev) => ({
        ...prev,
        correct: isCorrect ? prev.correct + 1 : prev.correct,
        incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect,
      }));
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handleAnswer = (isCorrect: boolean) => {
    updateProgress(isCorrect);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      if (currentIndex < words.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        showSessionSummary();
      }
    });
  };

  const showSessionSummary = () => {
    const accuracy = ((sessionStats.correct / sessionStats.total) * 100).toFixed(1);
    Alert.alert(
      'Session Complete!',
      `Great work!\n\nCorrect: ${sessionStats.correct}\nIncorrect: ${sessionStats.incorrect}\nAccuracy: ${accuracy}%`,
      [
        { text: 'Review Again', onPress: () => loadReviewWords() },
        { text: 'Finish', onPress: () => navigation.goBack() },
      ]
    );
  };

  const skipWord = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    } else {
      showSessionSummary();
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading words...</Text>
      </View>
    );
  }

  if (words.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No words to review</Text>
      </View>
    );
  }

  const currentWord = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {currentIndex + 1} / {words.length}
          </Text>
          <Text style={styles.accuracyText}>
            ✓ {sessionStats.correct} ✗ {sessionStats.incorrect}
          </Text>
        </View>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.proficiencyContainer}>
            <Text style={styles.proficiencyLabel}>Proficiency</Text>
            <Text style={styles.proficiencyValue}>
              {currentWord.proficiency.toFixed(0)}%
            </Text>
          </View>

          <View style={styles.wordContainer}>
            <Text style={styles.wordText}>{currentWord.word}</Text>
          </View>

          <View style={styles.hintsContainer}>
            <Text style={styles.hintText}>
              Reviewed: {currentWord.review_count} times
            </Text>
            <Text style={styles.hintText}>Weight: {currentWord.weight}</Text>
          </View>

          {showAnswer && (
            <View style={styles.answerContainer}>
              <Text style={styles.answerLabel}>Do you know this word?</Text>
              <Text style={styles.answerHint}>
                Think about its meaning, pronunciation, and usage.
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      <View style={styles.actionsContainer}>
        {!showAnswer ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.showButton]}
              onPress={() => setShowAnswer(true)}
            >
              <Text style={styles.actionButtonText}>Show Answer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.skipButton]}
              onPress={skipWord}
            >
              <Text style={[styles.actionButtonText, styles.skipButtonText]}>
                Skip
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.answerButtons}>
            <TouchableOpacity
              style={[styles.answerButton, styles.incorrectButton]}
              onPress={() => handleAnswer(false)}
            >
              <Text style={styles.answerButtonText}>Don't Know</Text>
              <Text style={styles.answerButtonSubtext}>-10%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.answerButton, styles.correctButton]}
              onPress={() => handleAnswer(true)}
            >
              <Text style={styles.answerButtonText}>Know It</Text>
              <Text style={styles.answerButtonSubtext}>+5%</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  statsContainer: {
    flex: 1,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  accuracyText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: width - 48,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  proficiencyContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  proficiencyLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  proficiencyValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  wordContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  wordText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  hintsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
  },
  hintText: {
    fontSize: 14,
    color: '#6b7280',
  },
  answerContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  answerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  answerHint: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  actionsContainer: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  showButton: {
    backgroundColor: '#3b82f6',
  },
  skipButton: {
    backgroundColor: '#f3f4f6',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  skipButtonText: {
    color: '#6b7280',
  },
  answerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  answerButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  incorrectButton: {
    backgroundColor: '#ef4444',
  },
  correctButton: {
    backgroundColor: '#10b981',
  },
  answerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  answerButtonSubtext: {
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.8,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 48,
  },
});
