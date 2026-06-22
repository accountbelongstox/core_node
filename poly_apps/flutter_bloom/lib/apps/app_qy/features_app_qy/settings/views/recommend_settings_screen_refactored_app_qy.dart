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

class RecommendSettingsScreenRefactoredAppQy extends StatefulWidget {
  const RecommendSettingsScreenRefactoredAppQy({super.key});

  @override
  State<RecommendSettingsScreenRefactoredAppQy> createState() =>
      _RecommendSettingsScreenRefactoredAppQyState();
}

class _RecommendSettingsScreenRefactoredAppQyState
    extends State<RecommendSettingsScreenRefactoredAppQy> {
  bool _recommendBasedOnProgress = true;
  bool _recommendBasedOnDifficulty = true;
  bool _recommendSimilarWords = true;
  bool _recommendFrequentErrors = true;
  bool _recommendTrendingCourses = false;
  bool _recommendPersonalizedPlans = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qySettingsRecommend.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        children: [
          _buildInfoCard(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildSectionTitle(QyAppLocalizationKeys.qySettingsRecommendWords.tr(context)),
          _buildSettingsGroup([
            _buildSwitchTile(
              icon: Icons.trending_up,
              title: QyAppLocalizationKeys.qySettingsRecommendProgress.tr(context),
              subtitle: QyAppLocalizationKeys.qySettingsRecommendProgressDescription.tr(context),
              value: _recommendBasedOnProgress,
              onChanged: (value) {
                setState(() {
                  _recommendBasedOnProgress = value;
                });
              },
            ),
            Divider(height: 1, color: ThemeColors.border),
            _buildSwitchTile(
              icon: Icons.bar_chart,
              title: QyAppLocalizationKeys.qySettingsRecommendDifficulty.tr(context),
              subtitle: QyAppLocalizationKeys.qySettingsRecommendDifficultyDescription.tr(context),
              value: _recommendBasedOnDifficulty,
              onChanged: (value) {
                setState(() {
                  _recommendBasedOnDifficulty = value;
                });
              },
            ),
            Divider(height: 1, color: ThemeColors.border),
            _buildSwitchTile(
              icon: Icons.compare_arrows,
              title: QyAppLocalizationKeys.qySettingsRecommendSimilar.tr(context),
              subtitle: QyAppLocalizationKeys.qySettingsRecommendSimilarDescription.tr(context),
              value: _recommendSimilarWords,
              onChanged: (value) {
                setState(() {
                  _recommendSimilarWords = value;
                });
              },
            ),
            Divider(height: 1, color: ThemeColors.border),
            _buildSwitchTile(
              icon: Icons.error_outline,
              title: QyAppLocalizationKeys.qySettingsRecommendErrors.tr(context),
              subtitle: QyAppLocalizationKeys.qySettingsRecommendErrorsDescription.tr(context),
              value: _recommendFrequentErrors,
              onChanged: (value) {
                setState(() {
                  _recommendFrequentErrors = value;
                });
              },
            ),
          ]),
          SizedBox(height: Dimensions.spacingLarge),
          _buildSectionTitle(QyAppLocalizationKeys.qySettingsRecommendContent.tr(context)),
          _buildSettingsGroup([
            _buildSwitchTile(
              icon: Icons.whatshot,
              title: QyAppLocalizationKeys.qySettingsRecommendTrending.tr(context),
              subtitle: QyAppLocalizationKeys.qySettingsRecommendTrendingDescription.tr(context),
              value: _recommendTrendingCourses,
              onChanged: (value) {
                setState(() {
                  _recommendTrendingCourses = value;
                });
              },
            ),
            Divider(height: 1, color: ThemeColors.border),
            _buildSwitchTile(
              icon: Icons.person,
              title: QyAppLocalizationKeys.qySettingsRecommendPersonalized.tr(context),
              subtitle: QyAppLocalizationKeys.qySettingsRecommendPersonalizedDescription.tr(context),
              value: _recommendPersonalizedPlans,
              onChanged: (value) {
                setState(() {
                  _recommendPersonalizedPlans = value;
                });
              },
            ),
          ]),
          SizedBox(height: Dimensions.spacingLarge),
          _buildResetButton(),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(
          color: ThemeColors.primary.withOpacity(0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.lightbulb_outline,
            color: ThemeColors.primary,
            size: 24,
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qySettingsRecommendInfo.tr(context),
                  style: TextStyles.body2.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  QyAppLocalizationKeys.qySettingsRecommendInfoDescription.tr(context),
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: EdgeInsets.only(bottom: Dimensions.paddingMedium),
      child: Text(
        title,
        style: TextStyles.h4.copyWith(
          color: ThemeColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildSettingsGroup(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required Function(bool) onChanged,
  }) {
    return Padding(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(Dimensions.paddingSmall),
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
            ),
            child: Icon(
              icon,
              size: 20,
              color: ThemeColors.primary,
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  subtitle,
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: ThemeColors.primary,
            inactiveThumbColor: ThemeColors.textTertiary,
            inactiveTrackColor: ThemeColors.border,
          ),
        ],
      ),
    );
  }

  Widget _buildResetButton() {
    return ElevatedButton.icon(
      onPressed: () {
        setState(() {
          _recommendBasedOnProgress = true;
          _recommendBasedOnDifficulty = true;
          _recommendSimilarWords = true;
          _recommendFrequentErrors = true;
          _recommendTrendingCourses = false;
          _recommendPersonalizedPlans = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              QyAppLocalizationKeys.qySettingsRecommendReset.tr(context),
            ),
          ),
        );
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: ThemeColors.surface,
        foregroundColor: ThemeColors.textSecondary,
        padding: EdgeInsets.symmetric(vertical: Dimensions.paddingMedium),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          side: BorderSide(color: ThemeColors.border),
        ),
        elevation: 0,
      ),
      icon: Icon(Icons.restore),
      label: Text(
        QyAppLocalizationKeys.qySettingsRecommendResetDefaults.tr(context),
        style: TextStyles.button.copyWith(
          color: ThemeColors.textSecondary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
