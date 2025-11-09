import 'azure_maps_config.dart';

enum AzureMapTileset {
  road,
  darkGrey,
  hybridRoad,
  imagery,
  weatherInfrared,
  weatherRadar,
}

class AzureMapsService {
  final String language;
  final String view;

  AzureMapsService({
    String? language,
    String? view,
  })  : language = language ?? AzureMapsConfig.getDefaultLanguage(),
        view = view ?? AzureMapsConfig.getDefaultView();

  String _getTilesetId(AzureMapTileset tileset) {
    switch (tileset) {
      case AzureMapTileset.road:
        return 'microsoft.base.road';
      case AzureMapTileset.darkGrey:
        return 'microsoft.base.darkgrey';
      case AzureMapTileset.hybridRoad:
        return 'microsoft.base.hybrid.road';
      case AzureMapTileset.imagery:
        return 'microsoft.imagery';
      case AzureMapTileset.weatherInfrared:
        return 'microsoft.weather.infrared.main';
      case AzureMapTileset.weatherRadar:
        return 'microsoft.weather.radar.main';
    }
  }

  int _getTileSize(AzureMapTileset tileset) {
    final tilesetId = _getTilesetId(tileset);
    return AzureMapsConfig.tilesetConfig[tilesetId] ?? 512;
  }

  String getTileUrl({
    required AzureMapTileset tileset,
    String? customLanguage,
    String? customView,
  }) {
    final tilesetId = _getTilesetId(tileset);
    final tileSize = _getTileSize(tileset);
    final lang = customLanguage ?? language;
    final viewParam = customView ?? view;
    final subscriptionKey = AzureMapsConfig.getSubscriptionKey();

    return '${AzureMapsConfig.baseUrl}?'
        'api-version=${AzureMapsConfig.apiVersion}&'
        'tilesetId=$tilesetId&'
        'zoom={z}&'
        'x={x}&'
        'y={y}&'
        'tileSize=$tileSize&'
        'language=$lang&'
        'view=$viewParam&'
        'subscription-key=$subscriptionKey';
  }

  String getSearchUrl() {
    final subscriptionKey = AzureMapsConfig.getSubscriptionKey();
    return 'https://atlas.microsoft.com/search/address/json?'
        'api-version=1.0&'
        'language=$language&'
        'subscription-key=$subscriptionKey';
  }

  String getReverseGeocodeUrl() {
    final subscriptionKey = AzureMapsConfig.getSubscriptionKey();
    return 'https://atlas.microsoft.com/search/address/reverse/json?'
        'api-version=1.0&'
        'language=$language&'
        'subscription-key=$subscriptionKey';
  }

  String getRouteUrl() {
    final subscriptionKey = AzureMapsConfig.getSubscriptionKey();
    return 'https://atlas.microsoft.com/route/directions/json?'
        'api-version=1.0&'
        'language=$language&'
        'subscription-key=$subscriptionKey';
  }

  String getTimeZoneUrl() {
    final subscriptionKey = AzureMapsConfig.getSubscriptionKey();
    return 'https://atlas.microsoft.com/timezone/byCoordinates/json?'
        'api-version=1.0&'
        'subscription-key=$subscriptionKey';
  }

  static List<String> getSupportedLanguages() {
    return AzureMapsConfig.supportedLanguages;
  }

  static List<String> getSupportedViews() {
    return AzureMapsConfig.supportedViews;
  }

  AzureMapsService copyWith({
    String? language,
    String? view,
  }) {
    return AzureMapsService(
      language: language ?? this.language,
      view: view ?? this.view,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is AzureMapsService &&
        other.language == language &&
        other.view == view;
  }

  @override
  int get hashCode => language.hashCode ^ view.hashCode;

  @override
  String toString() {
    return 'AzureMapsService(language: $language, view: $view)';
  }
}
