// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/settings_controller_app_qy.dart';

class LearningPreferencesScreenRefactoredAppQy extends StatefulWidget {
  const LearningPreferencesScreenRefactoredAppQy({super.key});

  @override
  State<LearningPreferencesScreenRefactoredAppQy> createState() =>
      _LearningPreferencesScreenRefactoredAppQyState();
}

class _LearningPreferencesScreenRefactoredAppQyState
    extends State<LearningPreferencesScreenRefactoredAppQy> {
  String _learningMode = 'adaptive';
  String _reviewFrequency = 'daily';
  int _wordsPerSession = 20;
  bool _showExamples = true;
  bool _showPhonetics = true;
  bool _enableSpacedRepetition = true;
  bool _shuffleWords = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyLearningPreferences.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        children: [
          _buildHeaderCard(),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildSectionTitle(QyAppLocalizationKeys.qyLearningMode.tr(context)),
          _buildLearningModeSection(),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildSectionTitle(QyAppLocalizationKeys.qyReviewSettings.tr(context)),
          _buildReviewSection(),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildSectionTitle(QyAppLocalizationKeys.qyContentDisplay.tr(context)),
          _buildDisplaySection(),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildSectionTitle(QyAppLocalizationKeys.qyAdvancedSettings.tr(context)),
          _buildAdvancedSection(),
        ],
      ),
    );
  }

  Widget _buildHeaderCard() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.primary.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.psychology, color: ThemeColors.primary, size: 32),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Text(
              QyAppLocalizationKeys.qyCustomizeExperience.tr(context),
              style: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.paddingMedium),
      child: Text(
        title,
        style: ThemeTextStyles.h4.copyWith(
          color: ThemeColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildLearningModeSection() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildRadioTile(
            'adaptive',
            QyAppLocalizationKeys.qyAdaptiveMode.tr(context),
            QyAppLocalizationKeys.qyAdaptiveModeDescription.tr(context),
            _learningMode,
            (value) => setState(() => _learningMode = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildRadioTile(
            'sequential',
            QyAppLocalizationKeys.qySequentialMode.tr(context),
            QyAppLocalizationKeys.qySequentialModeDescription.tr(context),
            _learningMode,
            (value) => setState(() => _learningMode = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildRadioTile(
            'random',
            QyAppLocalizationKeys.qyRandomMode.tr(context),
            QyAppLocalizationKeys.qyRandomModeDescription.tr(context),
            _learningMode,
            (value) => setState(() => _learningMode = value),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewSection() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildRadioTile(
            'daily',
            QyAppLocalizationKeys.qyDailyReview.tr(context),
            QyAppLocalizationKeys.qyDailyReviewDescription.tr(context),
            _reviewFrequency,
            (value) => setState(() => _reviewFrequency = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildRadioTile(
            'weekly',
            QyAppLocalizationKeys.qyWeeklyReview.tr(context),
            QyAppLocalizationKeys.qyWeeklyReviewDescription.tr(context),
            _reviewFrequency,
            (value) => setState(() => _reviewFrequency = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildRadioTile(
            'custom',
            QyAppLocalizationKeys.qyCustomReview.tr(context),
            QyAppLocalizationKeys.qyCustomReviewDescription.tr(context),
            _reviewFrequency,
            (value) => setState(() => _reviewFrequency = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          Padding(
            padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      QyAppLocalizationKeys.qyWordsPerSession.tr(context),
                      style: ThemeTextStyles.body1.copyWith(
                        color: ThemeColors.textPrimary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: ThemeDimensions.paddingMedium,
                        vertical: ThemeDimensions.paddingSmall,
                      ),
                      decoration: BoxDecoration(
                        color: ThemeColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                      ),
                      child: Text(
                        '$_wordsPerSession ${QyAppLocalizationKeys.qyWords.tr(context)}',
                        style: ThemeTextStyles.body1.copyWith(
                          color: ThemeColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                Slider(
                  value: _wordsPerSession.toDouble(),
                  min: 10,
                  max: 50,
                  divisions: 8,
                  activeColor: ThemeColors.primary,
                  inactiveColor: ThemeColors.border,
                  onChanged: (value) {
                    setState(() {
                      _wordsPerSession = value.toInt();
                    });
                  },
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '10',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ThemeColors.textTertiary,
                      ),
                    ),
                    Text(
                      '50',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ThemeColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDisplaySection() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildSwitchTile(
            Icons.format_quote,
            QyAppLocalizationKeys.qyShowExamples.tr(context),
            QyAppLocalizationKeys.qyShowExamplesDescription.tr(context),
            _showExamples,
            (value) => setState(() => _showExamples = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildSwitchTile(
            Icons.record_voice_over,
            QyAppLocalizationKeys.qyShowPhonetics.tr(context),
            QyAppLocalizationKeys.qyShowPhoneticsDescription.tr(context),
            _showPhonetics,
            (value) => setState(() => _showPhonetics = value),
          ),
        ],
      ),
    );
  }

  Widget _buildAdvancedSection() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildSwitchTile(
            Icons.auto_graph,
            QyAppLocalizationKeys.qySpacedRepetition.tr(context),
            QyAppLocalizationKeys.qySpacedRepetitionDescription.tr(context),
            _enableSpacedRepetition,
            (value) => setState(() => _enableSpacedRepetition = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildSwitchTile(
            Icons.shuffle,
            QyAppLocalizationKeys.qyShuffleWords.tr(context),
            QyAppLocalizationKeys.qyShuffleWordsDescription.tr(context),
            _shuffleWords,
            (value) => setState(() => _shuffleWords = value),
          ),
        ],
      ),
    );
  }

  Widget _buildRadioTile(
    String value,
    String title,
    String subtitle,
    String groupValue,
    Function(String) onChanged,
  ) {
    final isSelected = value == groupValue;

    return InkWell(
      onTap: () => onChanged(value),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? ThemeColors.primary : ThemeColors.border,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Center(
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: ThemeColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    )
                  : null,
            ),
            SizedBox(width: ThemeDimensions.spacingMedium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: ThemeTextStyles.body1.copyWith(
                      color: ThemeColors.textPrimary,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.spacingXSmall),
                  Text(
                    subtitle,
                    style: ThemeTextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchTile(
    IconData icon,
    String title,
    String subtitle,
    bool value,
    Function(bool) onChanged,
  ) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(ThemeDimensions.paddingSmall),
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            ),
            child: Icon(icon, size: 20, color: ThemeColors.primary),
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: ThemeTextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingXSmall),
                Text(
                  subtitle,
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: ThemeColors.primary,
          ),
        ],
      ),
    );
  }
}
