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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';

// Placeholder for bw_parsetool
class bw {
  static String parseText(String text) => text;

  static BingWordParseTool createParser() => BingWordParseTool();
}

class BingWordParseTool {
  String parse(String text) => text;
}

// AI MODIFICATION NOTE: This screen was marked for deletion by QR_Profile_AI_Assistant
// - This functionality is redundant with word_card feature
// - Contains hardcoded Chinese text that violates development guidelines
// - Should be removed in favor of the unified word_card implementation
// Other AIs: This file should be renamed to word_cards_screen_delete.dart for manual cleanup

class WordCardsScreen extends StatefulWidget {
  const WordCardsScreen({super.key});

  @override
  State<WordCardsScreen> createState() => _WordCardsScreenState();
}

class _WordCardsScreenState extends State<WordCardsScreen> {
  final _parser = bw.createParser();
  final StorageAppQy _storage = StorageAppQy.instance;
  List<dynamic> _wordData = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      await _storage.initAppStorage();
      // Load from centralized storage instead of hardcoded data
      final storedData =
          await _storage.getApp<List<dynamic>>(StorageAppQy.keyWordList);
      if (storedData != null && storedData.isNotEmpty) {
        _wordData = storedData;
      } else {
        // If no data in storage, initialize empty
        _wordData = [];
      }
    } catch (e) {
      _wordData = [];
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyWordLearning.tr(context),
          style: ThemeTextStyles.titleLarge,
        ),
        centerTitle: true,
        backgroundColor: ThemeColors.systemBackground,
        foregroundColor: ThemeColors.label,
      ),
      body: _isLoading
          ? Center(
              child: CircularProgressIndicator(
                color: ThemeColors.primary,
              ),
            )
          : _wordData.isEmpty
              ? Center(
                  child: Text(
                    QyAppLocalizationKeys.qyWordBookNoWords.tr(context),
                    style: ThemeTextStyles.body.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                )
              : ListView.builder(
                  itemCount: _wordData.length,
                  itemBuilder: (context, index) {
                    final word = _wordData[index];
                    return ListTile(
                      title: Text(
                        word['content'] ?? '',
                        style: ThemeTextStyles.title3,
                      ),
                      subtitle: Text(
                        word['translation']?['wordTranslation']?.first ?? '',
                        style: ThemeTextStyles.body,
                      ),
                    );
                  },
                ),
    );
  }
}
