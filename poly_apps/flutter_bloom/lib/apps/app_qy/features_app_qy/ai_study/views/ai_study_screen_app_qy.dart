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

  _AiStudyScreenRefactoredAppQyState()
      : _aiFeatures = [];

  @override
  void initState() {
    super.initState();
    _initAiFeatures();
  }

  void _initAiFeatures() {
    _aiFeatures.addAll([
      {
        'icon': Icons.psychology,
        'title': 'AI Word Explanation',
        'subtitle': 'AI-powered word meanings & usage',
        'color': Colors.deepPurple,
        'badge': 'New',
      },
      {
        'icon': Icons.auto_awesome,
        'title': 'Smart Recommendations',
        'subtitle': 'Personalized learning path',
        'color': Colors.blue,
        'badge': null,
      },
      {
        'icon': Icons.trending_up,
        'title': 'Learning Analytics',
        'subtitle': 'AI-driven progress insights',
        'color': Colors.green,
        'badge': null,
      },
      {
        'icon': Icons.chat_bubble_outline,
        'title': 'AI Tutor',
        'subtitle': 'Ask questions anytime',
        'color': Colors.orange,
        'badge': 'Beta',
      },
      {
        'icon': Icons.question_answer,
        'title': 'Smart Quiz',
        'subtitle': 'Adaptive difficulty testing',
        'color': Colors.pink,
        'badge': null,
      },
      {
        'icon': Icons.history_edu,
        'title': 'Study Plan',
        'subtitle': 'AI-generated study schedule',
        'color': Colors.teal,
        'badge': null,
      },
    ]);
  }

  void _handleFeatureTap(Map<String, dynamic> feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${feature['title']} ${QyAppLocalizationKeys.qyFeatureComingSoon.tr(context)}'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
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
                  content: Text(QyAppLocalizationKeys.qyFeatureComingSoon.tr(context)),
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
                _buildAiBanner(),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildSectionHeader(
                  'AI-Powered Features',
                  'Enhance your learning with artificial intelligence',
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                _buildAiFeaturesGrid(),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildProTip(),
              ],
            ),
          ),
          const BottomNavigationAppQy(currentIndex: 2),
        ],
      ),
    );
  }

  Widget _buildAiBanner() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.deepPurple.withOpacity(0.8),
            Colors.blue.withOpacity(0.6),
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
                  'AI Learning Assistant',
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
            'Powered by advanced AI to personalize your learning journey',
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Row(
            children: [
              _buildBannerStat('1M+', 'Users'),
              SizedBox(width: ThemeDimensions.spacingLarge),
              _buildBannerStat('99%', 'Accuracy'),
              SizedBox(width: ThemeDimensions.spacingLarge),
              _buildBannerStat('24/7', 'Available'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBannerStat(String value, String label) {
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
          label,
          style: ThemeTextStyles.caption.copyWith(
            color: ThemeColors.surface.withOpacity(0.8),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title, String subtitle) {
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

  Widget _buildAiFeaturesGrid() {
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
        return _buildAiFeatureCard(feature);
      },
    );
  }

  Widget _buildAiFeatureCard(Map<String, dynamic> feature) {
    final String? badge = feature['badge'];

    return InkWell(
      onTap: () => _handleFeatureTap(feature),
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
                  feature['title'] as String,
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
                  feature['subtitle'] as String,
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
            if (badge != null)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingSmall,
                    vertical: ThemeDimensions.paddingSizeExtraSmall,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                  ),
                  child: Text(
                    badge,
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

  Widget _buildProTip() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: Colors.amber.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: Colors.amber.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.lightbulb_outline, color: Colors.amber[700], size: 24),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Pro Tip',
                  style: ThemeTextStyles.body1.copyWith(
                    color: Colors.amber[900],
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingXSmall),
                Text(
                  'Enable AI recommendations in settings for personalized learning',
                  style: ThemeTextStyles.caption.copyWith(
                    color: Colors.amber[800],
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
