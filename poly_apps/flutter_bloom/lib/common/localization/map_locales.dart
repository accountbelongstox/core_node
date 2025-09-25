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


