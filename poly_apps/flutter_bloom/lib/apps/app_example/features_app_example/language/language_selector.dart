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
