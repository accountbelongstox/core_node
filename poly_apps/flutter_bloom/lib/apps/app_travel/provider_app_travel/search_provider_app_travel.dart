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

import 'package:flutter/foundation.dart';
import '../models_app_travel/sight_model_app_travel.dart';
import '../services_app_travel/cache_service.dart';

class SearchProviderAppTravel extends ChangeNotifier {
  final CacheService _cacheService;
  String _searchQuery;
  List<SightModelAppTravel> _searchResults;
  List<String> _searchHistory;
  List<String> _hotSearches;
  bool _isSearching;
  bool _isLoading;
  String? _errorMessage;

  SearchProviderAppTravel({
    CacheService? cacheService,
  })  : _cacheService = cacheService ?? CacheService(),
        _searchQuery = '',
        _searchResults = [],
        _searchHistory = [],
        _hotSearches = [],
        _isSearching = false,
        _isLoading = false,
        _errorMessage = null {
    _loadSearchHistory();
    _loadHotSearches();
  }

  String get searchQuery => _searchQuery;
  List<SightModelAppTravel> get searchResults => _searchResults;
  List<String> get searchHistory => _searchHistory;
  List<String> get hotSearches => _hotSearches;
  bool get isSearching => _isSearching;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get hasResults => _searchResults.isNotEmpty;
  bool get hasHistory => _searchHistory.isNotEmpty;

  Future<void> _loadSearchHistory() async {
    try {
      final history = _cacheService.getSearchHistory();
      _searchHistory = history;
      notifyListeners();
    } catch (e) {
      debugPrint('Load search history error: $e');
    }
  }

  void _loadHotSearches() {
    _hotSearches = [
      'Beach',
      'Mountain',
      'City Tour',
      'Historical Sites',
      'Food Tour',
      'Adventure',
      'Relaxation',
      'Photography',
    ];
    notifyListeners();
  }

  Future<void> search(String query) async {
    if (query.trim().isEmpty) {
      _searchQuery = '';
      _searchResults = [];
      _isSearching = false;
      notifyListeners();
      return;
    }

    try {
      _searchQuery = query;
      _isSearching = true;
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      await Future.delayed(const Duration(milliseconds: 500));

      _searchResults = _mockSearchResults(query);

      await _addToSearchHistory(query);

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
      debugPrint('Search error: $e');
    }
  }

  List<SightModelAppTravel> _mockSearchResults(String query) {
    final lowerQuery = query.toLowerCase();
    final allSights = [
      SightModelAppTravel(
        id: 'sight_1',
        title: 'Great Wall',
        imageUrl: 'https://via.placeholder.com/300x200?text=Great+Wall',
        location: 'Beijing',
        rating: 4.8,
        price: 100.0,
        description: 'Ancient Chinese fortification',
        tags: ['Historical', 'UNESCO', 'Adventure'],
      ),
      SightModelAppTravel(
        id: 'sight_2',
        title: 'West Lake',
        imageUrl: 'https://via.placeholder.com/300x200?text=West+Lake',
        location: 'Hangzhou',
        rating: 4.7,
        price: 0.0,
        description: 'Beautiful scenic lake',
        tags: ['Nature', 'Relaxation', 'Photography'],
      ),
      SightModelAppTravel(
        id: 'sight_3',
        title: 'Terracotta Army',
        imageUrl: 'https://via.placeholder.com/300x200?text=Terracotta+Army',
        location: 'Xi\'an',
        rating: 4.9,
        price: 150.0,
        description: 'Ancient archaeological site',
        tags: ['Historical', 'UNESCO', 'Museum'],
      ),
      SightModelAppTravel(
        id: 'sight_4',
        title: 'Yellow Mountain',
        imageUrl: 'https://via.placeholder.com/300x200?text=Yellow+Mountain',
        location: 'Anhui',
        rating: 4.8,
        price: 200.0,
        description: 'Stunning mountain scenery',
        tags: ['Nature', 'Adventure', 'Photography'],
      ),
      SightModelAppTravel(
        id: 'sight_5',
        title: 'Bund',
        imageUrl: 'https://via.placeholder.com/300x200?text=The+Bund',
        location: 'Shanghai',
        rating: 4.6,
        price: 0.0,
        description: 'Historic waterfront area',
        tags: ['City', 'Photography', 'Historical'],
      ),
    ];

    return allSights.where((sight) {
      return sight.title.toLowerCase().contains(lowerQuery) ||
          sight.location.toLowerCase().contains(lowerQuery) ||
          sight.description.toLowerCase().contains(lowerQuery) ||
          sight.tags.any((tag) => tag.toLowerCase().contains(lowerQuery));
    }).toList();
  }

  Future<void> _addToSearchHistory(String query) async {
    try {
      if (!_searchHistory.contains(query)) {
        _searchHistory.insert(0, query);
        if (_searchHistory.length > 10) {
          _searchHistory = _searchHistory.sublist(0, 10);
        }
        await _cacheService.saveSearchHistory(_searchHistory);
      }
    } catch (e) {
      debugPrint('Add to search history error: $e');
    }
  }

  Future<void> clearSearchHistory() async {
    try {
      _searchHistory = [];
      await _cacheService.saveSearchHistory([]);
      notifyListeners();
    } catch (e) {
      debugPrint('Clear search history error: $e');
    }
  }

  void clearSearch() {
    _searchQuery = '';
    _searchResults = [];
    _isSearching = false;
    _errorMessage = null;
    notifyListeners();
  }

  void selectHotSearch(String query) {
    search(query);
  }

  void selectHistoryItem(String query) {
    search(query);
  }

  void removeHistoryItem(String query) {
    _searchHistory.remove(query);
    _cacheService.saveSearchHistory(_searchHistory);
    notifyListeners();
  }
}
