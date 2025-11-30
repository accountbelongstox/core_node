import 'package:qyflutter/apps/app_qy/services_app_qy/api_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/api_endpoints_app_qy.dart';
import 'package:qyflutter/apps/app_qy/models_app_qy/vocabulary_models_app_qy.dart';

class VocabularyRecommendationServiceAppQy {
  static final VocabularyRecommendationServiceAppQy _instance =
      VocabularyRecommendationServiceAppQy._internal();
  factory VocabularyRecommendationServiceAppQy() => _instance;

  final ApiServiceAppQy _apiService;

  VocabularyRecommendationServiceAppQy._internal() : _apiService = ApiServiceAppQy();

  Future<List<VocabularyRecommendationModel>> getRecommendations({
    required List<String> langCodes,
    String? level,
    String? category,
  }) async {
    try {
      final response = await _apiService.get(
        ApiEndpointsAppQy.vocabularyRecommendations,
        queryParameters: {
          'lang_codes': langCodes,
          if (level != null && level != 'all') 'level': level,
          if (category != null && category != 'all') 'category': category,
        },
      );

      if (response['success'] == true) {
        final data = response['data'] as List<dynamic>?;
        if (data != null) {
          return data
              .map((json) => VocabularyRecommendationModel.fromJson(json as Map<String, dynamic>))
              .toList();
        }
      }

      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> selectCollection({
    required int collectionId,
    required String action,
  }) async {
    try {
      final response = await _apiService.post(
        ApiEndpointsAppQy.vocabularyCollectionSelect,
        data: {
          'collection_id': collectionId,
          'action': action,
        },
      );

      return response['success'] == true;
    } catch (e) {
      return false;
    }
  }

  Future<List<VocabularyRecommendationModel>> getSelectedCollections() async {
    try {
      final response = await _apiService.get(
        ApiEndpointsAppQy.vocabularyCollectionSelected,
      );

      if (response['success'] == true) {
        final data = response['data'] as List<dynamic>?;
        if (data != null) {
          return data
              .map((json) => VocabularyRecommendationModel.fromJson(json as Map<String, dynamic>))
              .toList();
        }
      }

      return [];
    } catch (e) {
      return [];
    }
  }

  Map<String, List<String>> getFilterOptions(List<VocabularyRecommendationModel> recommendations) {
    final levels = <String>{};
    final categories = <String>{};

    for (final rec in recommendations) {
      levels.add(rec.level);
      categories.add(rec.category);
    }

    return {
      'levels': levels.toList(),
      'categories': categories.toList(),
    };
  }

  List<VocabularyRecommendationModel> filterRecommendations({
    required List<VocabularyRecommendationModel> recommendations,
    String? level,
    String? category,
    String? langCode,
  }) {
    return recommendations.where((rec) {
      if (level != null && level != 'all' && !rec.level.contains(level)) {
        return false;
      }
      if (category != null && category != 'all' && rec.category != category) {
        return false;
      }
      if (langCode != null && langCode != 'all' && rec.langCode != langCode) {
        return false;
      }
      return true;
    }).toList();
  }

  List<VocabularyRecommendationModel> sortRecommendations({
    required List<VocabularyRecommendationModel> recommendations,
    String sortBy = 'popular',
  }) {
    final sorted = List<VocabularyRecommendationModel>.from(recommendations);

    switch (sortBy) {
      case 'popular':
        sorted.sort((a, b) {
          if (a.isPopular != b.isPopular) {
            return b.isPopular ? 1 : -1;
          }
          return a.difficulty.compareTo(b.difficulty);
        });
        break;
      case 'difficulty_asc':
        sorted.sort((a, b) => a.difficulty.compareTo(b.difficulty));
        break;
      case 'difficulty_desc':
        sorted.sort((a, b) => b.difficulty.compareTo(a.difficulty));
        break;
      case 'words_asc':
        sorted.sort((a, b) => a.totalWords.compareTo(b.totalWords));
        break;
      case 'words_desc':
        sorted.sort((a, b) => b.totalWords.compareTo(a.totalWords));
        break;
      case 'time_asc':
        sorted.sort((a, b) => a.estimatedDays.compareTo(b.estimatedDays));
        break;
      case 'time_desc':
        sorted.sort((a, b) => b.estimatedDays.compareTo(a.estimatedDays));
        break;
    }

    return sorted;
  }
}
