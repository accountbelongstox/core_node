/// Python Course Detail Screen
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';
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
  late TabController _tabController;

  final CourseModel _pythonCourse = CourseModel(
    id: 'python_master',
    title: 'Python 编程大师班',
    subtitle: '从零基础到专业开发者的完整学习路径',
    category: 'Python',
    level: 'Beginner to Advanced',
    duration: '16周',
    lessons: 64,
    price: 1299.0,
    rating: 4.9,
    students: 28456,
    instructor: 'Prof. Michael Chen',
    description: '系统化Python编程学习，涵盖基础语法、Web开发、数据分析、人工智能等核心领域',
    features: [
      '项目驱动式学习',
      '代码实战练习',
      '导师代码review',
      '项目作品集指导',
      '就业推荐服务',
      '社区学习支持',
    ],
    topics: [
      'Python基础语法',
      '面向对象编程',
      'Web开发框架',
      '数据分析与可视化',
      '机器学习入门',
      '项目实战演练',
    ],
  );

  final double _userProgress = 0.28;
  final int _completedLessons = 18;
  final int _currentStreak = 12;
  final int _projectCompleted = 3;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: ComponentStyles.normalDuration,
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: ComponentStyles.primaryCurve),
    );

    _progressController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    _progressAnimation = Tween<double>(begin: 0.0, end: _userProgress).animate(
      CurvedAnimation(parent: _progressController, curve: Curves.easeOutCubic),
    );

    _tabController = TabController(length: 4, vsync: this);

    _controller.forward();
    _progressController.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    _progressController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.learningGradient.colors[0].withOpacity(0.1),
              AppTheme.learningGradient.colors[1].withOpacity(0.05),
              Colors.white,
            ],
          ),
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
                      _buildProjectsTab(),
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
        onPressed: _continueCoding,
        backgroundColor: AppTheme.learningColor,
        child: Row(
          children: [
            const Icon(Icons.code, color: Colors.white),
            const SizedBox(width: 8),
            Text(
              '继续编程',
              style: AppTextStyles.bodyMedium.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
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
              BouncingButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.8),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.arrow_back,
                    color: AppTheme.learningColor,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _pythonCourse.title,
                      style: AppTextStyles.headline5.copyWith(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      _pythonCourse.subtitle,
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  gradient: AppTheme.learningGradient,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Python',
                  style: AppTextStyles.bodySmall.copyWith(
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
            color: AppTheme.shadowLight.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          gradient: AppTheme.learningGradient,
          borderRadius: BorderRadius.circular(25),
        ),
        labelColor: Colors.white,
        unselectedLabelColor: AppTheme.textSecondary,
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: AppTextStyles.bodySmall.copyWith(
          fontWeight: FontWeight.bold,
        ),
        unselectedLabelStyle: AppTextStyles.bodySmall,
        tabs: const [
          Tab(text: '概览'),
          Tab(text: '课程'),
          Tab(text: '项目'),
          Tab(text: '进度'),
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
        gradient: AppTheme.learningGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppTheme.learningColor.withOpacity(0.3),
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
                '编程学习进度',
                style: AppTextStyles.headline6.copyWith(
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
                  style: AppTextStyles.bodySmall.copyWith(
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
                        '已完成 $_completedLessons/${_pythonCourse.lessons} 节课',
                        style: AppTextStyles.bodyMedium.copyWith(
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
                            style: AppTextStyles.bodyMedium.copyWith(
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
                        '完成项目 $_projectCompleted 个',
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: Colors.white.withOpacity(0.9),
                        ),
                      ),
                      Row(
                        children: [
                          Icon(Icons.code,
                               color: Colors.white.withOpacity(0.9), size: 16),
                          const SizedBox(width: 4),
                          Text(
                            '编程 ${_getTotalLinesOfCode()} 行',
                            style: AppTextStyles.bodyMedium.copyWith(
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
      decoration: ComponentStyles.primaryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '课程信息',
            style: AppTextStyles.headline6.copyWith(
              color: AppTheme.textPrimary,
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
                  _pythonCourse.duration,
                  AppTheme.info,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoItem(
                  Icons.code,
                  '代码练习',
                  '${_pythonCourse.lessons}个',
                  AppTheme.success,
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
                  '难度递进',
                  _pythonCourse.level,
                  AppTheme.warning,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoItem(
                  Icons.star,
                  '课程评分',
                  '${_pythonCourse.rating}',
                  AppTheme.accentColor,
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
            style: AppTextStyles.bodySmall.copyWith(
              color: AppTheme.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTextStyles.bodyMedium.copyWith(
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
      decoration: ComponentStyles.primaryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '课程特色',
            style: AppTextStyles.headline6.copyWith(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          ..._pythonCourse.features.map((feature) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    gradient: AppTheme.learningGradient,
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
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppTheme.textPrimary,
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
      decoration: ComponentStyles.primaryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '授课导师',
            style: AppTextStyles.headline6.copyWith(
              color: AppTheme.textPrimary,
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
                  gradient: AppTheme.learningGradient,
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
                      _pythonCourse.instructor,
                      style: AppTextStyles.headline6.copyWith(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '资深Python开发专家\n15年行业经验，前Google工程师',
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textSecondary,
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
      decoration: ComponentStyles.primaryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '学习路径',
            style: AppTextStyles.headline6.copyWith(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          ..._pythonCourse.topics.asMap().entries.map((entry) {
            final index = entry.key;
            final topic = entry.value;
            return AnimationUtils.staggeredAnimation(
              index: index,
              totalItems: _pythonCourse.topics.length,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.backgroundLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppTheme.borderLight,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          gradient: AppTheme.learningGradient,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Center(
                          child: Text(
                            '${index + 1}',
                            style: AppTextStyles.bodySmall.copyWith(
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
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ),
                      Icon(
                        Icons.arrow_forward_ios,
                        color: AppTheme.textSecondary,
                        size: 16,
                      ),
                    ],
                  ),
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
            style: AppTextStyles.headline5.copyWith(
              color: AppTheme.textPrimary,
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
        'color': AppTheme.info,
        'lessons': 12,
        'completed': 12,
        'duration': '3周',
      },
      {
        'title': '面向对象编程',
        'subtitle': '类、对象、继承、多态',
        'icon': Icons.widgets,
        'color': AppTheme.success,
        'lessons': 10,
        'completed': 6,
        'duration': '2.5周',
      },
      {
        'title': 'Web开发框架',
        'subtitle': 'Django、Flask、FastAPI',
        'icon': Icons.web,
        'color': AppTheme.warning,
        'lessons': 14,
        'completed': 0,
        'duration': '4周',
      },
      {
        'title': '数据分析与可视化',
        'subtitle': 'NumPy、Pandas、Matplotlib',
        'icon': Icons.analytics,
        'color': AppTheme.accentColor,
        'lessons': 12,
        'completed': 0,
        'duration': '3周',
      },
      {
        'title': '机器学习入门',
        'subtitle': 'Scikit-learn、TensorFlow基础',
        'icon': Icons.psychology,
        'color': AppTheme.primaryColor,
        'lessons': 10,
        'completed': 0,
        'duration': '3.5周',
      },
      {
        'title': '项目实战',
        'subtitle': '完整项目开发流程',
        'icon': Icons.integration_instructions,
        'color': AppTheme.masteredColor,
        'lessons': 6,
        'completed': 0,
        'duration': '2周',
      },
    ];

    return Column(
      children: modules.map((module) => Padding(
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
      )).toList(),
    );
  }

  Widget _buildModuleCard(String title, String subtitle, IconData icon, Color color,
                         int totalLessons, int completed, String duration) {
    final progress = totalLessons > 0 ? completed / totalLessons : 0.0;
    final isLocked = completed == 0 && totalLessons > 0;

    return BouncingButton(
      onPressed: isLocked ? null : () => _openModule(title),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isLocked ? Colors.grey.withOpacity(0.1) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isLocked ? Colors.grey.withOpacity(0.3) : AppTheme.borderLight,
          ),
          boxShadow: isLocked ? null : [
            BoxShadow(
              color: AppTheme.shadowLight.withOpacity(0.1),
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
                    color: isLocked ? Colors.grey.withOpacity(0.2) : color.withOpacity(0.1),
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
                        style: AppTextStyles.headline6.copyWith(
                          color: isLocked ? Colors.grey : AppTheme.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: isLocked ? Colors.grey : AppTheme.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.schedule,
                               color: isLocked ? Colors.grey : AppTheme.textSecondary,
                               size: 14),
                          const SizedBox(width: 4),
                          Text(
                            duration,
                            style: AppTextStyles.bodySmall.copyWith(
                              color: isLocked ? Colors.grey : AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          if (isLocked)
                            Icon(Icons.lock, color: Colors.grey, size: 14)
                          else
                            Text(
                              '已完成 $completed/$totalLessons',
                              style: AppTextStyles.bodySmall.copyWith(
                                color: AppTheme.textSecondary,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (!isLocked)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${(progress * 100).toInt()}%',
                      style: AppTextStyles.bodySmall.copyWith(
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
                  color: AppTheme.backgroundLight,
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
            style: AppTextStyles.headline5.copyWith(
              color: AppTheme.textPrimary,
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
        'color': AppTheme.success,
        'technologies': ['Python', 'Flask', 'HTML/CSS'],
      },
      {
        'title': '数据可视化仪表板',
        'subtitle': '使用Pandas和Matplotlib分析销售数据',
        'difficulty': '中级',
        'status': 'completed',
        'icon': Icons.dashboard,
        'color': AppTheme.info,
        'technologies': ['Python', 'Pandas', 'Matplotlib'],
      },
      {
        'title': 'Web爬虫工具',
        'subtitle': '爬取电商网站数据并进行分析',
        'difficulty': '中级',
        'status': 'in_progress',
        'icon': Icons.webcrawler,
        'color': AppTheme.warning,
        'technologies': ['Python', 'BeautifulSoup', 'Requests'],
      },
      {
        'title': '博客网站',
        'subtitle': 'Django全栈Web开发项目',
        'difficulty': '高级',
        'status': 'locked',
        'icon': Icons.web,
        'color': AppTheme.accentColor,
        'technologies': ['Python', 'Django', 'PostgreSQL'],
      },
      {
        'title': '机器学习预测模型',
        'subtitle': '预测房价的回归分析项目',
        'difficulty': '高级',
        'status': 'locked',
        'icon': Icons.trending_up,
        'color': AppTheme.primaryColor,
        'technologies': ['Python', 'Scikit-learn', 'Pandas'],
      },
    ];

    return Column(
      children: projects.map((project) => Padding(
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
      )).toList(),
    );
  }

  Widget _buildProjectCard(String title, String subtitle, String difficulty, String status,
                          IconData icon, Color color, List<String> technologies) {
    bool isLocked = status == 'locked';
    bool isCompleted = status == 'completed';
    bool isInProgress = status == 'in_progress';

    Color statusColor = isCompleted ? AppTheme.success : (isInProgress ? AppTheme.warning : Colors.grey);
    String statusText = isCompleted ? '已完成' : (isInProgress ? '进行中' : '未解锁');

    return BouncingButton(
      onPressed: isLocked ? null : () => _openProject(title),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isLocked ? Colors.grey.withOpacity(0.1) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isLocked ? Colors.grey.withOpacity(0.3) : AppTheme.borderLight,
          ),
          boxShadow: isLocked ? null : [
            BoxShadow(
              color: AppTheme.shadowLight.withOpacity(0.1),
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
                    color: isLocked ? Colors.grey.withOpacity(0.2) : color.withOpacity(0.1),
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
                        style: AppTextStyles.headline6.copyWith(
                          color: isLocked ? Colors.grey : AppTheme.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: isLocked ? Colors.grey : AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusText,
                    style: AppTextStyles.bodySmall.copyWith(
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
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getDifficultyColor(difficulty).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    difficulty,
                    style: AppTextStyles.bodySmall.copyWith(
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
                    children: technologies.map((tech) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.backgroundLight,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        tech,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppTheme.textSecondary,
                          fontSize: 10,
                        ),
                      ),
                    )).toList(),
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
        return AppTheme.success;
      case '中级':
        return AppTheme.warning;
      case '高级':
        return AppTheme.error;
      default:
        return AppTheme.info;
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
            style: AppTextStyles.headline5.copyWith(
              color: AppTheme.textPrimary,
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
      childCount: 4,
      children: [
        _buildStatCard('编码天数', '42', Icons.calendar_today, AppTheme.learningColor),
        _buildStatCard('完成项目', '$_projectCompleted', Icons.folder_special, AppTheme.success),
        _buildStatCard('代码行数', _getTotalLinesOfCode(), Icons.code, AppTheme.warning),
        _buildStatCard('练习时长', '186h', Icons.schedule, AppTheme.accentColor),
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
            style: AppTextStyles.headline4.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: AppTextStyles.bodySmall.copyWith(
              color: AppTheme.textSecondary,
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
      decoration: ComponentStyles.primaryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '编程活跃度',
            style: AppTextStyles.headline6.copyWith(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: AppTheme.backgroundLight,
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
      {'name': 'Python基础', 'progress': 0.95, 'color': AppTheme.success},
      {'name': '面向对象', 'progress': 0.70, 'color': AppTheme.info},
      {'name': 'Web开发', 'progress': 0.30, 'color': AppTheme.warning},
      {'name': '数据分析', 'progress': 0.15, 'color': AppTheme.accentColor},
      {'name': '机器学习', 'progress': 0.05, 'color': AppTheme.primaryColor},
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: ComponentStyles.primaryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '技能进度',
            style: AppTextStyles.headline6.copyWith(
              color: AppTheme.textPrimary,
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
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      '${((skill['progress'] as double) * 100).toInt()}%',
                      style: AppTextStyles.bodySmall.copyWith(
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
                    color: AppTheme.backgroundLight,
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
        content: Text('继续学习：${_pythonCourse.title}'),
        backgroundColor: AppTheme.learningColor,
      ),
    );
  }

  void _openModule(String moduleName) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('打开$moduleName模块'),
        backgroundColor: AppTheme.info,
      ),
    );
  }

  void _openProject(String projectName) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('打开项目：$projectName'),
        backgroundColor: AppTheme.success,
      ),
    );
  }
}