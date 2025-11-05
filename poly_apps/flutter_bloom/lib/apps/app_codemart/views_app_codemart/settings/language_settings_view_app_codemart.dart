import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';

class LanguageSettingsViewAppCodemart extends StatefulWidget {
  const LanguageSettingsViewAppCodemart({super.key});

  @override
  State<LanguageSettingsViewAppCodemart> createState() => _LanguageSettingsViewAppCodemartState();
}

class _LanguageSettingsViewAppCodemartState extends State<LanguageSettingsViewAppCodemart> {
  String _selectedLanguage = 'en';

  List<Map<String, String>> _getLanguages(BuildContext context) {
    return [
      {
        'code': 'en',
        'name': 'English',
        'native': LocalizationKeysAppCodemart.codemartLanguageEnglish.tr(context)
      },
      {
        'code': 'zh',
        'name': 'Chinese',
        'native': LocalizationKeysAppCodemart.codemartLanguageChinese.tr(context)
      },
      {
        'code': 'es',
        'name': 'Spanish',
        'native': LocalizationKeysAppCodemart.codemartLanguageSpanish.tr(context)
      },
      {
        'code': 'fr',
        'name': 'French',
        'native': LocalizationKeysAppCodemart.codemartLanguageFrench.tr(context)
      },
      {
        'code': 'de',
        'name': 'German',
        'native': LocalizationKeysAppCodemart.codemartLanguageGerman.tr(context)
      },
      {
        'code': 'ja',
        'name': 'Japanese',
        'native': LocalizationKeysAppCodemart.codemartLanguageJapanese.tr(context)
      },
      {
        'code': 'ko',
        'name': 'Korean',
        'native': LocalizationKeysAppCodemart.codemartLanguageKorean.tr(context)
      },
      {
        'code': 'pt',
        'name': 'Portuguese',
        'native': LocalizationKeysAppCodemart.codemartLanguagePortuguese.tr(context)
      },
    ];
  }

  @override
  Widget build(BuildContext context) {
    final languages = _getLanguages(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(LocalizationKeysAppCodemart.codemartLanguageSettings.tr(context)),
      ),
      body: Column(
        children: [
          Card(
            margin: const EdgeInsets.all(16),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      LocalizationKeysAppCodemart.codemartLanguageRestartMessage.tr(context),
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: languages.length,
              itemBuilder: (context, index) {
                final language = languages[index];
                final isSelected = _selectedLanguage == language['code'];

                return RadioListTile<String>(
                  title: Text(language['name']!),
                  subtitle: Text(language['native']!),
                  value: language['code']!,
                  groupValue: _selectedLanguage,
                  secondary: isSelected
                      ? Icon(
                          Icons.check_circle,
                          color: Theme.of(context).colorScheme.primary,
                        )
                      : const Icon(Icons.circle_outlined),
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _selectedLanguage = value);
                    }
                  },
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: FilledButton(
              onPressed: () {
                // TODO: Apply language change
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(LocalizationKeysAppCodemart.codemartLanguageChanged.tr(context)),
                  ),
                );
                Navigator.pop(context);
              },
              child: Text(LocalizationKeysAppCodemart.codemartApplyLanguage.tr(context)),
            ),
          ),
        ],
      ),
    );
  }
}
