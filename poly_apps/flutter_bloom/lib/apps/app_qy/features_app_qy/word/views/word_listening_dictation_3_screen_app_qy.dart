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

/// Word Listening Dictation 3 Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class WordListeningDictation3ScreenAppQy extends StatefulWidget {
  const WordListeningDictation3ScreenAppQy({super.key});

  @override
  State<WordListeningDictation3ScreenAppQy> createState() =>
      _WordListeningDictation3ScreenAppQyState();
}

class _WordListeningDictation3ScreenAppQyState
    extends State<WordListeningDictation3ScreenAppQy> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyWordListeningDictation.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildContent(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.construction,
            size: ThemeDimensions.spacing64,
            color: ThemeColors.primary.withOpacity(0.5),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            '${QyAppLocalizationKeys.qyWordListeningDictation.tr(context)} - ${QyAppLocalizationKeys.qyComingSoon.tr(context)}',
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyUnderDevelopment.tr(context),
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }
}
