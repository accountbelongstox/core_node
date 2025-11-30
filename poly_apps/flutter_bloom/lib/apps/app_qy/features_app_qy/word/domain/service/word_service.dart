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

/// Word service for QY App - handles API calls for word data
library;

import '../model/word_model.dart';
import '../../../../services_app_qy/api_service_app_qy.dart';
import '../../data/word_book_data_service.dart';

class WordService {
  final ApiServiceAppQy _apiService;

  const WordService({
    required ApiServiceAppQy apiService,
  }) : _apiService = apiService;

  Future<List<WordBookModel>> getWordBooks() async {
    try {
      final response = await _apiService.get('/api/v1/words/books');
      final responseData = response['data'] ?? response;
      final data = (responseData is List) ? responseData : (responseData['books'] ?? responseData['items'] ?? []);
      final dataList = data as List<dynamic>;
      return dataList.map((json) => WordBookModel.fromJson(json as Map<String, dynamic>)).toList();
    } catch (e) {
      return _getMockWordBooks();
    }
  }

  Future<WordBookModel> getWordBookById(String id) async {
    try {
      final response = await _apiService.get('/api/v1/words/books/$id');
      final data = response['data'] ?? response;
      return WordBookModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      return _getMockWordBooks().first;
    }
  }

  Future<List<WordModel>> getWordsByBook(String bookId, {int page = 1, int limit = 20}) async {
    try {
      final response = await _apiService.get(
        '/api/v1/words/books/$bookId/words',
        queryParameters: {'page': page, 'limit': limit},
      );
      final responseData = response['data'] ?? response;
      final wordsData = (responseData is Map) ? (responseData['words'] ?? responseData['items'] ?? []) : [];
      final dataList = wordsData as List<dynamic>;
      return dataList.map((json) => WordModel.fromJson(json as Map<String, dynamic>)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<WordModel> getWordById(String id) async {
    try {
      final response = await _apiService.get('/api/v1/words/$id');
      final data = response['data'] ?? response;
      return WordModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> toggleFavorite(String wordId) async {
    try {
      await _apiService.post('/api/v1/words/$wordId/favorite');
    } catch (e) {
      rethrow;
    }
  }

  Future<void> markAsLearned(String wordId) async {
    try {
      await _apiService.post('/api/v1/words/$wordId/learned');
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> searchWords(String query) async {
    try {
      final response = await _apiService.get(
        '/api/v1/words/search',
        queryParameters: {'q': query},
      );
      final data = response['data'] ?? response;
      return data as Map<String, dynamic>;
    } catch (e) {
      return {};
    }
  }

  List<WordBookModel> _getMockWordBooks() {
    return WordBookDataService.getMockWordBooks();
  }
}
