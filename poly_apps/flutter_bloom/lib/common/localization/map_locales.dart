import 'package:flutter_localization/flutter_localization.dart';
import 'localization_manager.dart';

/// Language mapping configuration
/// Defines available languages and their properties
class MapLocales {
  /// Available language codes
  static const String english = 'en';
  static const String chinese = 'zh';

  /// Get all available locales
  static List<MapLocale> getMapLocales() => [
        MapLocale(
          english,
          AppLocale.EN,
          countryCode: 'US',
          fontFamily: "SFProText",
        ),
        MapLocale(
          chinese,
          AppLocale.ZH,
          countryCode: 'CN',
          fontFamily: 'SFProText',
        ),
      ];

  /// Get default locale
  static String getDefaultLocale() => chinese;

  /// Get locale display names for settings
  static Map<String, String> getLocaleDisplayNames() => {
        english: 'English',
        chinese: '中文',
      };

  /// Get locale options for settings dropdown/slider
  static List<Map<String, String>> getLocaleOptions() => [
        {'code': english, 'name': 'English', 'nativeName': 'English'},
        {'code': chinese, 'name': 'Chinese', 'nativeName': '中文'},
      ];

  /// Check if locale is supported
  static bool isSupported(String locale) {
    return [english, chinese].contains(locale);
  }
}


