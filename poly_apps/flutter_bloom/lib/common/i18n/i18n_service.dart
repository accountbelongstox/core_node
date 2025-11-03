/// Centralized internationalization service for Flutter Bloom
/// Provides multi-language support with reactive updates
library i18n_service;

import 'package:flutter/material.dart';
import 'translations.dart';

class I18nService extends ChangeNotifier {
  static final I18nService _instance = I18nService._internal();
  factory I18nService() => _instance;
  I18nService._internal();

  Locale _currentLocale = const Locale('zh', 'CN');

  Locale get currentLocale => _currentLocale;
  String get languageCode => _currentLocale.languageCode;

  /// Get translation by key
  String translate(String key, {Map<String, dynamic>? params}) {
    final translations = _getTranslations();
    String value = _getNestedValue(translations, key) ?? key;

    if (params != null) {
      params.forEach((paramKey, paramValue) {
        value = value.replaceAll('{$paramKey}', paramValue.toString());
      });
    }

    return value;
  }

  /// Get nested translation value
  String? _getNestedValue(Map<String, dynamic> map, String key) {
    final keys = key.split('.');
    dynamic current = map;

    for (final k in keys) {
      if (current is Map<String, dynamic> && current.containsKey(k)) {
        current = current[k];
      } else {
        return null;
      }
    }

    return current?.toString();
  }

  /// Get current translations
  Map<String, dynamic> _getTranslations() {
    switch (_currentLocale.languageCode) {
      case 'en':
        return Translations.en;
      case 'zh':
      default:
        return Translations.zhCN;
    }
  }

  /// Change language
  Future<void> changeLanguage(String languageCode) async {
    Locale newLocale;

    switch (languageCode) {
      case 'en':
        newLocale = const Locale('en', 'US');
        break;
      case 'zh':
      default:
        newLocale = const Locale('zh', 'CN');
        break;
    }

    if (_currentLocale != newLocale) {
      _currentLocale = newLocale;
      notifyListeners();
    }
  }

  /// Get supported locales
  List<Locale> get supportedLocales => [
    const Locale('zh', 'CN'),
    const Locale('en', 'US'),
  ];
}

/// Extension for easy translation access
extension I18nString on String {
  String get tr => I18nService().translate(this);
  String trParams(Map<String, dynamic> params) => I18nService().translate(this, params: params);
}