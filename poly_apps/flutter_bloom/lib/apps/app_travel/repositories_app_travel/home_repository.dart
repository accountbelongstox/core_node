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
