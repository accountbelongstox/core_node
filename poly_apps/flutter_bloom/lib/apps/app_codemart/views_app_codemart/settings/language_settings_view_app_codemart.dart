import 'package:flutter/material.dart';

class LanguageSettingsViewAppCodemart extends StatefulWidget {
  const LanguageSettingsViewAppCodemart({super.key});

  @override
  State<LanguageSettingsViewAppCodemart> createState() => _LanguageSettingsViewAppCodemartState();
}

class _LanguageSettingsViewAppCodemartState extends State<LanguageSettingsViewAppCodemart> {
  String _selectedLanguage = 'en';

  final List<Map<String, String>> _languages = [
    {'code': 'en', 'name': 'English', 'native': 'English'},
    {'code': 'zh', 'name': 'Chinese', 'native': '中文'},
    {'code': 'es', 'name': 'Spanish', 'native': 'Español'},
    {'code': 'fr', 'name': 'French', 'native': 'Français'},
    {'code': 'de', 'name': 'German', 'native': 'Deutsch'},
    {'code': 'ja', 'name': 'Japanese', 'native': '日本語'},
    {'code': 'ko', 'name': 'Korean', 'native': '한국어'},
    {'code': 'pt', 'name': 'Portuguese', 'native': 'Português'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Language Settings'),
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
                  const Expanded(
                    child: Text(
                      'The app will restart after changing language',
                      style: TextStyle(fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _languages.length,
              itemBuilder: (context, index) {
                final language = _languages[index];
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
                  const SnackBar(content: Text('Language changed')),
                );
                Navigator.pop(context);
              },
              child: const Text('Apply Language'),
            ),
          ),
        ],
      ),
    );
  }
}
