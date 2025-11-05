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
import 'package:provider/provider.dart';
import 'package:qyflutter/apps/app_example/controller_app_example/settings_controller_app_example.dart';

// Placeholder for localization manager
class LocalizationManagerAppExample {
  static LocalizationManagerAppExample get instance => LocalizationManagerAppExample._();
  LocalizationManagerAppExample._();
  
  String get language => 'Language';
}

class LanguageSelector extends StatelessWidget {
  const LanguageSelector({super.key});

  @override
  Widget build(BuildContext context) {
    final settingsController = context.watch<SettingsControllerAppExample>();
    final localization = LocalizationManagerAppExample.instance;
    final currentLocale =
        FlutterLocalization.instance.currentLocale?.languageCode ?? 'en';

    return Container(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localization.language,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          // Language Options
          ListTile(
            leading: const Text('🇺🇸'),
            title: const Text('English'),
            selected: currentLocale == 'en',
            onTap: () => settingsController.changeLanguage('en'),
          ),
          ListTile(
            leading: const Text('🇨🇳'),
            title: const Text('中文'),
            selected: currentLocale == 'zh',
            onTap: () => settingsController.changeLanguage('zh'),
          ),
        ],
      ),
    );
  }
}
