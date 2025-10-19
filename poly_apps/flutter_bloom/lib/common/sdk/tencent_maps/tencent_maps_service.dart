import 'package:flutter/foundation.dart';
import 'tencent_maps_config.dart';

enum TencentMapStyle {
  normal,
  dark,
  light,
  satellite,
  traffic,
}

enum TencentMapMode {
  normal,
  navigation,
  streetView,
}

class TencentMapsService {
  final String apiKey;
  final String language;
  final String region;

  TencentMapsService({
    String? apiKey,
    String? language,
    String? region,
  })  : apiKey = apiKey ?? TencentMapsConfig.getApiKey(),
        language = language ?? TencentMapsConfig.getDefaultLanguage(),
        region = region ?? TencentMapsConfig.getDefaultRegion();

  String _getMapStyleId(TencentMapStyle style) {
    switch (style) {
      case TencentMapStyle.normal:
        return 'normal';
      case TencentMapStyle.dark:
        return 'dark';
      case TencentMapStyle.light:
        return 'light';
      case TencentMapStyle.satellite:
        return 'satellite';
      case TencentMapStyle.traffic:
        return 'traffic';
    }
  }

  String getWebServiceUrl(String service) {
    return '${TencentMapsConfig.baseUrl}/$service';
  }

  String getGeocoderUrl() {
    return '${TencentMapsConfig.baseUrl}/ws/geocoder/v1/?'
        'key=$apiKey&'
        'output=json';
  }

  String getReverseGeocoderUrl({
    required double latitude,
    required double longitude,
  }) {
    return '${TencentMapsConfig.baseUrl}/ws/geocoder/v1/?'
        'location=$latitude,$longitude&'
        'key=$apiKey&'
        'output=json&'
        'get_poi=1';
  }

  String getSearchUrl() {
    return '${TencentMapsConfig.baseUrl}/ws/place/v1/search?'
        'key=$apiKey&'
        'output=json';
  }

  String getSuggestionUrl() {
    return '${TencentMapsConfig.baseUrl}/ws/place/v1/suggestion?'
        'key=$apiKey&'
        'output=json&'
        'region=$region';
  }

  String getDirectionUrl() {
    return '${TencentMapsConfig.baseUrl}/ws/direction/v1/driving/?'
        'key=$apiKey&'
        'output=json';
  }

  String getDistanceUrl() {
    return '${TencentMapsConfig.baseUrl}/ws/distance/v1/?'
        'mode=driving&'
        'key=$apiKey&'
        'output=json';
  }

  String getStaticMapUrl({
    required double latitude,
    required double longitude,
    int width = 600,
    int height = 400,
    int zoom = 15,
    TencentMapStyle style = TencentMapStyle.normal,
  }) {
    final styleId = _getMapStyleId(style);
    return '${TencentMapsConfig.baseUrl}/ws/staticmap/v2/?'
        'center=$latitude,$longitude&'
        'zoom=$zoom&'
        'size=${width}x$height&'
        'maptype=$styleId&'
        'key=$apiKey';
  }

  String getIpLocationUrl() {
    return '${TencentMapsConfig.baseUrl}/ws/location/v1/ip?'
        'key=$apiKey&'
        'output=json';
  }

  static List<String> getSupportedLanguages() {
    return TencentMapsConfig.supportedLanguages;
  }

  static List<String> getSupportedRegions() {
    return TencentMapsConfig.supportedRegions;
  }

  static double getDefaultZoom() {
    return TencentMapsConfig.defaultZoom;
  }

  static double getMinZoom() {
    return TencentMapsConfig.minZoom;
  }

  static double getMaxZoom() {
    return TencentMapsConfig.maxZoom;
  }

  static double getDefaultLatitude() {
    return TencentMapsConfig.defaultLatitude;
  }

  static double getDefaultLongitude() {
    return TencentMapsConfig.defaultLongitude;
  }

  TencentMapsService copyWith({
    String? apiKey,
    String? language,
    String? region,
  }) {
    return TencentMapsService(
      apiKey: apiKey ?? this.apiKey,
      language: language ?? this.language,
      region: region ?? this.region,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is TencentMapsService &&
        other.apiKey == apiKey &&
        other.language == language &&
        other.region == region;
  }

  @override
  int get hashCode => apiKey.hashCode ^ language.hashCode ^ region.hashCode;

  @override
  String toString() {
    return 'TencentMapsService(language: $language, region: $region)';
  }
}
