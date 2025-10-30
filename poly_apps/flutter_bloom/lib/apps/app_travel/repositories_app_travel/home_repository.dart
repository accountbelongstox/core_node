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

import '../models_app_travel/home_data_model.dart';
import '../services_app_travel/data_service.dart';
import '../services_app_travel/cache_service.dart';

class HomeRepository {
  final DataService _dataService;
  final CacheService _cacheService;
  HomeDataResponse? _cachedResponse;

  HomeRepository({
    DataService? dataService,
    CacheService? cacheService,
  })  : _dataService = dataService ?? DataService(),
        _cacheService = cacheService ?? CacheService();

  Future<HomeDataResponse> getHomeData({bool forceRefresh = false}) async {
    if (!forceRefresh && _cachedResponse != null) {
      return _cachedResponse!;
    }

    try {
      final Map<String, dynamic> jsonData = await _dataService.loadHomeData();
      final HomeDataResponse response = HomeDataResponse.fromJson(jsonData);

      if (response.isSuccess) {
        _cachedResponse = response;
        await _saveToCacheIfNeeded(jsonData);
      }

      return response;
    } catch (e) {
      final cachedData = _loadFromCache();
      if (cachedData != null) {
        return cachedData;
      }
      throw Exception('Failed to load home data: $e');
    }
  }

  Future<void> _saveToCacheIfNeeded(Map<String, dynamic> data) async {
    try {
      await _cacheService.setJson('home_data', data);
    } catch (e) {
      // Silently fail cache save
    }
  }

  HomeDataResponse? _loadFromCache() {
    try {
      final cachedJson = _cacheService.getJson('home_data');
      if (cachedJson != null) {
        return HomeDataResponse.fromJson(cachedJson);
      }
    } catch (e) {
      // Silently fail cache load
    }
    return null;
  }

  void clearCache() {
    _cachedResponse = null;
  }
}
