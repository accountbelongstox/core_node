import '../model/dictionary_model.dart';

/// Dictionary Service
/// Handles fetching and managing recommended dictionaries
class DictionaryService {
  // Singleton pattern
  static final DictionaryService _instance = DictionaryService._internal();
  factory DictionaryService() => _instance;
  DictionaryService._internal();

  // Cache for dictionaries
  List<DictionaryModel>? _cachedDictionaries;

  /// Fetch recommended dictionaries
  /// In production, this would call API
  Future<List<DictionaryModel>> fetchRecommendedDictionaries() async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 500));

    // Return cached data if available
    if (_cachedDictionaries != null) {
      return _cachedDictionaries!;
    }

    // In production, this would call API
    // For now, return empty list (will be populated with mock data)
    _cachedDictionaries = [];
    return _cachedDictionaries!;
  }

  /// Add dictionary to user's collection
  Future<bool> addDictionaryToCollection(String dictionaryId) async {
    await Future.delayed(const Duration(milliseconds: 300));

    // Update cached data
    if (_cachedDictionaries != null) {
      final index = _cachedDictionaries!.indexWhere((d) => d.id == dictionaryId);
      if (index != -1) {
        _cachedDictionaries![index] = _cachedDictionaries![index].copyWith(isAdded: true);
      }
    }

    return true;
  }

  /// Remove dictionary from user's collection
  Future<bool> removeDictionaryFromCollection(String dictionaryId) async {
    await Future.delayed(const Duration(milliseconds: 300));

    // Update cached data
    if (_cachedDictionaries != null) {
      final index = _cachedDictionaries!.indexWhere((d) => d.id == dictionaryId);
      if (index != -1) {
        _cachedDictionaries![index] = _cachedDictionaries![index].copyWith(isAdded: false);
      }
    }

    return true;
  }

  /// Like a dictionary
  Future<bool> likeDictionary(String dictionaryId) async {
    await Future.delayed(const Duration(milliseconds: 200));

    // Update cached data
    if (_cachedDictionaries != null) {
      final index = _cachedDictionaries!.indexWhere((d) => d.id == dictionaryId);
      if (index != -1) {
        final dict = _cachedDictionaries![index];
        _cachedDictionaries![index] = dict.copyWith(likeCount: dict.likeCount + 1);
      }
    }

    return true;
  }

  /// Search dictionaries
  Future<List<DictionaryModel>> searchDictionaries(String query) async {
    await Future.delayed(const Duration(milliseconds: 300));

    if (_cachedDictionaries == null) {
      return [];
    }

    final lowercaseQuery = query.toLowerCase();
    return _cachedDictionaries!.where((dict) {
      return dict.title.toLowerCase().contains(lowercaseQuery) ||
          dict.description.toLowerCase().contains(lowercaseQuery) ||
          dict.tags.any((tag) => tag.toLowerCase().contains(lowercaseQuery));
    }).toList();
  }

  /// Filter dictionaries by category
  List<DictionaryModel> filterByCategory(String category) {
    if (_cachedDictionaries == null) {
      return [];
    }

    return _cachedDictionaries!.where((dict) => dict.category == category).toList();
  }

  /// Filter dictionaries by difficulty
  List<DictionaryModel> filterByDifficulty(String difficulty) {
    if (_cachedDictionaries == null) {
      return [];
    }

    return _cachedDictionaries!.where((dict) => dict.difficulty == difficulty).toList();
  }

  /// Clear cache
  void clearCache() {
    _cachedDictionaries = null;
  }

  /// Set mock data (for testing)
  void setMockData(List<DictionaryModel> dictionaries) {
    _cachedDictionaries = dictionaries;
  }
}
