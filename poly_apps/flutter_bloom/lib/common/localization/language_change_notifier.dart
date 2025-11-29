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

