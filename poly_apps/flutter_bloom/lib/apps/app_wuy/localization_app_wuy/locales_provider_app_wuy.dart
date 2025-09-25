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

import 'en_app_wuy.dart';
import 'zh_app_wuy.dart';

/// Wuy App Locales Provider
/// Provides localization data for the Wuy app following the standard pattern
class WuyAppLocales {
  static const String appId = 'wuy';

  /// Get English locales for Wuy app (for runCommonApp)
  static List<Map<String, dynamic>> getEnLocales() {
    final locales = getEnLocalesMap();
    return [{'locales': locales}];
  }

  /// Get Chinese locales for Wuy app (for runCommonApp)
  static List<Map<String, dynamic>> getZhLocales() {
    final locales = getZhLocalesMap();
    return [{'locales': locales}];
  }

  /// Get English locales as Map (internal use)
  static Map<String, dynamic> getEnLocalesMap() {
    return EnAppWuy.locales;
  }

  /// Get Chinese locales as Map (internal use)
  static Map<String, dynamic> getZhLocalesMap() {
    return ZhAppWuy.locales;
  }

  /// Get all available locales for Wuy app
  static Map<String, Map<String, dynamic>> getAllLocales() {
    return {
      'en': getEnLocalesMap(),
      'zh': getZhLocalesMap(),
    };
  }

  /// Get supported language codes
  static List<String> getSupportedLanguages() {
    return ['en', 'zh'];
  }

  /// Get default language
  static String getDefaultLanguage() {
    return 'en';
  }

  /// Check if language is supported
  static bool isLanguageSupported(String languageCode) {
    return getSupportedLanguages().contains(languageCode);
  }

  /// Get locale for specific language
  static Map<String, dynamic>? getLocaleForLanguage(String languageCode) {
    switch (languageCode) {
      case 'en':
        return getEnLocalesMap();
      case 'zh':
        return getZhLocalesMap();
      default:
        return null;
    }
  }

  /// Get translation key for specific language
  static String? getTranslation(String key, String languageCode) {
    final locale = getLocaleForLanguage(languageCode);
    if (locale == null) return null;
    
    // Support nested keys like 'wuy.home.title'
    final keys = key.split('.');
    dynamic current = locale;
    
    for (final k in keys) {
      if (current is Map<String, dynamic> && current.containsKey(k)) {
        current = current[k];
      } else {
        return null;
      }
    }
    
    return current is String ? current : null;
  }

  /// Get all translation keys for a language
  static List<String> getAllKeys(String languageCode) {
    final locale = getLocaleForLanguage(languageCode);
    if (locale == null) return [];
    
    return _extractKeys(locale);
  }

  /// Extract all keys from nested map
  static List<String> _extractKeys(Map<String, dynamic> map, [String prefix = '']) {
    final keys = <String>[];
    
    map.forEach((key, value) {
      final fullKey = prefix.isEmpty ? key : '$prefix.$key';
      
      if (value is Map<String, dynamic>) {
        keys.addAll(_extractKeys(value, fullKey));
      } else {
        keys.add(fullKey);
      }
    });
    
    return keys;
  }

  /// Validate locales consistency
  static Map<String, List<String>> validateLocales() {
    final enKeys = getAllKeys('en').toSet();
    final zhKeys = getAllKeys('zh').toSet();
    
    final missingInZh = enKeys.difference(zhKeys).toList();
    final missingInEn = zhKeys.difference(enKeys).toList();
    
    return {
      'missing_in_zh': missingInZh,
      'missing_in_en': missingInEn,
    };
  }

  /// Get locale statistics
  static Map<String, int> getLocaleStats() {
    return {
      'en_keys': getAllKeys('en').length,
      'zh_keys': getAllKeys('zh').length,
      'total_languages': getSupportedLanguages().length,
    };
  }
}
