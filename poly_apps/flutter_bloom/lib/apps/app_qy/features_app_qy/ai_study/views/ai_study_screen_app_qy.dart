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

/// AI Study Screen for QY App - AI-Powered Learning Features
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../widgets_app_qy/bottom_navigation_app_qy.dart';

class AiStudyScreenRefactoredAppQy extends StatefulWidget {
  const AiStudyScreenRefactoredAppQy({super.key});

  @override
  State<AiStudyScreenRefactoredAppQy> createState() =>
      _AiStudyScreenRefactoredAppQyState();
}

class _AiStudyScreenRefactoredAppQyState
    extends State<AiStudyScreenRefactoredAppQy> {
  final List<Map<String, dynamic>> _aiFeatures;

  _AiStudyScreenRefactoredAppQyState() : _aiFeatures = [];

  @override
  void initState() {
    super.initState();
  }

  void _initAiFeatures(BuildContext context) {
    _aiFeatures.addAll([
      {
        'icon': Icons.psychology,
        'titleKey': QyAppLocalizationKeys.qyAiWordExplanation,
        'subtitleKey': QyAppLocalizationKeys.qyAiWordExplanationDesc,
        'color': ColorsAppQy.qyAccent,
        'badgeKey': QyAppLocalizationKeys.qyAiBadgeNew,
      },
      {
        'icon': Icons.auto_awesome,
        'titleKey': QyAppLocalizationKeys.qyAiSmartRecommendations,
        'subtitleKey': QyAppLocalizationKeys.qyAiSmartRecommendationsDesc,
        'color': ColorsAppQy.qyInfo,
        'badgeKey': null,
      },
      {
        'icon': Icons.trending_up,
        'titleKey': QyAppLocalizationKeys.qyAiLearningAnalytics,
        'subtitleKey': QyAppLocalizationKeys.qyAiLearningAnalyticsDesc,
        'color': ColorsAppQy.qySuccess,
        'badgeKey': null,
      },
      {
        'icon': Icons.chat_bubble_outline,
        'titleKey': QyAppLocalizationKeys.qyAiTutor,
        'subtitleKey': QyAppLocalizationKeys.qyAiTutorDesc,
        'color': ColorsAppQy.qyWarning,
        'badgeKey': QyAppLocalizationKeys.qyAiBadgeBeta,
      },
      {
        'icon': Icons.question_answer,
        'titleKey': QyAppLocalizationKeys.qyAiSmartQuiz,
        'subtitleKey': QyAppLocalizationKeys.qyAiSmartQuizDesc,
        'color': ColorsAppQy.qyAccent,
        'badgeKey': null,
      },
      {
        'icon': Icons.history_edu,
        'titleKey': QyAppLocalizationKeys.qyAiStudyPlan,
        'subtitleKey': QyAppLocalizationKeys.qyAiStudyPlanDesc,
        'color': ColorsAppQy.qySecondary,
        'badgeKey': null,
      },
    ]);
  }

  void _handleFeatureTap(BuildContext context, Map<String, dynamic> feature) {
    final title = (feature['titleKey'] as String).tr(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
            '$title ${QyAppLocalizationKeys.qyFeatureComingSoon.tr(context)}'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    _initAiFeatures(context);

    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyHomeAi.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                      QyAppLocalizationKeys.qyFeatureComingSoon.tr(context)),
                ),
              );
            },
            icon: Icon(Icons.info_outline, color: ThemeColors.textSecondary),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              children: [
                _buildAiBanner(context),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildSectionHeader(
                  context,
                  QyAppLocalizationKeys.qyAiPoweredFeatures.tr(context),
                  QyAppLocalizationKeys.qyAiPoweredFeaturesDesc.tr(context),
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                _buildAiFeaturesGrid(context),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildProTip(context),
              ],
            ),
          ),
          const BottomNavigationAppQy(currentIndex: 2),
        ],
      ),
    );
  }

  Widget _buildAiBanner(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            ColorsAppQy.qyAccent.withOpacity(0.8),
            ColorsAppQy.qyInfo.withOpacity(0.6),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome, color: ThemeColors.surface, size: 32),
              SizedBox(width: ThemeDimensions.spacingMedium),
              Expanded(
                child: Text(
                  QyAppLocalizationKeys.qyAiLearningAssistant.tr(context),
                  style: ThemeTextStyles.h3.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyAiLearningAssistantDesc.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Row(
            children: [
              _buildBannerStat(context, '1M+', QyAppLocalizationKeys.qyAiUsers),
              SizedBox(width: ThemeDimensions.spacingLarge),
              _buildBannerStat(
                  context, '99%', QyAppLocalizationKeys.qyAiAccuracy),
              SizedBox(width: ThemeDimensions.spacingLarge),
              _buildBannerStat(
                  context, '24/7', QyAppLocalizationKeys.qyAiAvailable),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBannerStat(BuildContext context, String value, String labelKey) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: ThemeTextStyles.h4.copyWith(
            color: ThemeColors.surface,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          labelKey.tr(context),
          style: ThemeTextStyles.caption.copyWith(
            color: ThemeColors.surface.withOpacity(0.8),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(
      BuildContext context, String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: ThemeTextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingXSmall),
        Text(
          subtitle,
          style: ThemeTextStyles.body2.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildAiFeaturesGrid(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: ThemeDimensions.spacingMedium,
        mainAxisSpacing: ThemeDimensions.spacingMedium,
        childAspectRatio: 1.0,
      ),
      itemCount: _aiFeatures.length,
      itemBuilder: (context, index) {
        final feature = _aiFeatures[index];
        return _buildAiFeatureCard(context, feature);
      },
    );
  }

  Widget _buildAiFeatureCard(
      BuildContext context, Map<String, dynamic> feature) {
    final String? badgeKey = feature['badgeKey'] as String?;

    return InkWell(
      onTap: () => _handleFeatureTap(context, feature),
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          border: Border.all(color: ThemeColors.border),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.shadow.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Stack(
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
                  decoration: BoxDecoration(
                    color: (feature['color'] as Color).withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    feature['icon'] as IconData,
                    size: 32,
                    color: feature['color'] as Color,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                Text(
                  (feature['titleKey'] as String).tr(context),
                  style: ThemeTextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: ThemeDimensions.spacingXSmall),
                Text(
                  (feature['subtitleKey'] as String).tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
            if (badgeKey != null)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingSmall,
                    vertical: ThemeDimensions.paddingSizeExtraSmall,
                  ),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyError,
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.radiusSmall),
                  ),
                  child: Text(
                    badgeKey.tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ThemeColors.surface,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildProTip(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ColorsAppQy.qyWarning.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ColorsAppQy.qyWarning.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.lightbulb_outline, color: ColorsAppQy.qyWarning, size: 24),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qyAiProTip.tr(context),
                  style: ThemeTextStyles.body1.copyWith(
                    color: ColorsAppQy.qyWarning,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingXSmall),
                Text(
                  QyAppLocalizationKeys.qyAiProTipDesc.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyWarning,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
