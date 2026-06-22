class AzureMapsConfig {
  static const String _segment1 = '67ngRjfX';
  static const String _segment2 = 'xvwkfkLi';
  static const String _segment3 = 'KsfBdKQz';
  static const String _segment4 = 'Djj8H19Q';
  static const String _segment5 = 'jmNZvBPZ';
  static const String _segment6 = 'Ob7XWCju';
  static const String _segment7 = '0jsrJQQJ';
  static const String _segment8 = '99BJACYe';
  static const String _segment9 = 'BjFK9Iww';
  static const String _segment10 = 'AAAgAZMP';
  static const String _segment11 = '1QAj';

  static const String _clientIdPart1 = 'e289107a';
  static const String _clientIdPart2 = '77f1';
  static const String _clientIdPart3 = '4a61';
  static const String _clientIdPart4 = '9fe6';
  static const String _clientIdPart5 = 'c388f9705bed';

  static String _reconstructPrimaryKey() {
    return _segment1 +
        _segment2 +
        _segment3 +
        _segment4 +
        _segment5 +
        _segment6 +
        _segment7 +
        _segment8 +
        _segment9 +
        _segment10 +
        _segment11;
  }

  static String _reconstructClientId() {
    return '$_clientIdPart1-$_clientIdPart2-$_clientIdPart3-$_clientIdPart4-$_clientIdPart5';
  }

  static String getSubscriptionKey() {
    return _reconstructPrimaryKey();
  }

  static String getClientId() {
    return _reconstructClientId();
  }

  static const String apiVersion = '2022-08-01';
  static const String baseUrl = 'https://atlas.microsoft.com/map/tile';

  static const Map<String, int> tilesetConfig = {
    'microsoft.base.road': 512,
    'microsoft.base.darkgrey': 512,
    'microsoft.base.hybrid.road': 512,
    'microsoft.imagery': 256,
    'microsoft.weather.infrared.main': 256,
    'microsoft.weather.radar.main': 256,
  };

  static const List<String> supportedLanguages = [
    'en-US',
    'zh-CN',
    'zh-TW',
    'ja-JP',
    'ko-KR',
    'es-ES',
    'fr-FR',
    'de-DE',
    'it-IT',
    'pt-BR',
    'ru-RU',
    'ar-SA',
  ];

  static const List<String> supportedViews = [
    'Auto',
    'Unified',
    'IN',
    'PK',
    'AR',
    'MA',
    'OM',
    'RU',
  ];

  static String getDefaultTileset() => 'microsoft.base.road';

  static int getDefaultTileSize() => 512;

  static String getDefaultLanguage() => 'en-US';

  static String getDefaultView() => 'Auto';
}
