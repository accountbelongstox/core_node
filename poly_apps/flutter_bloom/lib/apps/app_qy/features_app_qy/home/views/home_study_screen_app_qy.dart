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
import 'dart:ui';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../widgets_app_qy/bottom_navigation_app_qy.dart';
import '../../../models_app_qy/user_model_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../controllers/learning_controller_app_qy.dart';
import '../data/home_features_data.dart';

class HomeStudyScreenRefactoredAppQy extends StatefulWidget {
  const HomeStudyScreenRefactoredAppQy({super.key});

  @override
  State<HomeStudyScreenRefactoredAppQy> createState() =>
      _HomeStudyScreenRefactoredAppQyState();
}

class _HomeStudyScreenRefactoredAppQyState
    extends State<HomeStudyScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<LearningControllerAppQy>().loadLearningStats();
      }
    });
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
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
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Consumer<LearningControllerAppQy>(
              builder: (context, controller, child) {
                return Stack(
                  children: [
                    _buildMainContent(controller),
                    if (controller.showMoreFeatures)
                      _buildMoreFeaturesDrawer(controller),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackgroundGradient() {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyDynamicShimmerGradient(
              _shimmerController.value,
            ),
          ),
        );
      },
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
                    valueColor: AlwaysStoppedAnimation<Color>(
                      ColorsAppQy.qyPrimary,
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: controller.refreshStats,
                  color: ColorsAppQy.qyPrimary,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(ThemeDimensions.spacing16),
                    child: Column(
                      children: [
                        const SizedBox(height: ThemeDimensions.spacing16),
                        _buildProgressSection(stats),
                        const SizedBox(height: ThemeDimensions.spacing16),
                        _buildLearningStats(stats),
                        const SizedBox(height: ThemeDimensions.spacing16),
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
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              bottom: BorderSide(
                color: ColorsAppQy.qyFrostMedium,
                width: 1,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () {
                      context
                          .read<LearningControllerAppQy>()
                          .toggleMoreFeatures();
                    },
                    icon: Icon(
                      Icons.menu,
                      color: ColorsAppQy.qyTextPrimary,
                    ),
                  ),
                  const SizedBox(width: ThemeDimensions.spacing8),
                  Text(
                    DateTime.now().hour.toString().padLeft(2, '0') +
                        ':' +
                        DateTime.now().minute.toString().padLeft(2, '0'),
                    style: ThemeTextStyles.h3.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  Text(
                    user.displayName ??
                        QyAppLocalizationKeys.qyGuest.tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                    ),
                  ),
                  const SizedBox(width: ThemeDimensions.spacing8),
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: ColorsAppQy.qyPrimary.withOpacity(0.2),
                    child: Icon(
                      Icons.person,
                      size: 18,
                      color: ColorsAppQy.qyPrimary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgressSection(dynamic stats) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing20),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: ColorsAppQy.qyShadowLight,
                blurRadius: 20,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${QyAppLocalizationKeys.qyHomeLearned.tr(context)} ${stats.learnedPercentage}%',
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    '${stats.learnedWords}/${stats.totalWords}${QyAppLocalizationKeys.qyWords.tr(context)}',
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              ClipRRect(
                borderRadius:
                    BorderRadius.circular(ThemeDimensions.radiusSmall),
                child: LinearProgressIndicator(
                  value: stats.learnedPercentage / 100,
                  minHeight: 8,
                  backgroundColor: ColorsAppQy.qyFrostMedium,
                  valueColor:
                      AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
                ),
              ),
            ],
          ),
        ),
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
            ColorsAppQy.qyPrimary,
          ),
        ),
        const SizedBox(width: ThemeDimensions.spacing16),
        Expanded(
          child: _buildStatCard(
            QyAppLocalizationKeys.qyHomeReviewWords.tr(context),
            '${stats.reviewWordsToday}/${stats.reviewWordsTarget}',
            ColorsAppQy.qySecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, Color color) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: ColorsAppQy.qyShadowLight,
                blurRadius: 20,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            children: [
              Text(
                title,
                style: ThemeTextStyles.body2.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing8),
              Text(
                value,
                style: ThemeTextStyles.h3.copyWith(
                  color: color,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStartButton(LearningControllerAppQy controller) {
    return SizedBox(
      width: double.infinity,
      child: Material(
        color: ColorsAppQy.qyPageBackground.withOpacity(0),
        child: InkWell(
          onTap: controller.isLoading ? null : _handleStartLearning,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          child: Container(
            padding:
                const EdgeInsets.symmetric(vertical: ThemeDimensions.spacing16),
            decoration: BoxDecoration(
              gradient: controller.isLoading
                  ? LinearGradient(
                      colors: [
                        ColorsAppQy.qyTextSecondary,
                        ColorsAppQy.qyTextTertiary,
                      ],
                    )
                  : ColorsAppQy.qyPrimaryGradient,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
              boxShadow: controller.isLoading
                  ? null
                  : [
                      BoxShadow(
                        color: ColorsAppQy.qyPrimary.withOpacity(0.4),
                        blurRadius: 15,
                        offset: const Offset(0, 8),
                      ),
                    ],
            ),
            child: Text(
              QyAppLocalizationKeys.qyHomeStartLearning.tr(context),
              style: ThemeTextStyles.h3.copyWith(
                color: ColorsAppQy.qyTextOnPrimary,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
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
          color: ColorsAppQy.qyShadowDark,
          child: GestureDetector(
            onTap: () {},
            child: Align(
              alignment: Alignment.topLeft,
              child: Container(
                width: MediaQuery.of(context).size.width * 0.85,
                height: MediaQuery.of(context).size.height,
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyFrostedGlassGradient,
                  borderRadius: BorderRadius.only(
                    topRight: Radius.circular(ThemeDimensions.radiusLarge),
                    bottomRight: Radius.circular(ThemeDimensions.radiusLarge),
                  ),
                  border: Border(
                    right: BorderSide(
                      color: ColorsAppQy.qyFrostMedium,
                      width: 1,
                    ),
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
                                HomeFeaturesData.getConsolidateFeatures(),
                              ),
                              const SizedBox(height: ThemeDimensions.spacing16),
                              _buildFeatureGridSection(
                                QyAppLocalizationKeys.qyHomeExtension
                                    .tr(context),
                                HomeFeaturesData.getExtensionFeatures(),
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
          bottom: BorderSide(
            color: Colors.white.withOpacity(0.2),
            width: 1,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            QyAppLocalizationKeys.qyHomeMoreFeatures.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          IconButton(
            onPressed: controller.closeMoreFeatures,
            icon: Icon(
              Icons.close,
              color: ColorsAppQy.qyTextSecondary,
              size: 28,
            ),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureGridSection(
      String title, List<HomeFeatureItem> features) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
          child: Text(
            title,
            style: ThemeTextStyles.body2.copyWith(
              color: ColorsAppQy.qyTextSecondary,
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

  Widget _buildFeatureGridItem(HomeFeatureItem feature) {
    return InkWell(
      onTap: () => _handleFeatureTap(feature.labelKey.tr(context)),
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: feature.color.withOpacity(0.2),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
              border: Border.all(
                color: feature.color.withOpacity(0.3),
                width: 1,
              ),
            ),
            child: Icon(
              feature.icon,
              color: feature.iconColor,
              size: 28,
            ),
          ),
          const SizedBox(height: ThemeDimensions.spacing8),
          Text(
            feature.labelKey.tr(context),
            style: ThemeTextStyles.caption.copyWith(
              color: ColorsAppQy.qyTextPrimary,
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing16),
          child: Text(
            QyAppLocalizationKeys.qySettings.tr(context),
            style: ThemeTextStyles.body2.copyWith(
              color: ColorsAppQy.qyTextSecondary,
              fontSize: 13,
            ),
          ),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: ThemeDimensions.spacing16,
            mainAxisSpacing: ThemeDimensions.spacing16,
            childAspectRatio: 0.85,
          ),
          itemCount: HomeFeaturesData.getSettingsFeatures().length,
          itemBuilder: (context, index) {
            return _buildFeatureGridItem(
              HomeFeaturesData.getSettingsFeatures()[index],
            );
          },
        ),
      ],
    );
  }
}
