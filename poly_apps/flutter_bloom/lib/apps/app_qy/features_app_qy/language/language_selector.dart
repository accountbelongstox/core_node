import 'package:flutter/material.dart';
import 'package:flutter_localization/flutter_localization.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/apps/app_qy/controller_app_qy/settings_controller_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class LanguageSelector extends StatelessWidget {
  const LanguageSelector({super.key});

  @override
  Widget build(BuildContext context) {
    final settingsController = context.watch<SettingsControllerAppQy>();
    final currentLocale =
        FlutterLocalization.instance.currentLocale?.languageCode ?? 'en';

    return Container(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyLanguage.tr(context),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          // Language Options
          ListTile(
            leading: const Text('🇺🇸'),
            title: Text(QyAppLocalizationKeys.qyLanguageEnglish.tr(context)),
            selected: currentLocale == 'en',
            onTap: () => settingsController.changeLanguage('en'),
          ),
          ListTile(
            leading: const Text('🇨🇳'),
            title: Text(QyAppLocalizationKeys.qyLanguageChinese.tr(context)),
            selected: currentLocale == 'zh',
            onTap: () => settingsController.changeLanguage('zh'),
          ),
        ],
      ),
    );
  }
}
