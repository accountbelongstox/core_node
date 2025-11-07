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

/// Refactored Home Study Screen for QY App - with proper architecture
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../widgets_app_qy/bottom_navigation_app_qy.dart';
import '../../../models_app_qy/user_model_app_qy.dart';
import '../controllers/learning_controller_app_qy.dart';

class HomeStudyScreenRefactoredAppQy extends StatefulWidget {
  const HomeStudyScreenRefactoredAppQy({super.key});

  @override
  State<HomeStudyScreenRefactoredAppQy> createState() =>
      _HomeStudyScreenRefactoredAppQyState();
}

class _HomeStudyScreenRefactoredAppQyState
    extends State<HomeStudyScreenRefactoredAppQy> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LearningControllerAppQy>().loadLearningStats();
    });
  }

  void _handleStartLearning() {
    context.read<LearningControllerAppQy>().startLearning();
  }

  void _handleFeatureTap(String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(feature)),
    );
  }

  void _handleSettingsTap(String setting) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(setting)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      body: Consumer<LearningControllerAppQy>(
        builder: (context, controller, child) {
          return SafeArea(
            child: Stack(
              children: [
                _buildMainContent(controller),
                if (controller.showMoreFeatures)
                  _buildMoreFeaturesDrawer(controller),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildMainContent(LearningControllerAppQy controller) {
    final stats = controller.learningStats;
    final user = context.watch<UserModelAppQy>();

    return Column(
      children: [
        _buildHeader(user),
        Expanded(
          child: controller.isLoading
              ? Center(
                  child: CircularProgressIndicator(
                    color: ThemeColors.primary,
                  ),
                )
              : RefreshIndicator(
                  onRefresh: controller.refreshStats,
                  color: ThemeColors.primary,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.only(
                      left: ThemeDimensions.paddingMedium,
                      right: ThemeDimensions.paddingMedium,
                      top: ThemeDimensions.paddingMedium,
                      bottom: ThemeDimensions.paddingSmall,
                    ),
                    child: Column(
                      children: [
                        SizedBox(height: ThemeDimensions.spacingLarge),
                        _buildProgressSection(stats),
                        SizedBox(height: ThemeDimensions.spacingXLarge),
                        _buildLearningStats(stats),
                        SizedBox(height: ThemeDimensions.spacingXLarge),
                        _buildStartButton(controller),
                      ],
                    ),
                  ),
                ),
        ),
        const BottomNavigationAppQy(currentIndex: 0),
      ],
    );
  }

  Widget _buildHeader(UserModelAppQy user) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () {
                  context.read<LearningControllerAppQy>().toggleMoreFeatures();
                },
                icon: Icon(
                  Icons.menu,
                  color: ThemeColors.textPrimary,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                DateTime.now().hour.toString().padLeft(2, '0') +
                    ':' +
                    DateTime.now().minute.toString().padLeft(2, '0'),
                style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
              ),
            ],
          ),
          Row(
            children: [
              Text(
                user.displayName ?? QyAppLocalizationKeys.qyGuest.tr(context),
                style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textPrimary),
              ),
              SizedBox(width: ThemeDimensions.spacingSmall),
              CircleAvatar(
                radius: 16,
                backgroundColor: ThemeColors.primary.withOpacity(0.1),
                child: Icon(
                  Icons.person,
                  size: 18,
                  color: ThemeColors.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildProgressSection(dynamic stats) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            ThemeColors.primary.withOpacity(0.1),
            ThemeColors.secondary.withOpacity(0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${QyAppLocalizationKeys.qyHomeLearned.tr(context)} ${stats.learnedPercentage}%',
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                '${stats.learnedWords}/${stats.totalWords}${QyAppLocalizationKeys.qyWords.tr(context)}',
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          ClipRRect(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: stats.learnedPercentage / 100,
              minHeight: 8,
              backgroundColor: ThemeColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLearningStats(dynamic stats) {
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            QyAppLocalizationKeys.qyHomeNewWords.tr(context),
            '${stats.newWordsToday}/${stats.newWordsTarget}',
            ThemeColors.primary,
          ),
        ),
        SizedBox(width: ThemeDimensions.spacingMedium),
        Expanded(
          child: _buildStatCard(
            QyAppLocalizationKeys.qyHomeReviewWords.tr(context),
            '${stats.reviewWordsToday}/${stats.reviewWordsTarget}',
            ThemeColors.secondary,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, Color color) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Text(
            title,
            style: ThemeTextStyles.body2.copyWith(color: ThemeColors.textSecondary),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            value,
            style: ThemeTextStyles.h3.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStartButton(LearningControllerAppQy controller) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: controller.isLoading ? null : _handleStartLearning,
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeColors.primary,
          disabledBackgroundColor: ThemeColors.primary.withOpacity(0.5),
          padding: EdgeInsets.symmetric(vertical: ThemeDimensions.paddingLarge),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          ),
          elevation: 2,
        ),
        child: Text(
          QyAppLocalizationKeys.qyHomeStartLearning.tr(context),
          style: ThemeTextStyles.h3.copyWith(
            color: ThemeColors.surface,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildMoreFeaturesDrawer(LearningControllerAppQy controller) {
    return Positioned.fill(
      child: GestureDetector(
        onTap: controller.closeMoreFeatures,
        child: Container(
          color: Colors.black.withOpacity(0.5),
          child: GestureDetector(
            onTap: () {},
            child: Align(
              alignment: Alignment.topLeft,
              child: Container(
                width: MediaQuery.of(context).size.width * 0.85,
                height: MediaQuery.of(context).size.height,
                decoration: BoxDecoration(
                  color: ThemeColors.surface,
                  borderRadius: BorderRadius.only(
                    topRight: Radius.circular(ThemeDimensions.radiusLarge),
                    bottomRight: Radius.circular(ThemeDimensions.radiusLarge),
                  ),
                ),
                child: SafeArea(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildDrawerHeader(controller),
                      Expanded(
                        child: SingleChildScrollView(
                          padding: EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.paddingLarge,
                            vertical: ThemeDimensions.paddingMedium,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildFeatureGridSection(
                                QyAppLocalizationKeys.qyHomeConsolidate
                                    .tr(context),
                                [
                                  {
                                    'label': QyAppLocalizationKeys.qyHomeWordTest
                                        .tr(context),
                                    'icon': Icons.assignment,
                                    'color': Colors.amber.shade100,
                                    'iconColor': Colors.amber.shade700,
                                  },
                                  {
                                    'label': QyAppLocalizationKeys
                                        .qyHomePortableListening
                                        .tr(context),
                                    'icon': Icons.headphones,
                                    'color': Colors.purple.shade100,
                                    'iconColor': Colors.purple.shade700,
                                  },
                                  {
                                    'label': QyAppLocalizationKeys.qyHomePhrase
                                        .tr(context),
                                    'icon': Icons.message,
                                    'color': Colors.pink.shade100,
                                    'iconColor': Colors.pink.shade700,
                                  },
                                  {
                                    'label': QyAppLocalizationKeys.qyHomeSpeedReview
                                        .tr(context),
                                    'icon': Icons.speed,
                                    'color': Colors.cyan.shade100,
                                    'iconColor': Colors.cyan.shade700,
                                  },
                                ],
                              ),
                              SizedBox(height: ThemeDimensions.spacingXLarge),
                              _buildFeatureGridSection(
                                QyAppLocalizationKeys.qyHomeExtension
                                    .tr(context),
                                [
                                  {
                                    'label': QyAppLocalizationKeys.qyHomeReading
                                        .tr(context),
                                    'icon': Icons.menu_book,
                                    'color': Colors.green.shade100,
                                    'iconColor': Colors.green.shade700,
                                  },
                                  {
                                    'label': QyAppLocalizationKeys
                                        .qyHomeListeningSpeaking
                                        .tr(context),
                                    'icon': Icons.headset,
                                    'color': Colors.teal.shade100,
                                    'iconColor': Colors.teal.shade700,
                                  },
                                ],
                              ),
                              SizedBox(height: ThemeDimensions.spacingXLarge),
                              _buildSettingsSection(),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDrawerHeader(LearningControllerAppQy controller) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingLarge,
        vertical: ThemeDimensions.paddingMedium,
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: ThemeColors.border.withOpacity(0.3)),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            QyAppLocalizationKeys.qyHomeMoreFeatures.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          IconButton(
            onPressed: controller.closeMoreFeatures,
            icon: Icon(Icons.close, color: ThemeColors.textSecondary, size: 28),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureGridSection(
      String title, List<Map<String, dynamic>> features) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
          child: Text(
            title,
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textTertiary,
              fontSize: 13,
            ),
          ),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: ThemeDimensions.spacingMedium,
            mainAxisSpacing: ThemeDimensions.spacingMedium,
            childAspectRatio: 0.85,
          ),
          itemCount: features.length,
          itemBuilder: (context, index) {
            return _buildFeatureGridItem(features[index]);
          },
        ),
      ],
    );
  }

  Widget _buildFeatureGridItem(Map<String, dynamic> feature) {
    return InkWell(
      onTap: () => _handleFeatureTap(feature['label'] as String),
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: feature['color'] as Color,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            ),
            child: Icon(
              feature['icon'] as IconData,
              color: feature['iconColor'] as Color,
              size: 28,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            feature['label'] as String,
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textPrimary,
              fontSize: 12,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsSection() {
    final settings = [
      {
        'label': QyAppLocalizationKeys.qyHomeLearnSettings.tr(context),
        'icon': Icons.settings_applications,
        'color': Colors.blue.shade100,
        'iconColor': Colors.blue.shade700,
      },
      {
        'label': QyAppLocalizationKeys.qyHomeLearnData.tr(context),
        'icon': Icons.analytics,
        'color': Colors.orange.shade100,
        'iconColor': Colors.orange.shade700,
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
          child: Text(
            QyAppLocalizationKeys.qySettings.tr(context),
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textTertiary,
              fontSize: 13,
            ),
          ),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: ThemeDimensions.spacingMedium,
            mainAxisSpacing: ThemeDimensions.spacingMedium,
            childAspectRatio: 0.85,
          ),
          itemCount: settings.length,
          itemBuilder: (context, index) {
            return _buildFeatureGridItem(settings[index]);
          },
        ),
      ],
    );
  }
}
