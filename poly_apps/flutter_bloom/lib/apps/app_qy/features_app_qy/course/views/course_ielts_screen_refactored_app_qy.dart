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
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/course_controller_app_qy.dart';

class CourseIeltsScreenRefactoredAppQy extends StatefulWidget {
  const CourseIeltsScreenRefactoredAppQy({super.key});

  @override
  State<CourseIeltsScreenRefactoredAppQy> createState() =>
      _CourseIeltsScreenRefactoredAppQyState();
}

class _CourseIeltsScreenRefactoredAppQyState
    extends State<CourseIeltsScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<String> _categories;

  _CourseIeltsScreenRefactoredAppQyState()
      : _categories = ['featured', 'ielts', 'gaokao', 'middle', 'cet'];

  @override
  void initState() {
    super.initState();
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
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyCourse.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: ThemeColors.primary,
          labelColor: ThemeColors.primary,
          unselectedLabelColor: ThemeColors.textSecondary,
          labelStyle: TextStyles.button,
          tabs: [
            Tab(text: QyAppLocalizationKeys.qyCourseCategoryFeatured.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyCourseCategoryIelts.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyCourseCategoryGaokao.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyCourseCategoryMiddle.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyCourseCategoryCet.tr(context)),
          ],
        ),
      ),
      body: Consumer<CourseControllerAppQy>(
        builder: (context, controller, child) {
          if (controller.isLoading) {
            return Center(
              child: CircularProgressIndicator(color: ThemeColors.primary),
            );
          }

          return SafeArea(
            child: RefreshIndicator(
              onRefresh: () async {
                await controller.loadCourses();
                await controller.loadPlans();
              },
              color: ThemeColors.primary,
              child: TabBarView(
                controller: _tabController,
                children: _categories.map((category) {
                  return _buildCourseContent(controller);
                }).toList(),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildCourseContent(CourseControllerAppQy controller) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildFeaturedSection(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildCoursesSection(controller),
          SizedBox(height: Dimensions.spacingLarge),
          _buildLearningPlans(controller),
          SizedBox(height: Dimensions.spacingLarge),
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
              style: TextStyles.h4.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              QyAppLocalizationKeys.qyUpdatedDaily.tr(context),
              style: TextStyles.caption.copyWith(
                color: ThemeColors.textSecondary,
              ),
            ),
          ],
        ),
        SizedBox(height: Dimensions.spacingMedium),
        _buildFeaturedCard(
          type: 'listening',
          duration: '02:51',
          title: 'The World\'s Most Dangerous Pizza',
          subtitle: QyAppLocalizationKeys.qyCourseListening.tr(context),
          level: QyAppLocalizationKeys.qyCourseLevelIntermediate.tr(context),
          category: QyAppLocalizationKeys.qyCourseFood.tr(context),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        _buildFeaturedCard(
          type: 'reading',
          duration: '02:32',
          title: 'Taizhou stuns Nantong to win...',
          subtitle: QyAppLocalizationKeys.qyCourseReading.tr(context),
          level: QyAppLocalizationKeys.qyCourseLevelBeginner.tr(context),
          wordCount: '1152',
        ),
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
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: Dimensions.paddingSmall,
                  vertical: Dimensions.paddingSizeExtraSmall,
                ),
                decoration: BoxDecoration(
                  color: ThemeColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                ),
                child: Row(
                  children: [
                    Icon(
                      type == 'listening' ? Icons.headphones : Icons.book,
                      size: 16,
                      color: ThemeColors.primary,
                    ),
                    SizedBox(width: Dimensions.spacingXSmall),
                    Text(
                      duration,
                      style: TextStyles.caption.copyWith(
                        color: ThemeColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (category != null) ...[
                SizedBox(width: Dimensions.spacingSmall),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: Dimensions.paddingSmall,
                    vertical: Dimensions.paddingSizeExtraSmall,
                  ),
                  decoration: BoxDecoration(
                    color: ThemeColors.secondary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                  ),
                  child: Text(
                    category,
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.secondary,
                    ),
                  ),
                ),
              ],
            ],
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            title,
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Row(
            children: [
              Text(
                subtitle,
                style: TextStyles.caption.copyWith(
                  color: ThemeColors.textTertiary,
                ),
              ),
              SizedBox(width: Dimensions.spacingSmall),
              Container(
                width: 4,
                height: 4,
                decoration: BoxDecoration(
                  color: ThemeColors.textTertiary,
                  shape: BoxShape.circle,
                ),
              ),
              SizedBox(width: Dimensions.spacingSmall),
              Text(
                level,
                style: TextStyles.caption.copyWith(
                  color: ThemeColors.textTertiary,
                ),
              ),
              if (wordCount != null) ...[
                SizedBox(width: Dimensions.spacingSmall),
                Container(
                  width: 4,
                  height: 4,
                  decoration: BoxDecoration(
                    color: ThemeColors.textTertiary,
                    shape: BoxShape.circle,
                  ),
                ),
                SizedBox(width: Dimensions.spacingSmall),
                Text(
                  '$wordCount${QyAppLocalizationKeys.qyWords.tr(context)}',
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textTertiary,
                  ),
                ),
              ],
            ],
          ),
        ],
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
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        ...controller.courses.map((course) => _buildCourseCard(course)),
      ],
    );
  }

  Widget _buildCourseCard(dynamic course) {
    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            course.title,
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            course.description,
            style: TextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Row(
            children: [
              Icon(Icons.people, size: 16, color: ThemeColors.textTertiary),
              SizedBox(width: Dimensions.spacingXSmall),
              Text(
                '${course.participants}',
                style: TextStyles.caption.copyWith(
                  color: ThemeColors.textTertiary,
                ),
              ),
              SizedBox(width: Dimensions.spacingMedium),
              Icon(Icons.schedule, size: 16, color: ThemeColors.textTertiary),
              SizedBox(width: Dimensions.spacingXSmall),
              Text(
                course.duration,
                style: TextStyles.caption.copyWith(
                  color: ThemeColors.textTertiary,
                ),
              ),
            ],
          ),
        ],
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
              style: TextStyles.h4.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            TextButton(
              onPressed: () {},
              child: Text(
                QyAppLocalizationKeys.qyViewPlans.tr(context),
                style: TextStyles.button.copyWith(color: ThemeColors.primary),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildVipPromotion() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            ThemeColors.primary.withOpacity(0.8),
            ThemeColors.secondary.withOpacity(0.8),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyVipPromotionTitle.tr(context),
            style: TextStyles.caption.copyWith(
              color: ThemeColors.surface,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyVipYearCard.tr(context),
            style: TextStyles.h3.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyVipBenefits.tr(context),
            style: TextStyles.body2.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeColors.surface,
                foregroundColor: ThemeColors.primary,
                padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                ),
              ),
              child: Text(
                QyAppLocalizationKeys.qyActivateNow.tr(context),
                style: TextStyles.button.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
