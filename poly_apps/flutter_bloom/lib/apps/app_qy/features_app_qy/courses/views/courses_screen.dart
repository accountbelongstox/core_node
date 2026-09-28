/// Courses screen - Refactored with centralized theme and common components
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../../courses/domain/models/course_model.dart';
import '../../courses/domain/services/course_service.dart';

class CoursesScreenRefactoredAppQy extends StatefulWidget {
  const CoursesScreenRefactoredAppQy({super.key});

  @override
  State<CoursesScreenRefactoredAppQy> createState() =>
      _CoursesScreenRefactoredAppQyState();
}

class _CoursesScreenRefactoredAppQyState
    extends State<CoursesScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final StorageAppQy _storage = StorageAppQy.instance;
  List<CourseModel> _featuredCourses = [];
  bool _isLoading = true;

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
        '${StorageAppQy.keyUserProgress}_featured_courses',
      );
      if (cachedCourses != null) {
        _featuredCourses = cachedCourses
            .map((json) => CourseModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        _featuredCourses = CourseService.getAllCourses().take(3).toList();
        await _storage.setApp(
          '${StorageAppQy.keyUserProgress}_featured_courses',
          _featuredCourses.map((c) => c.toJson()).toList(),
        );
      }
    } catch (e) {
      _featuredCourses = CourseService.getAllCourses().take(3).toList();
    } finally {
      setState(() => _isLoading = false);
    }
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
                _buildAppBar(),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(ThemeDimensions.spacing16),
                    child: Column(
                      children: [
                        _buildBentoFeaturedCourses(),
                        const SizedBox(height: ThemeDimensions.spacing24),
                        _buildBentoCourseCategories(),
                        const SizedBox(height: ThemeDimensions.spacing40),
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

  Widget _buildAppBar() {
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

  Widget _buildBentoFeaturedCourses() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyCoursesFeatured.tr(context),
          style: ThemeTextStyles.title2.copyWith(
            color: ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing16),
        SizedBox(
          height: 220,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: _featuredCourses.length,
            itemBuilder: (context, index) {
              final course = _featuredCourses[index];
              return _buildBentoFeaturedCourseCard(course, index);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildBentoFeaturedCourseCard(CourseModel course, int index) {
    final gradients = [
      ColorsAppQy.qyPrimaryGradient,
      ColorsAppQy.qySecondaryGradient,
      ColorsAppQy.qyAccentGradient,
    ];
    return Padding(
      padding: const EdgeInsets.only(right: ThemeDimensions.spacing16),
      child: GlassmorphismCard(
        borderRadius: ThemeDimensions.radiusLarge,
        blur: 20,
        opacity: 0.3,
        padding: const EdgeInsets.all(ThemeDimensions.spacing20),
        child: Container(
          width: 300,
          decoration: BoxDecoration(
            gradient: gradients[index % gradients.length],
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          ),
          padding: const EdgeInsets.all(ThemeDimensions.spacing20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.spacing12,
                  vertical: ThemeDimensions.spacing6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.25),
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.radiusMedium),
                ),
                child: Text(
                  course.category,
                  style: ThemeTextStyles.caption.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                course.title,
                style: ThemeTextStyles.title2.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: ThemeDimensions.spacing8),
              Text(
                course.description,
                style: ThemeTextStyles.body2.copyWith(
                  color: Colors.white70,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBentoCourseCategories() {
    final categories = [
      {
        'nameKey': QyAppLocalizationKeys.qyCourseCategoryIelts,
        'icon': Icons.school,
        'gradient': ColorsAppQy.qyPrimaryGradient,
        'count': 5,
      },
      {
        'nameKey': QyAppLocalizationKeys.qyCourseCategoryPython,
        'icon': Icons.code,
        'gradient': ColorsAppQy.qySecondaryGradient,
        'count': 2,
      },
      {
        'nameKey': QyAppLocalizationKeys.qyCoursePlanCategoryIelts,
        'icon': Icons.calendar_today,
        'gradient': ColorsAppQy.qyAccentGradient,
        'count': 1,
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyCoursesCategories.tr(context),
          style: ThemeTextStyles.title2.copyWith(
            color: ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 1,
            mainAxisSpacing: ThemeDimensions.spacing12,
            childAspectRatio: 5.0,
          ),
          itemCount: categories.length,
          itemBuilder: (context, index) {
            final category = categories[index];
            return _buildBentoCategoryCard(category);
          },
        ),
      ],
    );
  }

  Widget _buildBentoCategoryCard(Map<String, dynamic> category) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: InkWell(
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                QyAppLocalizationKeys.qyCoursesInDev.tr(context).replaceAll(
                      '{name}',
                      (category['nameKey'] as String).tr(context),
                    ),
              ),
              backgroundColor: ColorsAppQy.qyPrimary,
            ),
          );
        },
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: category['gradient'] as Gradient,
                borderRadius:
                    BorderRadius.circular(ThemeDimensions.radiusMedium),
              ),
              child: Icon(
                category['icon'] as IconData,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: ThemeDimensions.spacing16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    (category['nameKey'] as String).tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: ThemeDimensions.spacing4),
                  Text(
                    QyAppLocalizationKeys.qyCoursesCount.tr(context).replaceAll(
                          '{count}',
                          category['count'].toString(),
                        ),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: ColorsAppQy.qyTextSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
