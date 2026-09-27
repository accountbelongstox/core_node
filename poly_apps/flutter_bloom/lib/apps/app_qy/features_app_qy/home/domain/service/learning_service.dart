/// Learning service for QY App - handles API calls for learning data
library;

import '../model/learning_stats_model.dart';
import '../../../../services_app_qy/api_service_app_qy.dart';
import '../../../word/sources/word_book_data_service.dart';

class LearningService {
  final ApiServiceAppQy _apiService;

  const LearningService({
    required ApiServiceAppQy apiService,
  }) : _apiService = apiService;

  Future<LearningStatsModel> getLearningStats() async {
    try {
      final response = await _apiService.get('/api/v1/learning/stats');
      final data = response['data'] ?? response;
      return LearningStatsModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      return LearningStatsModel.empty();
    }
  }

  Future<void> startLearningSession() async {
    try {
      await _apiService.post('/api/v1/learning/session/start', data: {
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      rethrow;
    }
  }

  Future<void> updateProgress({
    required int newWordsLearned,
    required int reviewWordsCompleted,
  }) async {
    try {
      await _apiService.post('/api/v1/learning/progress', data: {
        'new_words_learned': newWordsLearned,
        'review_words_completed': reviewWordsCompleted,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      rethrow;
    }
  }

  Future<void> checkIn() async {
    try {
      await _apiService.post('/api/v1/learning/check-in', data: {
        'date': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getWordBookInfo() async {
    try {
      final response = await _apiService.get('/api/v1/learning/wordbook');
      final data = response['data'] ?? response;
      return data as Map<String, dynamic>;
    } catch (e) {
      return WordBookDataService.getDefaultWordBookInfo();
    }
  }
}
