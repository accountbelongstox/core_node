import 'azure_maps_service.dart';

class AzureMapsFlutterIntegration {
  final AzureMapsService _service;

  AzureMapsFlutterIntegration({
    String? language,
    String? view,
  }) : _service = AzureMapsService(
          language: language,
          view: view,
        );

  Map<String, dynamic> createTileLayerOptions({
    AzureMapTileset tileset = AzureMapTileset.road,
    String? customLanguage,
    String? customView,
  }) {
    final tilesetId = _getTilesetIdString(tileset);
    final tileSize = _getTileSizeForTileset(tileset);

    return {
      'urlTemplate': _service.getTileUrl(
        tileset: tileset,
        customLanguage: customLanguage,
        customView: customView,
      ),
      'additionalOptions': {
        'tilesetId': tilesetId,
        'tileSize': tileSize,
        'language': customLanguage ?? _service.language,
        'view': customView ?? _service.view,
      },
    };
  }

  String _getTilesetIdString(AzureMapTileset tileset) {
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

  int _getTileSizeForTileset(AzureMapTileset tileset) {
    switch (tileset) {
      case AzureMapTileset.road:
      case AzureMapTileset.darkGrey:
      case AzureMapTileset.hybridRoad:
        return 512;
      case AzureMapTileset.imagery:
      case AzureMapTileset.weatherInfrared:
      case AzureMapTileset.weatherRadar:
        return 256;
    }
  }

  String getTileUrl(AzureMapTileset tileset) {
    return _service.getTileUrl(tileset: tileset);
  }

  String getSearchUrl() {
    return _service.getSearchUrl();
  }

  String getReverseGeocodeUrl() {
    return _service.getReverseGeocodeUrl();
  }

  String getRouteUrl() {
    return _service.getRouteUrl();
  }

  String getTimeZoneUrl() {
    return _service.getTimeZoneUrl();
  }

  AzureMapsFlutterIntegration copyWith({
    String? language,
    String? view,
  }) {
    return AzureMapsFlutterIntegration(
      language: language ?? _service.language,
      view: view ?? _service.view,
    );
  }

  static List<String> getSupportedLanguages() {
    return AzureMapsService.getSupportedLanguages();
  }

  static List<String> getSupportedViews() {
    return AzureMapsService.getSupportedViews();
  }
}
