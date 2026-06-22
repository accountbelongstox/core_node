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

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';

class LanguageSettingsScreen extends StatefulWidget {
  const LanguageSettingsScreen({super.key});

  @override
  State<LanguageSettingsScreen> createState() => _LanguageSettingsScreenState();
}

class _LanguageSettingsScreenState extends State<LanguageSettingsScreen> {
  late SettingsController _settingsController;
  String _currentLang = 'en';

  final List<Map<String, String>> _languages = [
    {'code': 'en', 'name': 'English'},
    {'code': 'zh', 'name': '中文'},
    {'code': 'es', 'name': 'Español'},
    {'code': 'fr', 'name': 'Français'},
    {'code': 'de', 'name': 'Deutsch'},
    {'code': 'ja', 'name': '日本語'},
    {'code': 'ko', 'name': '한국어'},
  ];

  @override
  void initState() {
    super.initState();
    _settingsController = Provider.of<SettingsController>(context, listen: false);
    _currentLang = _settingsController.getSetting<String>('language', 'en') ?? 'en';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('achat_language_settings_title'.tr(context)),
        actions: [
          TextButton(
            onPressed: _onDone,
            child: Text(
              'achat_done'.tr(context),
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: ListView.builder(
        itemCount: _languages.length,
        itemBuilder: (context, index) {
          final language = _languages[index];
          final isSelected = _currentLang == language['code'];

          return ListTile(
            title: Text(language['name']!),
            trailing: isSelected ? const Icon(Icons.check, color: Colors.blue) : null,
            onTap: () => _onSelect(language['code']!),
          );
        },
      ),
    );
  }

  void _onSelect(String code) {
    setState(() {
      _currentLang = code;
    });
  }

  Future<void> _onDone() async {
    await _settingsController.setSetting('language', _currentLang);
    if (mounted) {
      Navigator.of(context).pop(_currentLang);
    }
  }
}
