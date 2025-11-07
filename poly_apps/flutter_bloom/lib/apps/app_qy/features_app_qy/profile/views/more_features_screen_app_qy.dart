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
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../widgets_app_qy/bottom_navigation_app_qy.dart';

class MoreFeaturesScreenRefactoredAppQy extends StatefulWidget {
  const MoreFeaturesScreenRefactoredAppQy({super.key});

  @override
  State<MoreFeaturesScreenRefactoredAppQy> createState() =>
      _MoreFeaturesScreenRefactoredAppQyState();
}

class _MoreFeaturesScreenRefactoredAppQyState
    extends State<MoreFeaturesScreenRefactoredAppQy> {
  final List<Map<String, dynamic>> _consolidateFeatures = [];
  final List<Map<String, dynamic>> _extensionFeatures = [];
  final List<Map<String, dynamic>> _toolFeatures = [];

  @override
  void initState() {
    super.initState();
    _initFeatures();
  }

  void _initFeatures() {
    _consolidateFeatures.addAll([
      {
        'icon': Icons.quiz,
        'title': 'Word Test',
        'subtitle': 'Test your vocabulary knowledge',
        'color': Colors.blue,
      },
      {
        'icon': Icons.headset,
        'title': 'Word Listening',
        'subtitle': 'Practice listening comprehension',
        'color': Colors.green,
      },
      {
        'icon': Icons.record_voice_over,
        'title': 'Phrase Practice',
        'subtitle': 'Learn common phrases',
        'color': Colors.orange,
      },
      {
        'icon': Icons.speed,
        'title': 'Speed Review',
        'subtitle': 'Quick vocabulary review',
        'color': Colors.purple,
      },
    ]);

    _extensionFeatures.addAll([
      {
        'icon': Icons.article,
        'title': 'Reading',
        'subtitle': 'Read articles and stories',
        'color': Colors.indigo,
      },
      {
        'icon': Icons.mic,
        'title': 'Speaking',
        'subtitle': 'Practice pronunciation',
        'color': Colors.red,
      },
      {
        'icon': Icons.video_library,
        'title': 'Video Courses',
        'subtitle': 'Watch educational videos',
        'color': Colors.pink,
      },
      {
        'icon': Icons.translate,
        'title': 'Translation',
        'subtitle': 'Translate words and sentences',
        'color': Colors.teal,
      },
    ]);

    _toolFeatures.addAll([
      {
        'icon': Icons.book,
        'title': 'Dictionary',
        'subtitle': 'Look up word definitions',
        'color': Colors.brown,
      },
      {
        'icon': Icons.bookmark,
        'title': 'Favorites',
        'subtitle': 'Manage your saved words',
        'color': Colors.amber,
      },
      {
        'icon': Icons.history,
        'title': 'Learning History',
        'subtitle': 'View your progress',
        'color': Colors.cyan,
      },
      {
        'icon': Icons.analytics,
        'title': 'Statistics',
        'subtitle': 'Analyze your performance',
        'color': Colors.deepPurple,
      },
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyMoreFeatures.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              children: [
          _buildSectionHeader(
            QyAppLocalizationKeys.qyHomeConsolidate.tr(context),
            QyAppLocalizationKeys.qyHomeConsolidateDescription.tr(context),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildFeatureGrid(_consolidateFeatures),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildSectionHeader(
            QyAppLocalizationKeys.qyHomeExtension.tr(context),
            QyAppLocalizationKeys.qyHomeExtensionDescription.tr(context),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildFeatureGrid(_extensionFeatures),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildSectionHeader(
            QyAppLocalizationKeys.qyMoreFeaturesTools.tr(context),
            QyAppLocalizationKeys.qyMoreFeaturesToolsDescription.tr(context),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildFeatureGrid(_toolFeatures),
              ],
            ),
          ),
          const BottomNavigationAppQy(currentIndex: 4),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, String description) {
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
          description,
          style: ThemeTextStyles.body2.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildFeatureGrid(List<Map<String, dynamic>> features) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: ThemeDimensions.spacingMedium,
        mainAxisSpacing: ThemeDimensions.spacingMedium,
        childAspectRatio: 1.1,
      ),
      itemCount: features.length,
      itemBuilder: (context, index) {
        final feature = features[index];
        return _buildFeatureCard(
          icon: feature['icon'] as IconData,
          title: feature['title'] as String,
          subtitle: feature['subtitle'] as String,
          color: feature['color'] as Color,
        );
      },
    );
  }

  Widget _buildFeatureCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
  }) {
    return InkWell(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$title ${QyAppLocalizationKeys.qyComingSoon.tr(context)}')),
        );
      },
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
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 32,
                color: color,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              title,
              style: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: ThemeDimensions.spacingXSmall),
            Text(
              subtitle,
              style: ThemeTextStyles.caption.copyWith(
                color: ThemeColors.textSecondary,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
