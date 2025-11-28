/// IELTS Course Detail Screen
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
  bool _isLoading = true;

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
    setState(() => _isLoading = true);
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
        _course = CourseModel(
          id: 'ielts_master',
          title: QyAppLocalizationKeys.qyCourseIelts.tr(context),
          subtitle: QyAppLocalizationKeys.qyCourseIeltsDesc.tr(context),
          category: 'IELTS',
          level: 'Advanced',
          duration: '12周',
          lessons: 48,
          price: 999.0,
          rating: 4.8,
          students: 15234,
          instructor: 'Prof. Sarah Johnson',
          description: QyAppLocalizationKeys.qyCourseIeltsDesc.tr(context),
          features: [
            QyAppLocalizationKeys.qyIeltsFourSkills.tr(context),
            QyAppLocalizationKeys.qyIeltsPracticeTests.tr(context),
            QyAppLocalizationKeys.qyIeltsOneOnOne.tr(context),
            QyAppLocalizationKeys.qyIeltsCustomPlan.tr(context),
            QyAppLocalizationKeys.qyIeltsProgressTracking.tr(context),
            QyAppLocalizationKeys.qyIeltsAIAssessment.tr(context),
          ],
          topics: [
            QyAppLocalizationKeys.qyIeltsSpeaking.tr(context),
            QyAppLocalizationKeys.qyIeltsWriting.tr(context),
            QyAppLocalizationKeys.qyIeltsReading.tr(context),
            QyAppLocalizationKeys.qyIeltsListening.tr(context),
            QyAppLocalizationKeys.qyIeltsVocabulary.tr(context),
            QyAppLocalizationKeys.qyIeltsTestTips.tr(context),
          ],
        );
        _userProgress = 0.35;
        _completedLessons = 17;
        _currentStreak = 5;
      }
      _progressAnimation = Tween<double>(begin: 0.0, end: _userProgress).animate(
        CurvedAnimation(parent: _progressController, curve: Curves.easeOutCubic),
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
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
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
        icon: const Icon(Icons.play_arrow, color: Colors.white),
        label: Text(
          QyAppLocalizationKeys.qyCourseContinue.tr(context),
          style: ThemeTextStyles.body1.copyWith(
            color: Colors.white,
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
                    color: Colors.white.withOpacity(0.8),
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
                      _course!.title,
                      style: ThemeTextStyles.h3.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      _course!.subtitle,
                      style: ThemeTextStyles.body1.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'IELTS',
                  style: ThemeTextStyles.caption.copyWith(
                    color: Colors.white,
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(25),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
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
        labelColor: Colors.white,
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
                        QyAppLocalizationKeys.qyCourseCompletedLessons.tr(context).replaceAll('{completed}', _completedLessons.toString()).replaceAll('{total}', _course!.lessons.toString()),
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
                            '连续 $_currentStreak 天',
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
            '课程信息',
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
                  '课程时长',
                  _course!.duration,
                  ColorsAppQy.qyInfo,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoItem(
                  Icons.book,
                  '课程数量',
                  '${_course!.lessons}节',
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
                  '难度等级',
                  _course!.level,
                  ColorsAppQy.qyWarning,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoItem(
                  Icons.star,
                  '评分',
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

  Widget _buildInfoItem(IconData icon, String label, String value, Color color) {
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
            '课程特色',
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
            '授课导师',
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
                      '资深雅思培训专家\n10年教学经验',
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
            '课程大纲',
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
                        gradient: ColorsAppQy.qyPrimaryGradient,
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
            '课程内容',
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
    final categories = [
      {
        'title': '听力训练',
        'icon': Icons.headphones,
        'color': ColorsAppQy.qyInfo,
        'lessons': 12,
        'completed': 5,
      },
      {
        'title': '阅读理解',
        'icon': Icons.menu_book,
        'color': ColorsAppQy.qySuccess,
        'lessons': 12,
        'completed': 4,
      },
      {
        'title': '写作技巧',
        'icon': Icons.edit,
        'color': ColorsAppQy.qyWarning,
        'lessons': 12,
        'completed': 3,
      },
      {
        'title': '口语表达',
        'icon': Icons.record_voice_over,
        'color': ColorsAppQy.qyAccent,
        'lessons': 12,
        'completed': 5,
      },
    ];

    return Column(
      children: categories.map((category) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: _buildLessonCategoryCard(
          category['title'] as String,
          category['icon'] as IconData,
          category['color'] as Color,
          category['lessons'] as int,
          category['completed'] as int,
        ),
      )).toList(),
    );
  }

  Widget _buildLessonCategoryCard(String title, IconData icon, Color color, int totalLessons, int completed) {
    final progress = completed / totalLessons;

    return InkWell(
      onTap: () => _openLessonCategory(title),
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
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(icon, color: color, size: 24),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: ThemeTextStyles.h4.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '已完成 $completed/$totalLessons 节课',
                        style: ThemeTextStyles.body1.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
            '练习与测试',
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
    final practices = [
      {
        'title': '模拟测试',
        'subtitle': '完整雅思模拟考试',
        'icon': Icons.assignment,
        'color': ColorsAppQy.qyPrimary,
        'duration': '2小时45分钟',
        'type': 'full_test',
      },
      {
        'title': '专项练习',
        'subtitle': '分项技能强化训练',
        'icon': Icons.fitness_center,
        'color': ColorsAppQy.qySuccess,
        'duration': '30-60分钟',
        'type': 'skill_practice',
      },
      {
        'title': '真题演练',
        'subtitle': '历年真题精选练习',
        'icon': Icons.history_edu,
        'color': ColorsAppQy.qyWarning,
        'duration': '45-90分钟',
        'type': 'past_papers',
      },
      {
        'title': '口语对练',
        'subtitle': 'AI智能口语对话',
        'icon': Icons.chat,
        'color': ColorsAppQy.qyInfo,
        'duration': '15-30分钟',
        'type': 'speaking',
      },
    ];

    return Column(
      children: practices.map((practice) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: _buildPracticeCard(
          practice['title'] as String,
          practice['subtitle'] as String,
          practice['icon'] as IconData,
          practice['color'] as Color,
          practice['duration'] as String,
          practice['type'] as String,
        ),
      )).toList(),
    );
  }

  Widget _buildPracticeCard(String title, String subtitle, IconData icon, Color color, String duration, String type) {
    return InkWell(
      onTap: () => _startPractice(type),
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
                  colors: [color, color.withOpacity(0.7)],
                ),
                borderRadius: BorderRadius.circular(28),
              ),
              child: Icon(icon, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: ThemeTextStyles.h4.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.schedule, color: ColorsAppQy.qyTextSecondary, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        duration,
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
              color: color,
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
            '学习统计',
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
        _buildStatCard('学习天数', '42', Icons.calendar_today, ColorsAppQy.qyPrimary),
        _buildStatCard('完成课时', '$_completedLessons', Icons.check_circle, ColorsAppQy.qySuccess),
        _buildStatCard('练习时长', '126h', Icons.schedule, ColorsAppQy.qyWarning),
        _buildStatCard('平均分数', '7.5', Icons.star, ColorsAppQy.qyAccent),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
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
            '学习进度趋势',
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
                '📊 学习进度图表\n(需要集成图表库)',
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

  Widget _buildAchievements() {
    final achievements = [
      {'title': '连续学习7天', 'icon': Icons.local_fire_department, 'achieved': true},
      {'title': '完成首个模拟测试', 'icon': Icons.emoji_events, 'achieved': true},
      {'title': '听力专项突破', 'icon': Icons.headphones, 'achieved': false},
      {'title': '阅读速度提升', 'icon': Icons.speed, 'achieved': false},
      {'title': '写作结构掌握', 'icon': Icons.edit, 'achieved': false},
      {'title': '口语流利度提升', 'icon': Icons.record_voice_over, 'achieved': false},
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
            '成就徽章',
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
            itemCount: achievements.length,
            itemBuilder: (context, index) {
              final achievement = achievements[index];
              final isAchieved = achievement['achieved'] as bool;

              return Container(
                decoration: BoxDecoration(
                  color: isAchieved
                      ? ColorsAppQy.qySuccess.withOpacity(0.1)
                      : Colors.white.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isAchieved
                        ? ColorsAppQy.qySuccess.withOpacity(0.3)
                        : ColorsAppQy.qyBorderLight,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      achievement['icon'] as IconData,
                      color: isAchieved ? ColorsAppQy.qySuccess : Colors.grey,
                      size: 28,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      achievement['title'] as String,
                      style: ThemeTextStyles.caption.copyWith(
                        color: isAchieved ? ColorsAppQy.qyTextPrimary : Colors.grey,
                        fontWeight: isAchieved ? FontWeight.w600 : FontWeight.normal,
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
    // Navigate to the next lesson
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('继续学习：${_course!.title}'),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  void _openLessonCategory(String category) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('打开$category课程'),
        backgroundColor: ColorsAppQy.qyInfo,
      ),
    );
  }

  void _startPractice(String practiceType) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('开始$practiceType练习'),
        backgroundColor: ColorsAppQy.qySuccess,
      ),
    );
  }
}