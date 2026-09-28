/// Global language change notifier for centralized language updates
/// All screens can listen to this to rebuild when language changes
library;

import 'package:flutter/material.dart';
import 'package:flutter_localization/flutter_localization.dart';
import 'localization_manager.dart';

class LanguageChangeNotifier extends ChangeNotifier {
  static final LanguageChangeNotifier _instance = LanguageChangeNotifier._internal();
  factory LanguageChangeNotifier() => _instance;
  LanguageChangeNotifier._internal() {
    _setupListener();
  }

  final FlutterLocalization _localization = FlutterLocalization.instance;
  String? _currentLanguage;

  String? get currentLanguage => _currentLanguage;

  void _setupListener() {
    _currentLanguage = _localization.currentLocale?.languageCode;
    _localization.onTranslatedLanguage = (Locale? locale) {
      final newLanguage = locale?.languageCode;
      if (_currentLanguage != newLanguage) {
        _currentLanguage = newLanguage;
        AppLocale.updateCurrentLanguage(newLanguage ?? 'en');
        notifyListeners();
      }
    };
  }

  void forceNotify() {
    notifyListeners();
  }
}

