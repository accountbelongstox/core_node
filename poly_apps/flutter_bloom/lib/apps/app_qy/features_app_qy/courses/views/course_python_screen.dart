/// Python Course Detail Screen
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/custom_app_bar.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../domain/models/course_model.dart';
import '../domain/models/course_python_model.dart';
import '../data/course_python_data.dart';

class CoursePythonScreen extends StatefulWidget {
  const CoursePythonScreen({super.key});

  @override
  State<CoursePythonScreen> createState() => _CoursePythonScreenState();
}

class _CoursePythonScreenState extends State<CoursePythonScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late AnimationController _progressController;
  late Animation<double> _progressAnimation;
  late AnimationController _shimmerController;
  late TabController _tabController;
  final StorageAppQy _storage = StorageAppQy.instance;
  CourseModel? _course;
  bool _isLoading = true;

  double _userProgress = 0.0;
  int _completedLessons = 0;
  int _currentStreak = 0;
  int _projectCompleted = 0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );

    _progressController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    _shimmerController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();

    _tabController = TabController(length: 4, vsync: this);

    _loadCourseData();
    _controller.forward();
  }

  Future<void> _loadCourseData() async {
    setState(() => _isLoading = true);
    try {
      final cachedCourse = await _storage.getApp<Map<String, dynamic>>(
        '${StorageAppQy.keyUserProgress}_course_python',
      );
      if (cachedCourse != null) {
        _course = CourseModel.fromJson(cachedCourse);
        _userProgress = cachedCourse['progress'] as double? ?? 0.0;
        _completedLessons = cachedCourse['completedLessons'] as int? ?? 0;
        _currentStreak = cachedCourse['currentStreak'] as int? ?? 0;
        _projectCompleted = cachedCourse['projectCompleted'] as int? ?? 0;
      } else {
        _course = CourseModel(
          id: 'python_master',
          title: QyAppLocalizationKeys.qyCoursePython.tr(context),
          subtitle: QyAppLocalizationKeys.qyCoursePythonDesc.tr(context),
          category: 'Python',
          level: 'Beginner to Advanced',
          duration: '16周',
          lessons: 64,
          price: 1299.0,
          rating: 4.9,
          students: 28456,
          instructor: 'Prof. Michael Chen',
          description: QyAppLocalizationKeys.qyCoursePythonDesc.tr(context),
          features: [
            QyAppLocalizationKeys.qyProjectDriven.tr(context),
            QyAppLocalizationKeys.qyCodePractice.tr(context),
            QyAppLocalizationKeys.qyCodeReview.tr(context),
            QyAppLocalizationKeys.qyPortfolioGuide.tr(context),
            QyAppLocalizationKeys.qyJobRecommendation.tr(context),
            QyAppLocalizationKeys.qyCommunitySupport.tr(context),
          ],
          topics: [
            QyAppLocalizationKeys.qyPythonBasics.tr(context),
            QyAppLocalizationKeys.qyOOP.tr(context),
            QyAppLocalizationKeys.qyWebFramework.tr(context),
            QyAppLocalizationKeys.qyDataAnalysis.tr(context),
            QyAppLocalizationKeys.qyMachineLearning.tr(context),
            QyAppLocalizationKeys.qyProjectPractice.tr(context),
          ],
        );
        _userProgress = 0.28;
        _completedLessons = 18;
        _currentStreak = 12;
        _projectCompleted = 3;
      }
      _progressAnimation =
          Tween<double>(begin: 0.0, end: _userProgress).animate(
        CurvedAnimation(
            parent: _progressController, curve: Curves.easeOutCubic),
      );
      _progressController.forward();
    } catch (e) {
      // Handle error
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _progressController.dispose();
    _shimmerController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _course == null) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: ColorsAppQy.qyPrimary),
        ),
      );
    }

    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: Column(
                children: [
                  _buildAppBar(),
                  _buildTabBar(),
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _buildOverviewTab(),
                        _buildLessonsTab(),
                        _buildProjectsTab(),
                        _buildProgressTab(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _continueCoding,
        backgroundColor: ColorsAppQy.qySecondary,
        icon: const Icon(Icons.code, color: ColorsAppQy.qyTextOnPrimary),
        label: Text(
          QyAppLocalizationKeys.qyCourseContinueCoding.tr(context),
          style: ThemeTextStyles.body1.copyWith(
            color: ColorsAppQy.qyTextOnPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
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
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              bottom: BorderSide(
                color: ColorsAppQy.qyFrostLight,
                width: 1,
              ),
            ),
          ),
          child: CustomAppBar(
            title: _course?.title ??
                QyAppLocalizationKeys.qyCoursePython.tr(context),
            backgroundColor: ColorsAppQy.qyPageBackground.withOpacity(0),
            titleColor: ColorsAppQy.qyTextPrimary,
            iconColor: ColorsAppQy.qyTextPrimary,
            elevation: 0,
            systemOverlayStyle: SystemUiOverlayStyle.dark,
            actions: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.spacing12,
                  vertical: ThemeDimensions.spacing6,
                ),
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qySecondaryGradient,
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.radiusLarge),
                ),
                child: Text(
                  _course?.category ?? 'Python',
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyTextOnPrimary,
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

  Widget _buildTabBar() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              bottom: BorderSide(
                color: ColorsAppQy.qyFrostLight,
                width: 1,
              ),
            ),
          ),
          child: TabBar(
            controller: _tabController,
            indicatorColor: ColorsAppQy.qySecondary,
            labelColor: ColorsAppQy.qySecondary,
            unselectedLabelColor: ColorsAppQy.qyTextSecondary,
            labelStyle: ThemeTextStyles.caption.copyWith(
              fontWeight: FontWeight.bold,
            ),
            unselectedLabelStyle: ThemeTextStyles.caption,
            tabs: [
              Tab(text: QyAppLocalizationKeys.qyOverview.tr(context)),
              Tab(text: QyAppLocalizationKeys.qyLessons.tr(context)),
              Tab(text: QyAppLocalizationKeys.qyProjects.tr(context)),
              Tab(text: QyAppLocalizationKeys.qyProgress.tr(context)),
            ],
          ),
        ),
      ),
    );
  }


  Widget _buildOverviewTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildProgressCard(),
          const SizedBox(height: 20),
          _buildCourseInfo(),
          const SizedBox(height: 20),
          _buildFeatures(),
          const SizedBox(height: 20),
          _buildInstructorInfo(),
          const SizedBox(height: 20),
          _buildTopics(),
        ],
      ),
    );
  }

  Widget _buildProgressCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qySecondaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qySecondary.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyCourseLearningProgress.tr(context),
                style: ThemeTextStyles.h4.copyWith(
                  color: ColorsAppQy.qyTextOnPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyFrostLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${(_userProgress * 100).toInt()}%',
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyTextOnPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AnimatedBuilder(
            animation: _progressAnimation,
            builder: (context, child) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 8,
                    decoration: BoxDecoration(
                      color: ColorsAppQy.qyFrostMedium,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: _progressAnimation.value,
                      child: Container(
                        decoration: BoxDecoration(
                          color: ColorsAppQy.qyTextOnPrimary,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyCourseCompletedLessons
                            .tr(context)
                            .replaceAll(
                                '{completed}', _completedLessons.toString())
                            .replaceAll('{total}', _course!.lessons.toString()),
                        style: ThemeTextStyles.body1.copyWith(
                          color: ColorsAppQy.qyFrostWhite,
                        ),
                      ),
                      Row(
                        children: [
                          Icon(Icons.local_fire_department,
                              color: ColorsAppQy.qyFrostWhite, size: 16),
                          const SizedBox(width: 4),
                          Text(
                            QyAppLocalizationKeys.qyCourseConsecutiveDays
                                .tr(context)
                                .replaceAll(
                                    '{days}', _currentStreak.toString()),
                            style: ThemeTextStyles.body1.copyWith(
                              color: ColorsAppQy.qyFrostWhite,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyCourseProjectsCompleted
                            .tr(context)
                            .replaceAll(
                                '{count}', _projectCompleted.toString()),
                        style: ThemeTextStyles.body1.copyWith(
                          color: ColorsAppQy.qyFrostWhite,
                        ),
                      ),
                      Row(
                        children: [
                          Icon(Icons.code,
                              color: ColorsAppQy.qyFrostWhite, size: 16),
                          const SizedBox(width: 4),
                          Text(
                            QyAppLocalizationKeys.qyCourseLinesOfCode
                                .tr(context)
                                .replaceAll('{lines}',
                                    _getTotalLinesOfCode().toString()),
                            style: ThemeTextStyles.body1.copyWith(
                              color: ColorsAppQy.qyFrostWhite,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  String _getTotalLinesOfCode() {
    // Simulate total lines of code written
    return (1850 + _completedLessons * 45).toString();
  }

  Widget _buildCourseInfo() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qyFrostedGlassGradient,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyCourseInfo.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildInfoItem(
                  Icons.schedule,
                  QyAppLocalizationKeys.qyCourseDuration.tr(context),
                  _course!.duration,
                  ColorsAppQy.qyInfo,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoItem(
                  Icons.code,
                  QyAppLocalizationKeys.qyCourseCodePractice.tr(context),
                  '${_course!.lessons}个',
                  ColorsAppQy.qySuccess,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildInfoItem(
                  Icons.trending_up,
                  QyAppLocalizationKeys.qyCourseDifficultyProgression
                      .tr(context),
                  _course!.level,
                  ColorsAppQy.qyWarning,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoItem(
                  Icons.star,
                  QyAppLocalizationKeys.qyCourseRating.tr(context),
                  '${_course!.rating}',
                  ColorsAppQy.qyAccent,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem(
      IconData icon, String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 8),
          Text(
            label,
            style: ThemeTextStyles.caption.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: ThemeTextStyles.body1.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatures() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qyFrostedGlassGradient,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyCourseFeatures.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          ..._course!.features.map((feature) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        gradient: ColorsAppQy.qySecondaryGradient,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.check,
                        color: ColorsAppQy.qyTextOnPrimary,
                        size: 16,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        feature,
                        style: ThemeTextStyles.body1.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildInstructorInfo() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qyFrostedGlassGradient,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyCourseInstructor.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qySecondaryGradient,
                  borderRadius: BorderRadius.circular(30),
                ),
                child: const Center(
                  child: Icon(
                    Icons.person,
                    color: ColorsAppQy.qyTextOnPrimary,
                    size: 30,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _course!.instructor,
                      style: ThemeTextStyles.h4.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '资深Python开发专家\n15年行业经验，前Google工程师',
                      style: ThemeTextStyles.body1.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTopics() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qyFrostedGlassGradient,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyCourseLearningPath.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          ..._course!.topics.asMap().entries.map((entry) {
            final index = entry.key;
            final topic = entry.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyFrostMedium,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: ColorsAppQy.qyBorderLight,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        gradient: ColorsAppQy.qySecondaryGradient,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Center(
                        child: Text(
                          '${index + 1}',
                          style: ThemeTextStyles.caption.copyWith(
                            color: ColorsAppQy.qyTextOnPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        topic,
                        style: ThemeTextStyles.body1.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.arrow_forward_ios,
                      color: ColorsAppQy.qyTextSecondary,
                      size: 16,
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildLessonsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyCourseCurriculum.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildLessonModules(),
        ],
      ),
    );
  }

  Widget _buildLessonModules() {
    return Column(
      children: CoursePythonData.modules
          .map((module) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _buildModuleCard(module),
              ))
          .toList(),
    );
  }

  Widget _buildModuleCard(PythonModuleModel module) {
    final progress = module.lessons > 0 ? module.completed / module.lessons : 0.0;
    final isLocked = module.completed == 0 && module.lessons > 0;

    return InkWell(
      onTap: isLocked ? null : () => _openModule(module.titleKey.tr(context)),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isLocked ? ColorsAppQy.qyBorderLight : ColorsAppQy.qyTextOnPrimary,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color:
                isLocked ? ColorsAppQy.qyBorderMedium : ColorsAppQy.qyBorderLight,
          ),
          boxShadow: isLocked
              ? null
              : [
                  BoxShadow(
                    color: ColorsAppQy.qyShadowLight,
                    blurRadius: 10,
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
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: isLocked
                        ? ColorsAppQy.qyBorderLight
                        : color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    icon,
                    color: isLocked ? ColorsAppQy.qyTextTertiary : color,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: ThemeTextStyles.h4.copyWith(
                          color: isLocked ? ColorsAppQy.qyTextTertiary : ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: ThemeTextStyles.body1.copyWith(
                          color:
                              isLocked ? ColorsAppQy.qyTextTertiary : ColorsAppQy.qyTextSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.schedule,
                              color: isLocked
                                  ? ColorsAppQy.qyTextTertiary
                                  : ColorsAppQy.qyTextSecondary,
                              size: 14),
                          const SizedBox(width: 4),
                          Text(
                            module.durationKey.tr(context),
                            style: ThemeTextStyles.caption.copyWith(
                              color: isLocked
                                  ? ColorsAppQy.qyTextTertiary
                                  : ColorsAppQy.qyTextSecondary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          if (isLocked)
                            Icon(Icons.lock, color: ColorsAppQy.qyTextTertiary, size: 14)
                          else
                            Text(
                              QyAppLocalizationKeys.qyCourseCompletedLessons
                                  .tr(context)
                                  .replaceAll(
                                      '{completed}', module.completed.toString())
                                  .replaceAll(
                                      '{total}', module.lessons.toString()),
                              style: ThemeTextStyles.caption.copyWith(
                                color: ColorsAppQy.qyTextSecondary,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (!isLocked)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${(progress * 100).toInt()}%',
                      style: ThemeTextStyles.caption.copyWith(
                        color: module.color,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
            if (!isLocked) ...[
              const SizedBox(height: 16),
              Container(
                height: 6,
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyFrostMedium,
                  borderRadius: BorderRadius.circular(3),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: progress,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [module.color, module.color.withOpacity(0.7)],
                      ),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildProjectsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyPythonProjects.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildProjectsList(),
        ],
      ),
    );
  }

  Widget _buildProjectsList() {
    return Column(
      children: CoursePythonData.projects
          .map((project) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _buildProjectCard(project),
              ))
          .toList(),
    );
  }

  Widget _buildProjectCard(PythonProjectModel project) {
    bool isLocked = project.status == 'locked';
    bool isCompleted = project.status == 'completed';
    bool isInProgress = project.status == 'in_progress';

    Color statusColor = isCompleted
        ? ColorsAppQy.qySuccess
        : (isInProgress ? ColorsAppQy.qyWarning : ColorsAppQy.qyTextTertiary);
    String statusText = isCompleted
        ? QyAppLocalizationKeys.qyPythonStatusCompleted.tr(context)
        : (isInProgress
            ? QyAppLocalizationKeys.qyPythonStatusInProgress.tr(context)
            : QyAppLocalizationKeys.qyPythonStatusLocked.tr(context));

    return InkWell(
      onTap: isLocked ? null : () => _openProject(project.titleKey.tr(context)),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isLocked ? ColorsAppQy.qyBorderLight : ColorsAppQy.qyTextOnPrimary,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color:
                isLocked ? ColorsAppQy.qyBorderMedium : ColorsAppQy.qyBorderLight,
          ),
          boxShadow: isLocked
              ? null
              : [
                  BoxShadow(
                    color: ColorsAppQy.qyShadowLight,
                    blurRadius: 10,
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
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: isLocked
                        ? ColorsAppQy.qyBorderLight
                        : project.color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    project.icon,
                    color: isLocked ? ColorsAppQy.qyTextTertiary : project.color,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        project.titleKey.tr(context),
                        style: ThemeTextStyles.h4.copyWith(
                          color: isLocked ? ColorsAppQy.qyTextTertiary : ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (project.subtitleKey != null)
                        Text(
                          project.subtitleKey!.tr(context),
                          style: ThemeTextStyles.body1.copyWith(
                            color:
                                isLocked ? ColorsAppQy.qyTextTertiary : ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusText,
                    style: ThemeTextStyles.caption.copyWith(
                      color: statusColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getDifficultyColor(project.difficultyKey).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    project.difficultyKey.tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: _getDifficultyColor(project.difficultyKey),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: technologies
                        .map((tech) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: ColorsAppQy.qyFrostMedium,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                tech,
                                style: ThemeTextStyles.caption.copyWith(
                                  color: ColorsAppQy.qyTextSecondary,
                                  fontSize: 10,
                                ),
                              ),
                            ))
                        .toList(),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _getDifficultyColor(String difficultyKey) {
    if (difficultyKey == QyAppLocalizationKeys.qyPythonDifficultyBeginner) {
      return ColorsAppQy.qySuccess;
    } else if (difficultyKey == QyAppLocalizationKeys.qyPythonDifficultyIntermediate) {
      return ColorsAppQy.qyWarning;
    } else if (difficultyKey == QyAppLocalizationKeys.qyPythonDifficultyAdvanced) {
      return ColorsAppQy.qyError;
    }
    return ColorsAppQy.qyInfo;
  }

  Widget _buildProgressTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyPythonCodingStats.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildStatisticsCards(),
          const SizedBox(height: 20),
          _buildCodingActivity(),
          const SizedBox(height: 20),
          _buildSkillsProgress(),
        ],
      ),
    );
  }

  Widget _buildStatisticsCards() {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      children: [
        _buildStatCard(
            QyAppLocalizationKeys.qyPythonCodingDays.tr(context),
            '42',
            Icons.calendar_today,
            ColorsAppQy.qySecondary),
        _buildStatCard(
            QyAppLocalizationKeys.qyPythonCompletedProjects.tr(context),
            '$_projectCompleted',
            Icons.folder_special,
            ColorsAppQy.qySuccess),
        _buildStatCard(
            QyAppLocalizationKeys.qyPythonLinesOfCode.tr(context),
            _getTotalLinesOfCode(),
            Icons.code,
            ColorsAppQy.qyWarning),
        _buildStatCard(
            QyAppLocalizationKeys.qyPythonPracticeHours.tr(context),
            '186h',
            Icons.schedule,
            ColorsAppQy.qyAccent),
      ],
    );
  }

  Widget _buildStatCard(
      String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: color.withOpacity(0.3),
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(
            value,
            style: ThemeTextStyles.h2.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: ThemeTextStyles.caption.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildCodingActivity() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qyFrostedGlassGradient,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyPythonCodingActivity.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: ColorsAppQy.qyFrostMedium,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                QyAppLocalizationKeys.qyPythonCodingActivityChart.tr(context),
                style: const TextStyle(
                  color: ColorsAppQy.qyTextTertiary,
                  fontSize: 16,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSkillsProgress() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qyFrostedGlassGradient,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyPythonSkillsProgress.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          ...CoursePythonData.skills.map((skill) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          skill.nameKey.tr(context),
                          style: ThemeTextStyles.body1.copyWith(
                            color: ColorsAppQy.qyTextPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '${(skill.progress * 100).toInt()}%',
                          style: ThemeTextStyles.caption.copyWith(
                            color: skill.color,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 8,
                      decoration: BoxDecoration(
                        color: ColorsAppQy.qyFrostMedium,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: FractionallySizedBox(
                        alignment: Alignment.centerLeft,
                        widthFactor: skill.progress,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                skill.color,
                                skill.color.withOpacity(0.7),
                              ],
                            ),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  void _continueCoding() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('继续学习：${_course!.title}'),
        backgroundColor: ColorsAppQy.qySecondary,
      ),
    );
  }

  void _openModule(String moduleName) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('打开$moduleName模块'),
        backgroundColor: ColorsAppQy.qyInfo,
      ),
    );
  }

  void _openProject(String projectName) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('打开项目：$projectName'),
        backgroundColor: ColorsAppQy.qySuccess,
      ),
    );
  }
}
