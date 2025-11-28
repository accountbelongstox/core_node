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
        icon: const Icon(Icons.code, color: Colors.white),
        label: Text(
          QyAppLocalizationKeys.qyCourseContinueCoding.tr(context),
          style: ThemeTextStyles.body1.copyWith(
            color: Colors.white,
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
                color: Colors.white.withOpacity(0.2),
                width: 1,
              ),
            ),
          ),
          child: CustomAppBar(
            title: _course?.title ??
                QyAppLocalizationKeys.qyCoursePython.tr(context),
            backgroundColor: Colors.transparent,
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
                    color: Colors.white,
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
                color: Colors.white.withOpacity(0.2),
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
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${(_userProgress * 100).toInt()}%',
                  style: ThemeTextStyles.caption.copyWith(
                    color: Colors.white,
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
                      color: Colors.white.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: _progressAnimation.value,
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
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
                          color: Colors.white.withOpacity(0.9),
                        ),
                      ),
                      Row(
                        children: [
                          Icon(Icons.local_fire_department,
                              color: Colors.white.withOpacity(0.9), size: 16),
                          const SizedBox(width: 4),
                          Text(
                            QyAppLocalizationKeys.qyCourseConsecutiveDays
                                .tr(context)
                                .replaceAll(
                                    '{days}', _currentStreak.toString()),
                            style: ThemeTextStyles.body1.copyWith(
                              color: Colors.white.withOpacity(0.9),
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
                          color: Colors.white.withOpacity(0.9),
                        ),
                      ),
                      Row(
                        children: [
                          Icon(Icons.code,
                              color: Colors.white.withOpacity(0.9), size: 16),
                          const SizedBox(width: 4),
                          Text(
                            QyAppLocalizationKeys.qyCourseLinesOfCode
                                .tr(context)
                                .replaceAll('{lines}',
                                    _getTotalLinesOfCode().toString()),
                            style: ThemeTextStyles.body1.copyWith(
                              color: Colors.white.withOpacity(0.9),
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
                        color: Colors.white,
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
                    color: Colors.white,
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
                  color: Colors.white.withOpacity(0.3),
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
                            color: Colors.white,
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
    final modules = [
      {
        'title': 'Python基础入门',
        'subtitle': '变量、数据类型、控制流',
        'icon': Icons.school,
        'color': ColorsAppQy.qyInfo,
        'lessons': 12,
        'completed': 12,
        'duration': '3周',
      },
      {
        'title': '面向对象编程',
        'subtitle': '类、对象、继承、多态',
        'icon': Icons.widgets,
        'color': ColorsAppQy.qySuccess,
        'lessons': 10,
        'completed': 6,
        'duration': '2.5周',
      },
      {
        'title': 'Web开发框架',
        'subtitle': 'Django、Flask、FastAPI',
        'icon': Icons.web,
        'color': ColorsAppQy.qyWarning,
        'lessons': 14,
        'completed': 0,
        'duration': '4周',
      },
      {
        'title': '数据分析与可视化',
        'subtitle': 'NumPy、Pandas、Matplotlib',
        'icon': Icons.analytics,
        'color': ColorsAppQy.qyAccent,
        'lessons': 12,
        'completed': 0,
        'duration': '3周',
      },
      {
        'title': '机器学习入门',
        'subtitle': 'Scikit-learn、TensorFlow基础',
        'icon': Icons.psychology,
        'color': ColorsAppQy.qyPrimary,
        'lessons': 10,
        'completed': 0,
        'duration': '3.5周',
      },
      {
        'title': '项目实战',
        'subtitle': '完整项目开发流程',
        'icon': Icons.integration_instructions,
        'color': ColorsAppQy.qyPrimary,
        'lessons': 6,
        'completed': 0,
        'duration': '2周',
      },
    ];

    return Column(
      children: modules
          .map((module) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _buildModuleCard(
                  module['title'] as String,
                  module['subtitle'] as String,
                  module['icon'] as IconData,
                  module['color'] as Color,
                  module['lessons'] as int,
                  module['completed'] as int,
                  module['duration'] as String,
                ),
              ))
          .toList(),
    );
  }

  Widget _buildModuleCard(String title, String subtitle, IconData icon,
      Color color, int totalLessons, int completed, String duration) {
    final progress = totalLessons > 0 ? completed / totalLessons : 0.0;
    final isLocked = completed == 0 && totalLessons > 0;

    return InkWell(
      onTap: isLocked ? null : () => _openModule(title),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isLocked ? Colors.grey.withOpacity(0.1) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color:
                isLocked ? Colors.grey.withOpacity(0.3) : ColorsAppQy.qyBorderLight,
          ),
          boxShadow: isLocked
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
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
                        ? Colors.grey.withOpacity(0.2)
                        : color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    icon,
                    color: isLocked ? Colors.grey : color,
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
                          color: isLocked ? Colors.grey : ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: ThemeTextStyles.body1.copyWith(
                          color:
                              isLocked ? Colors.grey : ColorsAppQy.qyTextSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.schedule,
                              color: isLocked
                                  ? Colors.grey
                                  : ColorsAppQy.qyTextSecondary,
                              size: 14),
                          const SizedBox(width: 4),
                          Text(
                            duration,
                            style: ThemeTextStyles.caption.copyWith(
                              color: isLocked
                                  ? Colors.grey
                                  : ColorsAppQy.qyTextSecondary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          if (isLocked)
                            Icon(Icons.lock, color: Colors.grey, size: 14)
                          else
                            Text(
                              QyAppLocalizationKeys.qyCourseCompletedLessons
                                  .tr(context)
                                  .replaceAll(
                                      '{completed}', completed.toString())
                                  .replaceAll(
                                      '{total}', totalLessons.toString()),
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
                        color: color,
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
                  color: Colors.white.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(3),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: progress,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [color, color.withOpacity(0.7)],
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
            '编程项目',
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
    final projects = [
      {
        'title': '待办事项应用',
        'subtitle': '使用Flask构建的Web应用',
        'difficulty': '初级',
        'status': 'completed',
        'icon': Icons.checklist,
        'color': ColorsAppQy.qySuccess,
        'technologies': ['Python', 'Flask', 'HTML/CSS'],
      },
      {
        'title': '数据可视化仪表板',
        'subtitle': '使用Pandas和Matplotlib分析销售数据',
        'difficulty': '中级',
        'status': 'completed',
        'icon': Icons.dashboard,
        'color': ColorsAppQy.qyInfo,
        'technologies': ['Python', 'Pandas', 'Matplotlib'],
      },
      {
        'title': 'Web爬虫工具',
        'subtitle': '爬取电商网站数据并进行分析',
        'difficulty': '中级',
        'status': 'in_progress',
        'icon': Icons.web,
        'color': ColorsAppQy.qyWarning,
        'technologies': ['Python', 'BeautifulSoup', 'Requests'],
      },
      {
        'title': '博客网站',
        'subtitle': 'Django全栈Web开发项目',
        'difficulty': '高级',
        'status': 'locked',
        'icon': Icons.web,
        'color': ColorsAppQy.qyAccent,
        'technologies': ['Python', 'Django', 'PostgreSQL'],
      },
      {
        'title': '机器学习预测模型',
        'subtitle': '预测房价的回归分析项目',
        'difficulty': '高级',
        'status': 'locked',
        'icon': Icons.trending_up,
        'color': ColorsAppQy.qyPrimary,
        'technologies': ['Python', 'Scikit-learn', 'Pandas'],
      },
    ];

    return Column(
      children: projects
          .map((project) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _buildProjectCard(
                  project['title'] as String,
                  project['subtitle'] as String,
                  project['difficulty'] as String,
                  project['status'] as String,
                  project['icon'] as IconData,
                  project['color'] as Color,
                  project['technologies'] as List<String>,
                ),
              ))
          .toList(),
    );
  }

  Widget _buildProjectCard(String title, String subtitle, String difficulty,
      String status, IconData icon, Color color, List<String> technologies) {
    bool isLocked = status == 'locked';
    bool isCompleted = status == 'completed';
    bool isInProgress = status == 'in_progress';

    Color statusColor = isCompleted
        ? ColorsAppQy.qySuccess
        : (isInProgress ? ColorsAppQy.qyWarning : Colors.grey);
    String statusText = isCompleted ? '已完成' : (isInProgress ? '进行中' : '未解锁');

    return InkWell(
      onTap: isLocked ? null : () => _openProject(title),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isLocked ? Colors.grey.withOpacity(0.1) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color:
                isLocked ? Colors.grey.withOpacity(0.3) : ColorsAppQy.qyBorderLight,
          ),
          boxShadow: isLocked
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
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
                        ? Colors.grey.withOpacity(0.2)
                        : color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    icon,
                    color: isLocked ? Colors.grey : color,
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
                          color: isLocked ? Colors.grey : ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: ThemeTextStyles.body1.copyWith(
                          color:
                              isLocked ? Colors.grey : ColorsAppQy.qyTextSecondary,
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
                    color: _getDifficultyColor(difficulty).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    difficulty,
                    style: ThemeTextStyles.caption.copyWith(
                      color: _getDifficultyColor(difficulty),
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
                                color: Colors.white.withOpacity(0.3),
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

  Color _getDifficultyColor(String difficulty) {
    switch (difficulty) {
      case '初级':
        return ColorsAppQy.qySuccess;
      case '中级':
        return ColorsAppQy.qyWarning;
      case '高级':
        return ColorsAppQy.qyError;
      default:
        return ColorsAppQy.qyInfo;
    }
  }

  Widget _buildProgressTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '编程统计',
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
            '编码天数', '42', Icons.calendar_today, ColorsAppQy.qySecondary),
        _buildStatCard('完成项目', '$_projectCompleted', Icons.folder_special,
            ColorsAppQy.qySuccess),
        _buildStatCard(
            '代码行数', _getTotalLinesOfCode(), Icons.code, ColorsAppQy.qyWarning),
        _buildStatCard('练习时长', '186h', Icons.schedule, ColorsAppQy.qyAccent),
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
            '编程活跃度',
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.3),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Text(
                '📈 编程活跃度图表\n(显示每日编码时间和提交次数)',
                style: TextStyle(
                  color: Colors.grey,
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
    final skills = [
      {'name': 'Python基础', 'progress': 0.95, 'color': ColorsAppQy.qySuccess},
      {'name': '面向对象', 'progress': 0.70, 'color': ColorsAppQy.qyInfo},
      {'name': 'Web开发', 'progress': 0.30, 'color': ColorsAppQy.qyWarning},
      {'name': '数据分析', 'progress': 0.15, 'color': ColorsAppQy.qyAccent},
      {'name': '机器学习', 'progress': 0.05, 'color': ColorsAppQy.qyPrimary},
    ];

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
            '技能进度',
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          ...skills.map((skill) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          skill['name'] as String,
                          style: ThemeTextStyles.body1.copyWith(
                            color: ColorsAppQy.qyTextPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '${((skill['progress'] as double) * 100).toInt()}%',
                          style: ThemeTextStyles.caption.copyWith(
                            color: skill['color'] as Color,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 8,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: FractionallySizedBox(
                        alignment: Alignment.centerLeft,
                        widthFactor: skill['progress'] as double,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                skill['color'] as Color,
                                (skill['color'] as Color).withOpacity(0.7),
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
