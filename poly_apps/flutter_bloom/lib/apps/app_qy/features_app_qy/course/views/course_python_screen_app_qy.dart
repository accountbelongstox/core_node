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

/// Course Python Screen for QY App - Refactored with centralized theme and common components
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/buttons/primary_button.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../../courses/domain/models/course_model.dart';
import '../../courses/domain/services/course_service.dart';

class CoursePythonScreenRefactoredAppQy extends StatefulWidget {
  const CoursePythonScreenRefactoredAppQy({super.key});

  @override
  State<CoursePythonScreenRefactoredAppQy> createState() =>
      _CoursePythonScreenRefactoredAppQyState();
}

class _CoursePythonScreenRefactoredAppQyState
    extends State<CoursePythonScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final StorageAppQy _storage = StorageAppQy.instance;
  final List<String> _categoryKeys;
  final List<Map<String, String>> _focusTagKeys;
  final List<String> _membershipBenefitKeys;
  List<CourseModel> _courses = [];
  int _selectedCategoryIndex;
  bool _isLoading = true;

  _CoursePythonScreenRefactoredAppQyState()
      : _categoryKeys = [
          QyAppLocalizationKeys.qyCourseCategoryCet,
          QyAppLocalizationKeys.qyCourseCategoryPostgraduate,
          QyAppLocalizationKeys.qyCourseCategoryOral,
          QyAppLocalizationKeys.qyCourseCategoryPython,
          QyAppLocalizationKeys.qyCourseCategoryReading,
        ],
        _focusTagKeys = [
          {
            'titleKey': QyAppLocalizationKeys.qyCourseFocusEfficientTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCourseFocusEfficientSubtitle,
          },
          {
            'titleKey': QyAppLocalizationKeys.qyCourseFocusDailyTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCourseFocusDailySubtitle,
          },
          {
            'titleKey': QyAppLocalizationKeys.qyCourseFocusCareerTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCourseFocusCareerSubtitle,
          },
        ],
        _membershipBenefitKeys = [
          QyAppLocalizationKeys.qyCourseVipBenefit1,
          QyAppLocalizationKeys.qyCourseVipBenefit2,
          QyAppLocalizationKeys.qyCourseVipBenefit3,
        ],
        _selectedCategoryIndex = 3;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    _loadCourses();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _loadCourses() async {
    setState(() => _isLoading = true);
    try {
      final cachedCourses = await _storage.getApp<List<dynamic>>(
        '${StorageAppQy.keyUserProgress}_python_courses',
      );
      if (cachedCourses != null) {
        _courses = cachedCourses
            .map((json) => CourseModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        _courses = CourseService.getAllCourses()
            .where((course) => course.category == CourseCategory.python.code)
            .toList();
        await _storage.setApp(
          '${StorageAppQy.keyUserProgress}_python_courses',
          _courses.map((c) => c.toJson()).toList(),
        );
      }
    } catch (e) {
      _courses = CourseService.getAllCourses()
          .where((course) => course.category == CourseCategory.python.code)
          .toList();
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _handleCategoryTap(int index) {
    setState(() {
      _selectedCategoryIndex = index;
    });
  }

  void _handleMembershipAction() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyCourseVipSnackbar.tr(context)),
      ),
    );
  }

  void _handleCoursePlanTap(Map<String, String> plan) {
    final title = (plan['titleKey'] ?? '').tr(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${QyAppLocalizationKeys.qyCourseOpening.tr(context)} $title',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
          ),
        ),
      );
    }

    return Scaffold(
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(ThemeDimensions.spacing16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildCategoryChips(),
                        const SizedBox(height: ThemeDimensions.spacing24),
                        _buildBentoFocusGrid(),
                        const SizedBox(height: ThemeDimensions.spacing24),
                        _buildMembershipCard(),
                        const SizedBox(height: ThemeDimensions.spacing24),
                        _buildBentoCourseGrid(),
                      ],
                    ),
                  ),
                ),
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
            gradient:
                ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
          ),
        );
      },
    );
  }

  Widget _buildHeader() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
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
          child: Row(
            children: [
              IconButton(
                icon: Icon(Icons.arrow_back, color: ColorsAppQy.qyTextPrimary),
                onPressed: () => context.pop(),
              ),
              const SizedBox(width: ThemeDimensions.spacing8),
              Expanded(
                child: Text(
                  QyAppLocalizationKeys.qyCoursesTitle.tr(context),
                  style: ThemeTextStyles.title1.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryChips() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyCourseHotCategoriesTitle.tr(context),
          style: ThemeTextStyles.title3.copyWith(
            color: ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: List.generate(_categoryKeys.length, (index) {
              final bool isSelected = _selectedCategoryIndex == index;
              return Padding(
                padding:
                    const EdgeInsets.only(right: ThemeDimensions.spacing12),
                child: GestureDetector(
                  onTap: () => _handleCategoryTap(index),
                  child: GlassmorphismCard(
                    borderRadius: ThemeDimensions.radiusFull,
                    blur: 10,
                    opacity: isSelected ? 0.3 : 0.15,
                    padding: const EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.spacing16,
                      vertical: ThemeDimensions.spacing8,
                    ),
                    child: Container(
                      decoration: isSelected
                          ? BoxDecoration(
                              gradient: ColorsAppQy.qyPrimaryGradient,
                              borderRadius: BorderRadius.circular(
                                  ThemeDimensions.radiusFull),
                            )
                          : null,
                      child: Text(
                        _categoryKeys[index].tr(context),
                        style: ThemeTextStyles.body1.copyWith(
                          color: isSelected
                              ? Colors.white
                              : ColorsAppQy.qyTextPrimary,
                          fontWeight:
                              isSelected ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ],
    );
  }

  Widget _buildBentoFocusGrid() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyCourseLearningFocusTitle.tr(context),
          style: ThemeTextStyles.title3.copyWith(
            color: ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: ThemeDimensions.spacing12,
            mainAxisSpacing: ThemeDimensions.spacing12,
            childAspectRatio: 0.9,
          ),
          itemCount: _focusTagKeys.length,
          itemBuilder: (context, index) {
            final tag = _focusTagKeys[index];
            return _buildBentoFocusCard(tag, index);
          },
        ),
      ],
    );
  }

  Widget _buildBentoFocusCard(Map<String, String> tag, int index) {
    final gradients = [
      ColorsAppQy.qyPrimaryGradient,
      ColorsAppQy.qySecondaryGradient,
      ColorsAppQy.qyAccentGradient,
    ];
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Container(
        decoration: BoxDecoration(
          gradient: gradients[index % gradients.length],
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        ),
        padding: const EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              (tag['titleKey'] ?? '').tr(context),
              style: ThemeTextStyles.body1.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: ThemeDimensions.spacing8),
            Text(
              (tag['subtitleKey'] ?? '').tr(context),
              style: ThemeTextStyles.caption.copyWith(
                color: Colors.white70,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMembershipCard() {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 20,
      opacity: 0.3,
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      child: Container(
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyAccentGradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        ),
        padding: const EdgeInsets.all(ThemeDimensions.spacing24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: ThemeDimensions.spacing12,
                vertical: ThemeDimensions.spacing6,
              ),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
              ),
              child: Text(
                QyAppLocalizationKeys.qyCourseVipLabel.tr(context),
                style: ThemeTextStyles.caption.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Text(
              QyAppLocalizationKeys.qyCourseVipHeadline.tr(context),
              style: ThemeTextStyles.title1.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing8),
            Text(
              QyAppLocalizationKeys.qyCourseVipSubhead.tr(context),
              style: ThemeTextStyles.body2.copyWith(color: Colors.white70),
            ),
            const SizedBox(height: ThemeDimensions.spacing16),
            ..._membershipBenefitKeys.map((benefitKey) {
              return Padding(
                padding:
                    const EdgeInsets.only(bottom: ThemeDimensions.spacing8),
                child: Row(
                  children: [
                    Icon(Icons.check_circle,
                        color: Colors.amberAccent, size: 20),
                    const SizedBox(width: ThemeDimensions.spacing8),
                    Expanded(
                      child: Text(
                        benefitKey.tr(context),
                        style: ThemeTextStyles.body2
                            .copyWith(color: Colors.white70),
                      ),
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: ThemeDimensions.spacing20),
            SizedBox(
              width: double.infinity,
              child: PrimaryButton(
                text: QyAppLocalizationKeys.qyCourseVipCta.tr(context),
                onPressed: _handleMembershipAction,
                isFullWidth: true,
                backgroundColor: Colors.white,
                foregroundColor: ColorsAppQy.qyPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBentoCourseGrid() {
    final fallbackPlans = [
      {
        'titleKey': QyAppLocalizationKeys.qyCoursePlanTitleCareerUpgrade,
        'descriptionKey':
            QyAppLocalizationKeys.qyCoursePlanDescriptionCareerUpgrade,
        'badgeKey': QyAppLocalizationKeys.qyCoursePlanBadgeAdvanced,
        'durationKey': QyAppLocalizationKeys.qyCoursePlanDuration12Weeks,
      },
      {
        'titleKey':
            QyAppLocalizationKeys.qyCoursePlanTitleBusinessCommunication,
        'descriptionKey':
            QyAppLocalizationKeys.qyCoursePlanDescriptionBusinessCommunication,
        'badgeKey': QyAppLocalizationKeys.qyCoursePlanBadgeFlagship,
        'durationKey': QyAppLocalizationKeys.qyCoursePlanDuration24Lessons,
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyCoursesFeatured.tr(context),
          style: ThemeTextStyles.title3.copyWith(
            color: ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: ThemeDimensions.spacing16,
            mainAxisSpacing: ThemeDimensions.spacing16,
            childAspectRatio: 0.85,
          ),
          itemCount:
              _courses.length > 0 ? _courses.length : fallbackPlans.length,
          itemBuilder: (context, index) {
            if (_courses.isNotEmpty) {
              return _buildBentoCourseCard(_courses[index]);
            } else if (index < fallbackPlans.length) {
              return _buildBentoPlanCard(fallbackPlans[index]);
            }
            return const SizedBox.shrink();
          },
        ),
      ],
    );
  }

  Widget _buildBentoCourseCard(CourseModel course) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: InkWell(
        onTap: () {
          context.push('/qy/course/detail?courseId=${course.id}');
        },
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: ThemeDimensions.spacing8,
                vertical: ThemeDimensions.spacing4,
              ),
              decoration: BoxDecoration(
                gradient: ColorsAppQy.qySecondaryGradient,
                borderRadius:
                    BorderRadius.circular(ThemeDimensions.radiusMedium),
              ),
              child: Text(
                course.category,
                style: ThemeTextStyles.caption.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    course.title,
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: ThemeDimensions.spacing8),
                  Text(
                    course.subtitle,
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.star, size: 16, color: Colors.amber),
                    const SizedBox(width: ThemeDimensions.spacing4),
                    Text(
                      '${course.rating}',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Text(
                  '${course.lessons} ${QyAppLocalizationKeys.qyLessons.tr(context)}',
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBentoPlanCard(Map<String, String> plan) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: InkWell(
        onTap: () => _handleCoursePlanTap(plan),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.spacing8,
                      vertical: ThemeDimensions.spacing4,
                    ),
                    decoration: BoxDecoration(
                      gradient: ColorsAppQy.qyPrimaryGradient,
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.radiusMedium),
                    ),
                    child: Text(
                      (plan['badgeKey'] ?? '').tr(context),
                      style: ThemeTextStyles.caption.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (plan['titleKey'] ?? '').tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: ThemeDimensions.spacing8),
                  Text(
                    (plan['descriptionKey'] ?? '').tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.timer,
                        size: 16, color: ColorsAppQy.qyTextSecondary),
                    const SizedBox(width: ThemeDimensions.spacing4),
                    Text(
                      (plan['durationKey'] ?? '').tr(context),
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
                Icon(
                  Icons.arrow_forward_ios,
                  size: 16,
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
