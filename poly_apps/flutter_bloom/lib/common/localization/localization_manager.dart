// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:flutter_localization/flutter_localization.dart';
import 'common_en.dart';
import 'common_zh.dart';

// Extension on String for easy translation
extension StringTranslationExtension on String {
  String tr([BuildContext? context, List<String>? args]) {
    if (context != null) {
      if (args != null && args.isNotEmpty) {
        return context.formatString(this, args);
      }
      
      // Get current language code with fallback
      final languageCode = FlutterLocalization.instance.currentLocale?.languageCode;
      
      // If language code is null or not supported, default to English
      if (languageCode == null || (languageCode != 'en' && languageCode != 'zh')) {
        return AppLocale.EN[this] ?? this;
      }
      
      // Return translation based on language code
      return languageCode == 'en'
          ? AppLocale.EN[this] ?? this
          : AppLocale.ZH[this] ?? this;
    }
    return this;
  }
}

/// Dynamic locale maps holder. Base common maps are always included.
mixin AppLocale {
  static Map<String, dynamic> EN = {...CommonEnTranslations.translations};
  static Map<String, dynamic> ZH = {...CommonZhTranslations.translations};

  /// Inject app-specific translations at runtime.
  /// Pass a list of maps for each language. Later maps override earlier keys.
  static void setAppTranslations({
    List<Map<String, dynamic>> enTranslations = const [],
    List<Map<String, dynamic>> zhTranslations = const [],
  }) {
    // Start from base
    final mergedEN = <String, dynamic>{...CommonEnTranslations.translations};
    final mergedZH = <String, dynamic>{...CommonZhTranslations.translations};

    for (final map in enTranslations) {
      mergedEN.addAll(map);
    }
    for (final map in zhTranslations) {
      mergedZH.addAll(map);
    }

    EN = mergedEN;
    ZH = mergedZH;
  }
}
