class TencentMapsConfig {
  static const String _segment1 = 'EXAMPLE';
  static const String _segment2 = '-TBZBZ-';
  static const String _segment3 = 'XXXXX-';
  static const String _segment4 = 'XXXXX-';
  static const String _segment5 = 'XXXXX-';
  static const String _segment6 = 'XXXXX-';
  static const String _segment7 = 'XXXXX';

  static String _reconstructApiKey() {
    return _segment1 +
        _segment2 +
        _segment3 +
        _segment4 +
        _segment5 +
        _segment6 +
        _segment7;
  }

  static String getApiKey() {
    return _reconstructApiKey();
  }

  static const String apiVersion = '1';
  static const String baseUrl = 'https://apis.map.qq.com';

  static const Map<String, String> mapStyles = {
    'normal': 'normal',
    'dark': 'dark',
    'light': 'light',
    'satellite': 'satellite',
    'traffic': 'traffic',
  };

  static const List<String> supportedLanguages = [
    'zh-CN',
    'en-US',
    'zh-TW',
  ];

  static const List<String> supportedRegions = [
    'CN',
    'HK',
    'MO',
    'TW',
  ];

  static String getDefaultMapStyle() => 'normal';

  static String getDefaultLanguage() => 'zh-CN';

  static String getDefaultRegion() => 'CN';

  static const double defaultZoom = 15.0;
  static const double minZoom = 3.0;
  static const double maxZoom = 20.0;

  static const double defaultLatitude = 39.908823;
  static const double defaultLongitude = 116.397470;
}
