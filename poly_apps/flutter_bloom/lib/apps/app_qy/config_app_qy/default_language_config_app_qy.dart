/// Default language configuration for app_qy
/// Centralized language code constants
library;

import '../localization_app_qy/localization_keys_app_qy.dart';

class DefaultLanguageConfigAppQy {
  /// Default native language code
  static const String defaultNativeLanguage = QyAppLocalizationKeys.qyLanguageCodeZh;
  
  /// Default learning language code
  static const String defaultLearningLanguage = QyAppLocalizationKeys.qyLanguageCodeEn;
  
  /// Default learning languages list
  static const List<String> defaultLearningLanguages = [QyAppLocalizationKeys.qyLanguageCodeEn];
  
  /// Supported language codes
  static const List<String> supportedLanguages = [
    QyAppLocalizationKeys.qyLanguageCodeZh,
    QyAppLocalizationKeys.qyLanguageCodeEn,
  ];
}

