// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Learning service for QY App - handles API calls for learning data
library;

import '../model/learning_stats_model.dart';
import '../../../../../services_app_qy/api_service_app_qy.dart';

class LearningService {
  final ApiServiceAppQy _apiService;

  const LearningService({
    required ApiServiceAppQy apiService,
  }) : _apiService = apiService;

  Future<LearningStatsModel> getLearningStats() async {
    try {
      final response = await _apiService.get('/api/v1/learning/stats');
      return LearningStatsModel.fromJson(response.data as Map<String, dynamic>);
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
      return response.data as Map<String, dynamic>;
    } catch (e) {
      return {
        'name': '默认词书',
        'total_words': 16952,
        'learned': 27,
        'remaining': 16925,
      };
    }
  }
}
