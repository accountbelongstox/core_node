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

/// Refactored Home Screen following best practices
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../models_app_qy/user_model_app_qy.dart';
import '../controllers/home_controller_app_qy.dart';

class HomeScreenRefactoredAppQy extends StatefulWidget {
  const HomeScreenRefactoredAppQy({super.key});

  @override
  State<HomeScreenRefactoredAppQy> createState() =>
      _HomeScreenRefactoredAppQyState();
}

class _HomeScreenRefactoredAppQyState
    extends State<HomeScreenRefactoredAppQy> {
  late HomeControllerAppQy _controller;

  @override
  void initState() {
    super.initState();
    _controller = HomeControllerAppQy(
      user: UserModelAppQy.empty().copyWith(
        displayName: 'User',
        totalWords: 16952,
        learnedWords: 27,
        todayNewWords: 200,
        todayReviewWords: 27,
        studyDays: 0,
        badges: 0,
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _controller,
      child: Scaffold(
        body: Consumer<HomeControllerAppQy>(
          builder: (context, controller, child) {
            return IndexedStack(
              index: controller.currentTabIndex,
              children: const [
                StudyTabViewRefactored(),
                CourseTabViewRefactored(),
                AIStudyTabViewRefactored(),
                DiscoverTabViewRefactored(),
                ProfileTabViewRefactored(),
              ],
            );
          },
        ),
        bottomNavigationBar: Consumer<HomeControllerAppQy>(
          builder: (context, controller, child) {
            return _buildBottomNavigation(context, controller);
          },
        ),
      ),
    );
  }

  Widget _buildBottomNavigation(
    BuildContext context,
    HomeControllerAppQy controller,
  ) {
    return BottomNavigationBar(
      currentIndex: controller.currentTabIndex,
      onTap: controller.setCurrentTab,
      type: BottomNavigationBarType.fixed,
      selectedItemColor: ThemeColors.primary,
      unselectedItemColor: ThemeColors.textSecondary,
      selectedFontSize: ThemeTextStyles.caption.fontSize ?? 12.0,
      unselectedFontSize: ThemeTextStyles.caption.fontSize ?? 12.0,
      elevation: 0,
      items: [
        BottomNavigationBarItem(
          icon: const Icon(Icons.book_outlined),
          activeIcon: const Icon(Icons.book),
          label: QyAppLocalizationKeys.qyHomeStudy.tr(context),
        ),
        BottomNavigationBarItem(
          icon: const Icon(Icons.school_outlined),
          activeIcon: const Icon(Icons.school),
          label: QyAppLocalizationKeys.qyHomeCourse.tr(context),
        ),
        BottomNavigationBarItem(
          icon: const Icon(Icons.psychology_outlined),
          activeIcon: const Icon(Icons.psychology),
          label: QyAppLocalizationKeys.qyHomeAi.tr(context),
        ),
        BottomNavigationBarItem(
          icon: const Icon(Icons.explore_outlined),
          activeIcon: const Icon(Icons.explore),
          label: QyAppLocalizationKeys.qyHomeDiscover.tr(context),
        ),
        BottomNavigationBarItem(
          icon: const Icon(Icons.person_outline),
          activeIcon: const Icon(Icons.person),
          label: QyAppLocalizationKeys.qyHomeProfile.tr(context),
        ),
      ],
    );
  }
}

class StudyTabViewRefactored extends StatelessWidget {
  const StudyTabViewRefactored({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<HomeControllerAppQy>();
    final user = controller.currentUser;

    return Scaffold(
      backgroundColor: ThemeColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            _buildAppBar(context),
            SliverPadding(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _buildMoreFeaturesButton(context),
                  SizedBox(height: ThemeDimensions.spacingMedium),
                  _buildStudyProgressCard(context, user),
                  SizedBox(height: ThemeDimensions.spacingLarge),
                  _buildQuickAccessGrid(context),
                  SizedBox(height: ThemeDimensions.spacingXLarge),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return SliverAppBar(
      floating: true,
      pinned: false,
      backgroundColor: ThemeColors.background,
      elevation: 0,
      leading: Padding(
        padding: EdgeInsets.all(ThemeDimensions.paddingSmall),
        child: CircleAvatar(
          backgroundColor: ThemeColors.primary.withOpacity(0.1),
          child: Icon(
            Icons.person,
            color: ThemeColors.primary,
            size: ThemeDimensions.iconSizeMedium,
          ),
        ),
      ),
      actions: [
        IconButton(
          icon: Icon(
            Icons.search,
            color: ThemeColors.textPrimary,
            size: ThemeDimensions.iconSizeMedium,
          ),
          onPressed: () {},
        ),
        IconButton(
          icon: Icon(
            Icons.close,
            color: ThemeColors.textPrimary,
            size: ThemeDimensions.iconSizeMedium,
          ),
          onPressed: () {},
        ),
      ],
    );
  }

  Widget _buildMoreFeaturesButton(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: ColorsAppQy.qyPageBackground.withOpacity(0),
        child: InkWell(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          onTap: () {},
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: ThemeDimensions.paddingMedium,
              vertical: ThemeDimensions.paddingSmall,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  QyAppLocalizationKeys.qyHomeMoreFeatures.tr(context),
                  style: ThemeTextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Icon(
                  Icons.keyboard_arrow_down,
                  color: ThemeColors.textSecondary,
                  size: ThemeDimensions.iconSizeSmall,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStudyProgressCard(BuildContext context, UserModelAppQy user) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primary.withOpacity(0.1),
            ThemeColors.secondary.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(
          color: ThemeColors.primary.withOpacity(0.2),
          width: 1,
        ),
      ),
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    QyAppLocalizationKeys.qyHomeLearnSettings.tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                  Text(
                    QyAppLocalizationKeys.qyHomeLearnData.tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                QyAppLocalizationKeys.qyHomeLearned.tr(context),
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                user.progressPercentage,
                style: ThemeTextStyles.h2.copyWith(
                  color: ThemeColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                '%',
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingXSmall),
          Text(
            '${user.learnedWords}/${user.totalWords}${QyAppLocalizationKeys.qyHomeWordsTotal.tr(context)}',
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Row(
            children: [
              Expanded(
                child: _buildStatItem(
                  context,
                  QyAppLocalizationKeys.qyHomeNewWords.tr(context),
                  '${user.todayNewWords ?? 0}/${user.todayNewWords ?? 200}',
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingMedium),
              Expanded(
                child: _buildStatItem(
                  context,
                  QyAppLocalizationKeys.qyHomeReviewWords.tr(context),
                  '${user.todayReviewWords ?? 0}/${user.learnedWords ?? 27}',
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                context.read<HomeControllerAppQy>().startLearning();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeColors.primary,
                foregroundColor: ColorsAppQy.qyTextOnPrimary,
                padding: EdgeInsets.symmetric(
                  vertical: ThemeDimensions.paddingMedium,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                ),
                elevation: 2,
              ),
              child: Text(
                QyAppLocalizationKeys.qyHomeStartLearning.tr(context),
                style: ThemeTextStyles.button.copyWith(
                  color: ColorsAppQy.qyTextOnPrimary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(BuildContext context, String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: ThemeTextStyles.caption.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingXSmall),
        Text(
          value,
          style: ThemeTextStyles.body1.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildQuickAccessGrid(BuildContext context) {
    final features = [
      _FeatureItem(
        label: QyAppLocalizationKeys.qyHomeConsolidate.tr(context),
        icon: Icons.repeat,
        onTap: () {},
      ),
      _FeatureItem(
        label: QyAppLocalizationKeys.qyHomeWordTest.tr(context),
        icon: Icons.quiz,
        onTap: () {},
      ),
      _FeatureItem(
        label: QyAppLocalizationKeys.qyHomePortableListening.tr(context),
        icon: Icons.headphones,
        onTap: () {},
      ),
      _FeatureItem(
        label: QyAppLocalizationKeys.qyHomePhrase.tr(context),
        icon: Icons.short_text,
        onTap: () {},
      ),
      _FeatureItem(
        label: QyAppLocalizationKeys.qyHomeSpeedReview.tr(context),
        icon: Icons.speed,
        onTap: () {},
      ),
      _FeatureItem(
        label: QyAppLocalizationKeys.qyHomeExtension.tr(context),
        icon: Icons.extension,
        onTap: () {},
      ),
      _FeatureItem(
        label: QyAppLocalizationKeys.qyHomeReading.tr(context),
        icon: Icons.auto_stories,
        onTap: () {},
      ),
      _FeatureItem(
        label: QyAppLocalizationKeys.qyHomeListeningSpeaking.tr(context),
        icon: Icons.record_voice_over,
        onTap: () {},
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        childAspectRatio: 0.85,
        crossAxisSpacing: 12,
        mainAxisSpacing: 16,
      ),
      itemCount: features.length,
      itemBuilder: (context, index) {
        final feature = features[index];
        return _buildFeatureItem(context, feature);
      },
    );
  }

  Widget _buildFeatureItem(BuildContext context, _FeatureItem feature) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: feature.onTap,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: ThemeColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
              ),
              child: Icon(
                feature.icon,
                color: ThemeColors.primary,
                size: ThemeDimensions.iconSizeMedium,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Text(
              feature.label,
              style: ThemeTextStyles.caption.copyWith(
                color: ThemeColors.textPrimary,
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

class _FeatureItem {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _FeatureItem({
    required this.label,
    required this.icon,
    required this.onTap,
  });
}

class CourseTabViewRefactored extends StatelessWidget {
  const CourseTabViewRefactored({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(QyAppLocalizationKeys.qyHomeCourse.tr(context)),
        backgroundColor: ThemeColors.surface,
      ),
      body: Center(
        child: Text(
          'Course - Coming Soon',
          style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textSecondary),
        ),
      ),
    );
  }
}

class AIStudyTabViewRefactored extends StatelessWidget {
  const AIStudyTabViewRefactored({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(QyAppLocalizationKeys.qyHomeAi.tr(context)),
        backgroundColor: ThemeColors.surface,
      ),
      body: Center(
        child: Text(
          'AI Study - Coming Soon',
          style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textSecondary),
        ),
      ),
    );
  }
}

class DiscoverTabViewRefactored extends StatelessWidget {
  const DiscoverTabViewRefactored({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(QyAppLocalizationKeys.qyHomeDiscover.tr(context)),
        backgroundColor: ThemeColors.surface,
      ),
      body: Center(
        child: Text(
          'Discover - Coming Soon',
          style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textSecondary),
        ),
      ),
    );
  }
}

class ProfileTabViewRefactored extends StatelessWidget {
  const ProfileTabViewRefactored({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(QyAppLocalizationKeys.qyHomeProfile.tr(context)),
        backgroundColor: ThemeColors.surface,
      ),
      body: Center(
        child: Text(
          'Profile - Coming Soon',
          style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textSecondary),
        ),
      ),
    );
  }
}
