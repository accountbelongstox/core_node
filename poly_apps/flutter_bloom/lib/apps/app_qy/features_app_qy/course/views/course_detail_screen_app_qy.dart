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

class CourseDetailScreenRefactoredAppQy extends StatefulWidget {
  final String? courseId;

  const CourseDetailScreenRefactoredAppQy({
    super.key,
    this.courseId,
  });

  @override
  State<CourseDetailScreenRefactoredAppQy> createState() =>
      _CourseDetailScreenRefactoredAppQyState();
}

class _CourseDetailScreenRefactoredAppQyState
    extends State<CourseDetailScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  late final TabController _tabController;
  final StorageAppQy _storage = StorageAppQy.instance;
  CourseModel? _course;
  List<CourseModule> _modules = [];
  bool _isEnrolled = false;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    _tabController = TabController(length: 3, vsync: this);
    _loadCourseData();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadCourseData() async {
    setState(() => _isLoading = true);
    try {
      final courseId = widget.courseId ?? 'ielts_master';
      final cachedCourse = await _storage.getApp<Map<String, dynamic>>(
        '${StorageAppQy.keyUserProgress}_course_$courseId',
      );
      if (cachedCourse != null) {
        _course = CourseModel.fromJson(cachedCourse);
      } else {
        _course = CourseService.getCourseById(courseId);
        if (_course != null) {
          await _storage.setApp(
            '${StorageAppQy.keyUserProgress}_course_$courseId',
            _course!.toJson(),
          );
        }
      }
      if (_course != null) {
        _modules = CourseService.getModulesByCourseId(_course!.id);
        final enrollmentData = await _storage.getApp<bool>(
          '${StorageAppQy.keyUserProgress}_enrolled_$courseId',
        );
        _isEnrolled = enrollmentData ?? false;
      }
    } catch (e) {
      final fallbackCourse = CourseService.getCourseById('ielts_master');
      if (fallbackCourse != null) {
        _course = fallbackCourse;
        _modules = CourseService.getModulesByCourseId(_course!.id);
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleEnrollment() async {
    if (_course == null) return;
    setState(() {
      _isEnrolled = !_isEnrolled;
    });
    await _storage.setApp(
      '${StorageAppQy.keyUserProgress}_enrolled_${_course!.id}',
      _isEnrolled,
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _isEnrolled
              ? QyAppLocalizationKeys.qyCourseEnrolled.tr(context)
              : QyAppLocalizationKeys.qyCourseUnenrolled.tr(context),
        ),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _course == null) {
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
          CustomScrollView(
            slivers: [
              _buildSliverAppBar(),
              SliverToBoxAdapter(
                child: Column(
                  children: [
                    _buildCourseHeader(),
                    _buildTabBar(),
                  ],
                ),
              ),
              SliverFillRemaining(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildOverviewTab(),
                    _buildBentoCurriculumTab(),
                    _buildBentoReviewsTab(),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

  Widget _buildBackgroundGradient() {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
          ),
        );
      },
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 220,
      pinned: true,
      backgroundColor: Colors.transparent,
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            margin: const EdgeInsets.all(ThemeDimensions.spacing8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: IconButton(
              onPressed: () => context.pop(),
              icon: Icon(Icons.arrow_back, color: ColorsAppQy.qyTextPrimary),
            ),
          ),
        ),
      ),
      actions: [
        ClipRRect(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              margin: const EdgeInsets.all(ThemeDimensions.spacing8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: IconButton(
                onPressed: () {},
                icon: Icon(Icons.share, color: ColorsAppQy.qyTextPrimary),
              ),
            ),
          ),
        ),
        ClipRRect(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              margin: const EdgeInsets.all(ThemeDimensions.spacing8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: IconButton(
                onPressed: () {},
                icon: Icon(Icons.bookmark_border, color: ColorsAppQy.qyTextPrimary),
              ),
            ),
          ),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyPrimaryGradient,
          ),
          child: Center(
            child: Icon(
              Icons.school,
              size: 80,
              color: Colors.white.withOpacity(0.3),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCourseHeader() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing20),
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _course!.title,
                style: ThemeTextStyles.title1.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing8),
              Text(
                _course!.subtitle,
                style: ThemeTextStyles.body1.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              Row(
                children: [
                  _buildRating(),
                  const SizedBox(width: ThemeDimensions.spacing16),
                  _buildInfoItem(Icons.people, '${_course!.students}'),
                  const SizedBox(width: ThemeDimensions.spacing16),
                  _buildInfoItem(Icons.access_time, _course!.duration),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRating() {
    return Row(
      children: [
        Icon(Icons.star, color: Colors.amber, size: 20),
        const SizedBox(width: ThemeDimensions.spacing4),
        Text(
          '${_course!.rating}',
          style: ThemeTextStyles.body1.copyWith(
            color: ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        Text(
          ' (${_course!.students})',
          style: ThemeTextStyles.caption.copyWith(
            color: ColorsAppQy.qyTextSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoItem(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: ColorsAppQy.qyTextSecondary),
        const SizedBox(width: ThemeDimensions.spacing4),
        Text(
          text,
          style: ThemeTextStyles.caption.copyWith(
            color: ColorsAppQy.qyTextSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildTabBar() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
          ),
          child: TabBar(
            controller: _tabController,
            indicatorColor: ColorsAppQy.qyPrimary,
            labelColor: ColorsAppQy.qyPrimary,
            unselectedLabelColor: ColorsAppQy.qyTextSecondary,
            labelStyle: ThemeTextStyles.body1.copyWith(fontWeight: FontWeight.w600),
            unselectedLabelStyle: ThemeTextStyles.body1,
            tabs: [
              Tab(text: QyAppLocalizationKeys.qyOverview.tr(context)),
              Tab(text: QyAppLocalizationKeys.qyCurriculum.tr(context)),
              Tab(text: QyAppLocalizationKeys.qyReviews.tr(context)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOverviewTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        children: [
          _buildSection(
            QyAppLocalizationKeys.qyAboutCourse.tr(context),
            _course!.description,
          ),
          const SizedBox(height: ThemeDimensions.spacing24),
          _buildBentoInstructorCard(),
          const SizedBox(height: ThemeDimensions.spacing24),
          _buildBentoCourseInfo(),
        ],
      ),
    );
  }

  Widget _buildSection(String title, String content) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: ThemeTextStyles.title2.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          Text(
            content,
            style: ThemeTextStyles.body2.copyWith(
              color: ColorsAppQy.qyTextSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBentoInstructorCard() {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing20),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qyPrimaryGradient,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.person,
              size: 36,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: ThemeDimensions.spacing16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qyInstructor.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
                Text(
                  _course!.instructor,
                  style: ThemeTextStyles.body1.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '${_course!.level} Expert',
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBentoCourseInfo() {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: ThemeDimensions.spacing12,
      mainAxisSpacing: ThemeDimensions.spacing12,
      childAspectRatio: 2.5,
      children: [
        _buildBentoInfoCard(
          QyAppLocalizationKeys.qyLevel.tr(context),
          _course!.level,
          Icons.trending_up,
        ),
        _buildBentoInfoCard(
          QyAppLocalizationKeys.qyDuration.tr(context),
          _course!.duration,
          Icons.access_time,
        ),
        _buildBentoInfoCard(
          QyAppLocalizationKeys.qyCategory.tr(context),
          _course!.category,
          Icons.category,
        ),
        _buildBentoInfoCard(
          QyAppLocalizationKeys.qyLessons.tr(context),
          '${_course!.lessons}',
          Icons.book,
        ),
      ],
    );
  }

  Widget _buildBentoInfoCard(String label, String value, IconData icon) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: ColorsAppQy.qyPrimary, size: 24),
          const SizedBox(height: ThemeDimensions.spacing8),
          Text(
            value,
            style: ThemeTextStyles.body1.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: ThemeDimensions.spacing4),
          Text(
            label,
            style: ThemeTextStyles.caption.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildBentoCurriculumTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 1,
          mainAxisSpacing: ThemeDimensions.spacing16,
          childAspectRatio: 4.0,
        ),
        itemCount: _modules.length,
        itemBuilder: (context, index) {
          final module = _modules[index];
          return _buildBentoModuleCard(module, index);
        },
      ),
    );
  }

  Widget _buildBentoModuleCard(CourseModule module, int index) {
    final gradients = [
      ColorsAppQy.qyPrimaryGradient,
      ColorsAppQy.qySecondaryGradient,
      ColorsAppQy.qyAccentGradient,
    ];
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing20),
      child: InkWell(
        onTap: () {
          context.push('/qy/course/lesson?lessonId=${module.id}');
        },
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: Container(
          decoration: BoxDecoration(
            gradient: gradients[index % gradients.length],
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          ),
          padding: const EdgeInsets.all(ThemeDimensions.spacing20),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.25),
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                ),
                child: Center(
                  child: Text(
                    '${index + 1}',
                    style: ThemeTextStyles.title3.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: ThemeDimensions.spacing16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      module.title,
                      style: ThemeTextStyles.body1.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: ThemeDimensions.spacing4),
                    Row(
                      children: [
                        Icon(Icons.access_time, size: 14, color: Colors.white70),
                        const SizedBox(width: ThemeDimensions.spacing4),
                        Text(
                          module.duration,
                          style: ThemeTextStyles.caption.copyWith(
                            color: Colors.white70,
                          ),
                        ),
                        const SizedBox(width: ThemeDimensions.spacing12),
                        Icon(Icons.article, size: 14, color: Colors.white70),
                        const SizedBox(width: ThemeDimensions.spacing4),
                        Text(
                          '${module.totalLessons} ${QyAppLocalizationKeys.qyLessons.tr(context)}',
                          style: ThemeTextStyles.caption.copyWith(
                            color: Colors.white70,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Icon(
                module.isCompleted ? Icons.check_circle : Icons.play_circle_outline,
                color: Colors.white,
                size: 28,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBentoReviewsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        children: [
          Text(
            QyAppLocalizationKeys.qyReviews.tr(context),
            style: ThemeTextStyles.title2.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          Text(
            QyAppLocalizationKeys.qyComingSoon.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              top: BorderSide(
                color: Colors.white.withOpacity(0.2),
                width: 1,
              ),
            ),
          ),
          child: SafeArea(
            top: false,
            child: Row(
              children: [
                if (_course!.price > 0) ...[
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyPrice.tr(context),
                        style: ThemeTextStyles.caption.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                        ),
                      ),
                      Text(
                        '¥${_course!.price.toInt()}',
                        style: ThemeTextStyles.title2.copyWith(
                          color: ColorsAppQy.qyPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: ThemeDimensions.spacing16),
                ],
                Expanded(
                  child: PrimaryButton(
                    text: _isEnrolled
                        ? QyAppLocalizationKeys.qyEnrolled.tr(context)
                        : QyAppLocalizationKeys.qyEnrollNow.tr(context),
                    onPressed: _handleEnrollment,
                    isFullWidth: true,
                    backgroundColor: _isEnrolled
                        ? ColorsAppQy.qySuccess
                        : ColorsAppQy.qyPrimary,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
