import '../models_app_travel/city_model.dart';
import '../services_app_travel/data_service.dart';
import '../services_app_travel/cache_service.dart';

class CityRepository {
  final DataService _dataService;
  final CacheService _cacheService;
  CityDataResponse? _cachedResponse;

  CityRepository({
    DataService? dataService,
    CacheService? cacheService,
  })  : _dataService = dataService ?? DataService(),
        _cacheService = cacheService ?? CacheService();

  Future<CityDataResponse> getCityData({bool forceRefresh = false}) async {
    if (!forceRefresh && _cachedResponse != null) {
      return _cachedResponse!;
    }

    try {
      final Map<String, dynamic> jsonData = await _dataService.loadCityData();
      final CityDataResponse response = CityDataResponse.fromJson(jsonData);

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
      throw Exception('Failed to load city data: $e');
    }
  }

  List<CityModel> searchCities(String query) {
    if (_cachedResponse == null || query.isEmpty) {
      return [];
    }

    final String lowerQuery = query.toLowerCase();
    final List<CityModel> results = [];

    for (final cities in _cachedResponse!.data.cities.values) {
      for (final city in cities) {
        if (city.name.toLowerCase().contains(lowerQuery) ||
            city.spell.toLowerCase().contains(lowerQuery)) {
          results.add(city);
        }
      }
    }

    return results;
  }

  Future<void> saveCurrentCity(CityModel city) async {
    await _cacheService.saveCurrentCity(city.name);
  }

  String? getCurrentCity() {
    return _cacheService.getCurrentCity();
  }

  Future<void> _saveToCacheIfNeeded(Map<String, dynamic> data) async {
    try {
      await _cacheService.setJson('city_data', data);
    } catch (e) {
      // Silently fail cache save
    }
  }

  CityDataResponse? _loadFromCache() {
    try {
      final cachedJson = _cacheService.getJson('city_data');
      if (cachedJson != null) {
        return CityDataResponse.fromJson(cachedJson);
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
