/// IELTS Course Detail Screen
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../domain/models/course_model.dart';
import '../domain/models/course_lesson_category_model.dart';
import '../domain/services/course_service.dart';
import '../data/course_ielts_data.dart';

class CourseIeltsScreen extends StatefulWidget {
  const CourseIeltsScreen({super.key});

  @override
  State<CourseIeltsScreen> createState() => _CourseIeltsScreenState();
}

class _CourseIeltsScreenState extends State<CourseIeltsScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late AnimationController _progressController;
  late Animation<double> _progressAnimation;
  late AnimationController _shimmerController;
  late TabController _tabController;
  final StorageAppQy _storage = StorageAppQy.instance;
  CourseModel? _course;

  double _userProgress = 0.0;
  int _completedLessons = 0;
  int _currentStreak = 0;

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
    try {
      final cachedCourse = await _storage.getApp<Map<String, dynamic>>(
        '${StorageAppQy.keyUserProgress}_course_ielts',
      );
      if (cachedCourse != null) {
        _course = CourseModel.fromJson(cachedCourse);
        _userProgress = cachedCourse['progress'] as double? ?? 0.0;
        _completedLessons = cachedCourse['completedLessons'] as int? ?? 0;
        _currentStreak = cachedCourse['currentStreak'] as int? ?? 0;
      } else {
        final courseData = CourseService.getCourseById('ielts_master');
        if (courseData != null) {
          _course = courseData;
          final progress = CourseService.getProgressByCourseId('ielts_master');
          if (progress != null) {
            _userProgress = progress.overallProgress;
            _completedLessons = progress.completedLessons;
            _currentStreak = progress.currentStreak;
          } else {
            _userProgress = 0.0;
            _completedLessons = 0;
            _currentStreak = 0;
          }
        }
      }
      _progressAnimation =
          Tween<double>(begin: 0.0, end: _userProgress).animate(
        CurvedAnimation(
            parent: _progressController, curve: Curves.easeOutCubic),
      );
      _progressController.forward();
    } catch (e) {
      // Handle error
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
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient:
              ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Column(
              children: [
                _buildAppBar(),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildOverviewTab(),
                      _buildLessonsTab(),
                      _buildPracticeTab(),
                      _buildProgressTab(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _continueLearning,
        backgroundColor: ColorsAppQy.qyPrimary,
        icon: const Icon(Icons.play_arrow, color: ColorsAppQy.qyTextOnPrimary),
        label: Text(
          QyAppLocalizationKeys.qyCourseContinue.tr(context),
          style: ThemeTextStyles.body1.copyWith(
            color: ColorsAppQy.qyTextOnPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyFrostMedium,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.arrow_back,
                    color: ColorsAppQy.qyPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _course!.title.tr(context),
                      style: ThemeTextStyles.h3.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      _course!.subtitle.tr(context),
                      style: ThemeTextStyles.body1.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  QyAppLocalizationKeys.qyCourseIelts.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyTextOnPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildTabBar(),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      decoration: BoxDecoration(
        color: ColorsAppQy.qyTextOnPrimary,
        borderRadius: BorderRadius.circular(25),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyShadowLight,
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          gradient: ColorsAppQy.qyPrimaryGradient,
          borderRadius: BorderRadius.circular(25),
        ),
        labelColor: ColorsAppQy.qyTextOnPrimary,
        unselectedLabelColor: ColorsAppQy.qyTextSecondary,
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: ThemeTextStyles.caption.copyWith(
          fontWeight: FontWeight.bold,
        ),
        unselectedLabelStyle: ThemeTextStyles.caption,
        tabs: [
          Tab(text: QyAppLocalizationKeys.qyCourseOverview.tr(context)),
          Tab(text: QyAppLocalizationKeys.qyCourseLessons.tr(context)),
          Tab(text: QyAppLocalizationKeys.qyCourseCodePractice.tr(context)),
          Tab(text: QyAppLocalizationKeys.qyCourseProgress.tr(context)),
        ],
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
        gradient: ColorsAppQy.qyPrimaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyPrimary.withOpacity(0.3),
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
                            '${QyAppLocalizationKeys.qyConsecutiveDays.tr(context)} $_currentStreak ${QyAppLocalizationKeys.qyDays.tr(context)}',
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
            QyAppLocalizationKeys.qyIeltsCourseInfo.tr(context),
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
                  QyAppLocalizationKeys.qyIeltsCourseDuration.tr(context),
                  _course!.duration.tr(context),
                  ColorsAppQy.qyInfo,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoItem(
                  Icons.book,
                  QyAppLocalizationKeys.qyIeltsCourseLessons.tr(context),
                  '${_course!.lessons}',
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
                  Icons.signal_cellular_alt,
                  QyAppLocalizationKeys.qyIeltsCourseLevel.tr(context),
                  _course!.level.tr(context),
                  ColorsAppQy.qyWarning,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoItem(
                  Icons.star,
                  QyAppLocalizationKeys.qyIeltsCourseRating.tr(context),
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
            QyAppLocalizationKeys.qyIeltsCourseFeatures.tr(context),
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
                        gradient: ColorsAppQy.qyPrimaryGradient,
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
                        feature.tr(context),
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
            QyAppLocalizationKeys.qyIeltsCourseInstructor.tr(context),
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
                  gradient: ColorsAppQy.qyPrimaryGradient,
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
                      QyAppLocalizationKeys.qyIeltsCourseInstructorDesc
                          .tr(context),
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
            QyAppLocalizationKeys.qyIeltsCourseOutline.tr(context),
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
                        gradient: ColorsAppQy.qyPrimaryGradient,
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
                        topic.tr(context),
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
            QyAppLocalizationKeys.qyIeltsCourseContent.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildLessonCategories(),
        ],
      ),
    );
  }

  Widget _buildLessonCategories() {
    return Column(
      children: CourseIeltsData.lessonCategories
          .map((category) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _buildLessonCategoryCard(category),
              ))
          .toList(),
    );
  }

  Widget _buildLessonCategoryCard(CourseLessonCategoryModel category) {
    final progress = category.completed / category.lessons;

    return InkWell(
      onTap: () => _openLessonCategory(category.titleKey.tr(context)),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyFrostedGlassGradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
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
                    color: category.color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(category.icon, color: category.color, size: 24),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        category.titleKey.tr(context),
                        style: ThemeTextStyles.h4.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        QyAppLocalizationKeys.qyIeltsLessonCompleted
                            .tr(context)
                            .replaceAll('{completed}', '${category.completed}')
                            .replaceAll('{total}', '${category.lessons}'),
                        style: ThemeTextStyles.body1.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: category.color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${(progress * 100).toInt()}%',
                    style: ThemeTextStyles.caption.copyWith(
                      color: category.color,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
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
                      colors: [category.color, category.color.withOpacity(0.7)],
                    ),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPracticeTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyIeltsPracticeAndTest.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildPracticeSection(),
        ],
      ),
    );
  }

  Widget _buildPracticeSection() {
    return Column(
      children: CourseIeltsData.practices
          .map((practice) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _buildPracticeCard(practice),
              ))
          .toList(),
    );
  }

  Widget _buildPracticeCard(CoursePracticeModel practice) {
    return InkWell(
      onTap: () => _startPractice(practice.type),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyFrostedGlassGradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [practice.color, practice.color.withOpacity(0.7)],
                ),
                borderRadius: BorderRadius.circular(28),
              ),
              child: Icon(practice.icon, color: ColorsAppQy.qyTextOnPrimary, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    practice.titleKey.tr(context),
                    style: ThemeTextStyles.h4.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    practice.subtitleKey.tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.schedule,
                          color: ColorsAppQy.qyTextSecondary, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        practice.durationKey.tr(context),
                        style: ThemeTextStyles.caption.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Icon(
              Icons.play_circle_outline,
              color: practice.color,
              size: 32,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyIeltsLearningStats.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildStatisticsCards(),
          const SizedBox(height: 20),
          _buildProgressChart(),
          const SizedBox(height: 20),
          _buildAchievements(),
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
          QyAppLocalizationKeys.qyIeltsStudyDays.tr(context),
          '42',
          Icons.calendar_today,
          ColorsAppQy.qyPrimary,
        ),
        _buildStatCard(
          QyAppLocalizationKeys.qyIeltsCompletedLessons.tr(context),
          '$_completedLessons',
          Icons.check_circle,
          ColorsAppQy.qySuccess,
        ),
        _buildStatCard(
          QyAppLocalizationKeys.qyIeltsPracticeHours.tr(context),
          '126h',
          Icons.schedule,
          ColorsAppQy.qyWarning,
        ),
        _buildStatCard(
          QyAppLocalizationKeys.qyIeltsAverageScore.tr(context),
          '7.5',
          Icons.star,
          ColorsAppQy.qyAccent,
        ),
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

  Widget _buildProgressChart() {
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
            QyAppLocalizationKeys.qyIeltsProgressTrend.tr(context),
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
                QyAppLocalizationKeys.qyIeltsProgressChartPlaceholder
                    .tr(context),
                style: const TextStyle(
                  color: ColorsAppQy.qyTextSecondary,
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

  Widget _buildAchievements() {
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
            QyAppLocalizationKeys.qyIeltsAchievements.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1,
            ),
            itemCount: CourseIeltsData.achievements.length,
            itemBuilder: (context, index) {
              final achievement = CourseIeltsData.achievements[index];

              return Container(
                decoration: BoxDecoration(
                  color: achievement.achieved
                      ? ColorsAppQy.qySuccess.withOpacity(0.1)
                      : ColorsAppQy.qyFrostMedium,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: achievement.achieved
                        ? ColorsAppQy.qySuccess.withOpacity(0.3)
                        : ColorsAppQy.qyBorderLight,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      achievement.icon,
                      color: achievement.achieved
                          ? ColorsAppQy.qySuccess
                          : ColorsAppQy.qyTextSecondary,
                      size: 28,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      achievement.titleKey.tr(context),
                      style: ThemeTextStyles.caption.copyWith(
                        color: achievement.achieved
                            ? ColorsAppQy.qyTextPrimary
                            : ColorsAppQy.qyTextSecondary,
                        fontWeight: achievement.achieved
                            ? FontWeight.w600
                            : FontWeight.normal,
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  void _continueLearning() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${QyAppLocalizationKeys.qyCourseContinue.tr(context)}: ${_course!.title.tr(context)}',
        ),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  void _openLessonCategory(String category) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${QyAppLocalizationKeys.qyView.tr(context)} $category'),
        backgroundColor: ColorsAppQy.qyInfo,
      ),
    );
  }

  void _startPractice(String practiceType) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
            '${QyAppLocalizationKeys.qyStartQuiz.tr(context)}: $practiceType'),
        backgroundColor: ColorsAppQy.qySuccess,
      ),
    );
  }
}
