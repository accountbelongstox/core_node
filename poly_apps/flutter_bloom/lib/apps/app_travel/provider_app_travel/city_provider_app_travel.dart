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
import '../models_app_travel/city_model.dart';
import '../repositories_app_travel/city_repository.dart';
import '../services_app_travel/cache_service.dart';

class CityProviderAppTravel extends ChangeNotifier {
  final CityRepository _cityRepository;
  final CacheService _cacheService;
  CityDataResponse? _cityData;
  bool _isLoading = false;
  String? _errorMessage;
  String _searchQuery = '';
  List<CityModel> _searchResults = [];
  List<String> _searchHistory = [];
  String? _selectedCity;

  CityProviderAppTravel({
    CityRepository? cityRepository,
    CacheService? cacheService,
  })  : _cityRepository = cityRepository ?? CityRepository(),
        _cacheService = cacheService ?? CacheService() {
    _loadCityData();
    _loadSearchHistory();
  }

  CityDataResponse? get cityData => _cityData;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get hasData => _cityData != null;
  bool get hasError => _errorMessage != null;
  String get searchQuery => _searchQuery;
  List<CityModel> get searchResults => _searchResults;
  List<String> get searchHistory => _searchHistory;
  String? get selectedCity => _selectedCity;

  List<CityModel> get hotCities => _cityData?.data.hotCities ?? [];
  List<String> get allLetters => _cityData?.data.getLetters() ?? [];

  Future<void> _loadCityData() async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      _cityData = await _cityRepository.getCityData();

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
      debugPrint('Load city data error: $e');
    }
  }

  Future<void> _loadSearchHistory() async {
    try {
      final history = _cacheService.getStringList('city_search_history');
      if (history != null) {
        _searchHistory = history;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Load search history error: $e');
    }
  }

  Future<void> _saveSearchHistory() async {
    try {
      await _cacheService.setStringList('city_search_history', _searchHistory);
    } catch (e) {
      debugPrint('Save search history error: $e');
    }
  }

  void searchCities(String query) {
    _searchQuery = query;

    if (query.isEmpty) {
      _searchResults = [];
    } else {
      _searchResults = _cityRepository.searchCities(query);
    }

    notifyListeners();
  }

  void clearSearch() {
    _searchQuery = '';
    _searchResults = [];
    notifyListeners();
  }

  Future<void> selectCity(String cityName) async {
    _selectedCity = cityName;

    if (!_searchHistory.contains(cityName)) {
      _searchHistory.insert(0, cityName);
      if (_searchHistory.length > 10) {
        _searchHistory = _searchHistory.sublist(0, 10);
      }
      await _saveSearchHistory();
    }

    notifyListeners();
  }

  Future<void> clearSearchHistory() async {
    _searchHistory = [];
    await _cacheService.remove('city_search_history');
    notifyListeners();
  }

  List<CityModel> getCitiesByLetter(String letter) {
    return _cityData?.data.cities[letter] ?? [];
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
