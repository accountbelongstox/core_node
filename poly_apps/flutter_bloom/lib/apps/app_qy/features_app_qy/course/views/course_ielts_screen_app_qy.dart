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

/// Refactored Course IELTS Screen for QY App - with proper architecture
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:ui';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../widgets_app_qy/bottom_navigation_app_qy.dart';
import '../controllers/course_controller_app_qy.dart';
import '../data/course_category_data.dart';
import '../data/course_featured_data.dart';

class CourseIeltsScreenRefactoredAppQy extends StatefulWidget {
  const CourseIeltsScreenRefactoredAppQy({super.key});

  @override
  State<CourseIeltsScreenRefactoredAppQy> createState() =>
      _CourseIeltsScreenRefactoredAppQyState();
}

class _CourseIeltsScreenRefactoredAppQyState
    extends State<CourseIeltsScreenRefactoredAppQy>
    with TickerProviderStateMixin {
  late TabController _tabController;
  late final List<String> _categories;
  late final AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _categories = CourseCategoryData.getAllCategories();
    _shimmerController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();

    _tabController = TabController(length: _categories.length, vsync: this);
    _tabController.addListener(_handleTabChange);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CourseControllerAppQy>().loadCourses();
      context.read<CourseControllerAppQy>().loadPlans();
    });
  }

  @override
  void dispose() {
    _tabController.removeListener(_handleTabChange);
    _tabController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  void _handleTabChange() {
    if (_tabController.indexIsChanging) {
      final category = _categories[_tabController.index];
      context.read<CourseControllerAppQy>().setCategory(category);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Column(
              children: [
                _buildAppBar(),
                Expanded(
                  child: Consumer<CourseControllerAppQy>(
                    builder: (context, controller, child) {
                      return controller.isLoading
                          ? Center(
                              child: CircularProgressIndicator(
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  ColorsAppQy.qyPrimary,
                                ),
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: () async {
                                await controller.loadCourses();
                                await controller.loadPlans();
                              },
                              color: ColorsAppQy.qyPrimary,
                              child: TabBarView(
                                controller: _tabController,
                                children: _categories.map((category) {
                                  return _buildCourseContent(controller);
                                }).toList(),
                              ),
                            );
                    },
                  ),
                ),
                const BottomNavigationAppQy(currentIndex: 1),
              ],
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

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qyFrostedGlassGradient,
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withOpacity(0.2),
            width: 1,
          ),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: Container(
                  padding: const EdgeInsets.all(ThemeDimensions.spacing8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(
                      ThemeDimensions.radiusMedium,
                    ),
                  ),
                  child: Icon(
                    Icons.arrow_back_rounded,
                    color: ColorsAppQy.qyTextPrimary,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  QyAppLocalizationKeys.qyCourse.tr(context),
                  style: ThemeTextStyles.h3.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: ThemeDimensions.spacing8),
          _buildTabBar(),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(
          color: Colors.white.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: TabBar(
            controller: _tabController,
            isScrollable: true,
            indicator: BoxDecoration(
              gradient: ColorsAppQy.qyPrimaryGradient,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            ),
            labelColor: Colors.white,
            unselectedLabelColor: ColorsAppQy.qyTextSecondary,
            labelStyle: ThemeTextStyles.button.copyWith(
              fontWeight: FontWeight.bold,
            ),
            unselectedLabelStyle: ThemeTextStyles.button,
            tabs: [
              Tab(
                text:
                    QyAppLocalizationKeys.qyCourseCategoryFeatured.tr(context),
              ),
              Tab(
                text: QyAppLocalizationKeys.qyCourseCategoryIelts.tr(context),
              ),
              Tab(
                text: QyAppLocalizationKeys.qyCourseCategoryGaokao.tr(context),
              ),
              Tab(
                text: QyAppLocalizationKeys.qyCourseCategoryMiddle.tr(context),
              ),
              Tab(
                text: QyAppLocalizationKeys.qyCourseCategoryCet.tr(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCourseContent(CourseControllerAppQy controller) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildFeaturedSection(),
          const SizedBox(height: ThemeDimensions.spacing16),
          _buildCoursesSection(controller),
          const SizedBox(height: ThemeDimensions.spacing16),
          _buildLearningPlans(controller),
          const SizedBox(height: ThemeDimensions.spacing16),
          _buildVipPromotion(),
        ],
      ),
    );
  }

  Widget _buildFeaturedSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              QyAppLocalizationKeys.qyTodayFeatured.tr(context),
              style: ThemeTextStyles.h4.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              QyAppLocalizationKeys.qyUpdatedDaily.tr(context),
              style: ThemeTextStyles.caption.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: ThemeDimensions.spacing16),
        ...CourseFeaturedData.getFeaturedItems().map((item) {
          return Padding(
            padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing16),
            child: _buildFeaturedCard(
              type: item.type,
              duration: item.duration,
              title: item.titleKey.tr(context),
              subtitle: item.subtitleKey.tr(context),
              level: item.levelKey.tr(context),
              category: item.categoryKey?.tr(context),
              wordCount: item.wordCount,
            ),
          );
        }),
      ],
    );
  }

  Widget _buildFeaturedCard({
    required String type,
    required String duration,
    required String title,
    required String subtitle,
    required String level,
    String? category,
    String? wordCount,
  }) {
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
                color: Colors.black.withOpacity(0.1),
                blurRadius: 20,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.paddingSmall,
                      vertical: ThemeDimensions.paddingSizeExtraSmall,
                    ),
                    decoration: BoxDecoration(
                      gradient: ColorsAppQy.qyPrimaryGradient,
                      borderRadius: BorderRadius.circular(
                        ThemeDimensions.radiusMedium,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          type == 'listening' ? Icons.headphones : Icons.book,
                          size: 16,
                          color: Colors.white,
                        ),
                        const SizedBox(width: ThemeDimensions.spacing8),
                        Text(
                          duration,
                          style: ThemeTextStyles.caption.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (category != null) ...[
                    const SizedBox(width: ThemeDimensions.spacing8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: ThemeDimensions.spacing12,
                        vertical: ThemeDimensions.spacing4,
                      ),
                      decoration: BoxDecoration(
                        color: ColorsAppQy.qyAccent.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(
                          ThemeDimensions.radiusMedium,
                        ),
                        border: Border.all(
                          color: ColorsAppQy.qyAccent.withOpacity(0.3),
                        ),
                      ),
                      child: Text(
                        category,
                        style: ThemeTextStyles.caption.copyWith(
                          color: ColorsAppQy.qyAccent,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              Text(
                title,
                style: ThemeTextStyles.body1.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: ThemeDimensions.spacing8),
              Row(
                children: [
                  Text(
                    subtitle,
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                  ),
                  const SizedBox(width: ThemeDimensions.spacing8),
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: ColorsAppQy.qyTextSecondary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: ThemeDimensions.spacing8),
                  Text(
                    level,
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                  ),
                  if (wordCount != null) ...[
                    const SizedBox(width: ThemeDimensions.spacing8),
                    Container(
                      width: 4,
                      height: 4,
                      decoration: BoxDecoration(
                        color: ColorsAppQy.qyTextSecondary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: ThemeDimensions.spacing8),
                    Text(
                      '$wordCount${QyAppLocalizationKeys.qyWords.tr(context)}',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCoursesSection(CourseControllerAppQy controller) {
    if (controller.courses.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyRecommendedCourses.tr(context),
          style: ThemeTextStyles.h4.copyWith(
            color: ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing16),
        ...controller.courses.map((course) => _buildCourseCard(course)),
      ],
    );
  }

  Widget _buildCourseCard(dynamic course) {
    return Container(
      margin: const EdgeInsets.only(bottom: ThemeDimensions.spacing16),
      child: ClipRRect(
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
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  course.title,
                  style: ThemeTextStyles.body1.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: ThemeDimensions.spacing8),
                Text(
                  course.description,
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
                const SizedBox(height: ThemeDimensions.spacing16),
                Row(
                  children: [
                    Icon(
                      Icons.people,
                      size: 16,
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                    const SizedBox(width: ThemeDimensions.spacing8),
                    Text(
                      '${course.participants}',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                    const SizedBox(width: ThemeDimensions.spacing16),
                    Icon(
                      Icons.schedule,
                      size: 16,
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                    const SizedBox(width: ThemeDimensions.spacing8),
                    Text(
                      course.duration,
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLearningPlans(CourseControllerAppQy controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              QyAppLocalizationKeys.qyExclusivePlans.tr(context),
              style: ThemeTextStyles.h4.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            TextButton(
              onPressed: () {},
              child: Text(
                QyAppLocalizationKeys.qyViewPlans.tr(context),
                style: ThemeTextStyles.button.copyWith(
                  color: ColorsAppQy.qyPrimary,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildVipPromotion() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing20),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyPrimaryGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            border: Border.all(
              color: Colors.white.withOpacity(0.3),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: ColorsAppQy.qyPrimary.withOpacity(0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                QyAppLocalizationKeys.qyVipPromotionTitle.tr(context),
                style: ThemeTextStyles.caption.copyWith(
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing8),
              Text(
                QyAppLocalizationKeys.qyVipYearCard.tr(context),
                style: ThemeTextStyles.h3.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing8),
              Text(
                QyAppLocalizationKeys.qyVipBenefits.tr(context),
                style: ThemeTextStyles.body2.copyWith(
                  color: Colors.white.withOpacity(0.9),
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              SizedBox(
                width: double.infinity,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {},
                    borderRadius: BorderRadius.circular(
                      ThemeDimensions.radiusMedium,
                    ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        vertical: ThemeDimensions.spacing12,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(
                          ThemeDimensions.radiusMedium,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 10,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      child: Text(
                        QyAppLocalizationKeys.qyActivateNow.tr(context),
                        style: ThemeTextStyles.button.copyWith(
                          color: ColorsAppQy.qyPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
