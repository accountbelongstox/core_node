/// Course Data Service
library course_service;

import '../../../common/theme/app_theme.dart';
import '../models/course_model.dart';

class CourseService {
  static const String _currentUserId = 'user_qy_001';

  // Course data
  static List<CourseModel> get _courses => [
    CourseModel(
      id: 'ielts_master',
      title: 'IELTS 雅思备考大师',
      subtitle: '全方位雅思考试辅导课程',
      category: 'IELTS',
      level: 'Advanced',
      duration: '12周',
      lessons: 48,
      price: 999.0,
      rating: 4.8,
      students: 15234,
      instructor: 'Prof. Sarah Johnson',
      description: '专为雅思考试设计的高强度备考课程，涵盖听说读写全面训练',
      features: [
        '听说读写四项专项训练',
        '真题演练和模拟考试',
        '名师一对一辅导',
        '学习计划定制',
        '实时进度跟踪',
        'AI智能评估',
      ],
      topics: [
        '雅思口语技巧',
        '写作结构与表达',
        '阅读理解策略',
        '听力技能提升',
        '词汇与语法强化',
        '考试技巧与策略',
      ],
    ),
    CourseModel(
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
    ),
  ];

  // Module data for IELTS course
  static List<CourseModule> get _ieltsModules => [
    CourseModule(
      id: 'ielts_listening',
      courseId: 'ielts_master',
      title: '听力训练',
      subtitle: '雅思听力专项技能提升',
      description: '通过大量真题练习，掌握听力技巧和策略',
      orderIndex: 1,
      totalLessons: 12,
      completedLessons: 5,
      duration: '3周',
      isLocked: false,
    ),
    CourseModule(
      id: 'ielts_reading',
      courseId: 'ielts_master',
      title: '阅读理解',
      subtitle: '雅思阅读技巧强化',
      description: '提高阅读速度和理解能力，掌握题型解题技巧',
      orderIndex: 2,
      totalLessons: 12,
      completedLessons: 4,
      duration: '3周',
      isLocked: false,
    ),
    CourseModule(
      id: 'ielts_writing',
      courseId: 'ielts_master',
      title: '写作技巧',
      subtitle: '雅思写作结构训练',
      description: '学习写作结构和表达技巧，提高写作质量',
      orderIndex: 3,
      totalLessons: 12,
      completedLessons: 3,
      duration: '3周',
      isLocked: false,
    ),
    CourseModule(
      id: 'ielts_speaking',
      courseId: 'ielts_master',
      title: '口语表达',
      subtitle: '雅思口语能力培养',
      description: '提升口语流利度和表达能力，准备口语考试',
      orderIndex: 4,
      totalLessons: 12,
      completedLessons: 5,
      duration: '3周',
      isLocked: false,
    ),
  ];

  // Module data for Python course
  static List<CourseModule> get _pythonModules => [
    CourseModule(
      id: 'python_basics',
      courseId: 'python_master',
      title: 'Python基础入门',
      subtitle: '变量、数据类型、控制流',
      description: '学习Python基础语法和编程概念',
      orderIndex: 1,
      totalLessons: 12,
      completedLessons: 12,
      duration: '3周',
      isLocked: false,
    ),
    CourseModule(
      id: 'python_oop',
      courseId: 'python_master',
      title: '面向对象编程',
      subtitle: '类、对象、继承、多态',
      description: '深入理解面向对象编程思想',
      orderIndex: 2,
      totalLessons: 10,
      completedLessons: 6,
      duration: '2.5周',
      isLocked: false,
    ),
    CourseModule(
      id: 'python_web',
      courseId: 'python_master',
      title: 'Web开发框架',
      subtitle: 'Django、Flask、FastAPI',
      description: '学习主流Python Web开发框架',
      orderIndex: 3,
      totalLessons: 14,
      completedLessons: 0,
      duration: '4周',
      isLocked: false,
    ),
    CourseModule(
      id: 'python_data',
      courseId: 'python_master',
      title: '数据分析与可视化',
      subtitle: 'NumPy、Pandas、Matplotlib',
      description: '掌握数据分析工具和可视化技术',
      orderIndex: 4,
      totalLessons: 12,
      completedLessons: 0,
      duration: '3周',
      isLocked: false,
    ),
    CourseModule(
      id: 'python_ml',
      courseId: 'python_master',
      title: '机器学习入门',
      subtitle: 'Scikit-learn、TensorFlow基础',
      description: '进入人工智能和机器学习领域',
      orderIndex: 5,
      totalLessons: 10,
      completedLessons: 0,
      duration: '3.5周',
      isLocked: false,
    ),
    CourseModule(
      id: 'python_projects',
      courseId: 'python_master',
      title: '项目实战',
      subtitle: '完整项目开发流程',
      description: '综合运用所学知识完成实际项目',
      orderIndex: 6,
      totalLessons: 6,
      completedLessons: 0,
      duration: '2周',
      isLocked: false,
    ),
  ];

  // Project data for IELTS course
  static List<CourseProject> get _ieltsProjects => [
    CourseProject(
      id: 'ielts_mock_test_1',
      courseId: 'ielts_master',
      title: '全真模拟测试 #1',
      subtitle: '完整雅思考试模拟',
      description: '按照真实考试时间和流程进行完整模拟',
      difficulty: '中级',
      status: 'in_progress',
      technologies: ['IELTS', '模拟测试'],
    ),
    CourseProject(
      id: 'ielts_speaking_practice',
      courseId: 'ielts_master',
      title: '口语话题练习',
      subtitle: '常见口语话题准备',
      description: '针对高频口语话题进行练习和准备',
      difficulty: '中级',
      status: 'completed',
      technologies: ['IELTS', '口语', '话题练习'],
    ),
  ];

  // Project data for Python course
  static List<CourseProject> get _pythonProjects => [
    CourseProject(
      id: 'python_todo_app',
      courseId: 'python_master',
      title: '待办事项应用',
      subtitle: '使用Flask构建的Web应用',
      description: '创建一个功能完整的待办事项管理应用',
      difficulty: '初级',
      status: 'completed',
      technologies: ['Python', 'Flask', 'HTML/CSS'],
    ),
    CourseProject(
      id: 'python_data_dashboard',
      courseId: 'python_master',
      title: '数据可视化仪表板',
      subtitle: '使用Pandas和Matplotlib分析销售数据',
      description: '构建交互式数据分析仪表板',
      difficulty: '中级',
      status: 'completed',
      technologies: ['Python', 'Pandas', 'Matplotlib'],
    ),
    CourseProject(
      id: 'python_web_scraper',
      courseId: 'python_master',
      title: 'Web爬虫工具',
      subtitle: '爬取电商网站数据并进行分析',
      description: '开发网络数据采集和分析工具',
      difficulty: '中级',
      status: 'in_progress',
      technologies: ['Python', 'BeautifulSoup', 'Requests'],
    ),
    CourseProject(
      id: 'python_blog_site',
      courseId: 'python_master',
      title: '博客网站',
      subtitle: 'Django全栈Web开发项目',
      description: '构建一个功能完整的博客平台',
      difficulty: '高级',
      status: 'locked',
      technologies: ['Python', 'Django', 'PostgreSQL'],
    ),
    CourseProject(
      id: 'python_ml_predictor',
      courseId: 'python_master',
      title: '机器学习预测模型',
      subtitle: '预测房价的回归分析项目',
      description: '应用机器学习算法解决实际问题',
      difficulty: '高级',
      status: 'locked',
      technologies: ['Python', 'Scikit-learn', 'Pandas'],
    ),
  ];

  // Progress data
  static Map<String, CourseProgress> get _progressData => {
    'ielts_master': CourseProgress(
      id: 'progress_ielts_master',
      courseId: 'ielts_master',
      userId: _currentUserId,
      overallProgress: 0.35,
      completedLessons: 17,
      totalLessons: 48,
      completedProjects: 1,
      totalProjects: 2,
      currentStreak: 5,
      totalStudyDays: 42,
      totalStudyHours: 126.0,
      linesOfCode: 0,
      moduleProgress: {
        'ielts_listening': 0.42,
        'ielts_reading': 0.33,
        'ielts_writing': 0.25,
        'ielts_speaking': 0.42,
      },
      completedLessonsList: List.generate(17, (index) => 'lesson_${index + 1}'),
      completedProjectsList: ['ielts_speaking_practice'],
    ),
    'python_master': CourseProgress(
      id: 'progress_python_master',
      courseId: 'python_master',
      userId: _currentUserId,
      overallProgress: 0.28,
      completedLessons: 18,
      totalLessons: 64,
      completedProjects: 2,
      totalProjects: 5,
      currentStreak: 12,
      totalStudyDays: 42,
      totalStudyHours: 186.0,
      linesOfCode: 1850,
      moduleProgress: {
        'python_basics': 1.0,
        'python_oop': 0.6,
        'python_web': 0.0,
        'python_data': 0.0,
        'python_ml': 0.0,
        'python_projects': 0.0,
      },
      completedLessonsList: List.generate(18, (index) => 'lesson_${index + 1}'),
      completedProjectsList: ['python_todo_app', 'python_data_dashboard'],
    ),
  };

  // Public methods
  static CourseModel? getCourseById(String courseId) {
    try {
      return _courses.firstWhere((course) => course.id == courseId);
    } catch (e) {
      return null;
    }
  }

  static List<CourseModel> getAllCourses() {
    return List.unmodifiable(_courses);
  }

  static List<CourseModule> getModulesByCourseId(String courseId) {
    switch (courseId) {
      case 'ielts_master':
        return List.unmodifiable(_ieltsModules);
      case 'python_master':
        return List.unmodifiable(_pythonModules);
      default:
        return [];
    }
  }

  static List<CourseProject> getProjectsByCourseId(String courseId) {
    switch (courseId) {
      case 'ielts_master':
        return List.unmodifiable(_ieltsProjects);
      case 'python_master':
        return List.unmodifiable(_pythonProjects);
      default:
        return [];
    }
  }

  static CourseProgress? getProgressByCourseId(String courseId) {
    return _progressData[courseId];
  }

  static List<CourseModel> getCoursesByCategory(String category) {
    return _courses.where((course) => course.category == category).toList();
  }

  static Future<List<CourseModel>> searchCourses(String query) async {
    // Simulate API delay
    await Future.delayed(const Duration(milliseconds: 500));

    if (query.isEmpty) {
      return getAllCourses();
    }

    return _courses.where((course) {
      return course.title.toLowerCase().contains(query.toLowerCase()) ||
             course.description.toLowerCase().contains(query.toLowerCase()) ||
             course.instructor.toLowerCase().contains(query.toLowerCase());
    }).toList();
  }

  static Future<bool> enrollInCourse(String courseId) async {
    // Simulate API call
    await Future.delayed(const Duration(seconds: 1));

    // Initialize progress for new course
    if (!_progressData.containsKey(courseId)) {
      final course = getCourseById(courseId);
      if (course != null) {
        _progressData[courseId] = CourseProgress(
          id: 'progress_$courseId',
          courseId: courseId,
          userId: _currentUserId,
          overallProgress: 0.0,
          completedLessons: 0,
          totalLessons: course.lessons,
          completedProjects: 0,
          totalProjects: getProjectsByCourseId(courseId).length,
        );
      }
    }

    return true;
  }

  static Future<bool> updateProgress(String courseId, {
    int? completedLessons,
    List<String>? completedLessonsList,
    int? completedProjects,
    List<String>? completedProjectsList,
    int? currentStreak,
    double? totalStudyHours,
    int? linesOfCode,
  }) async {
    // Simulate API call
    await Future.delayed(const Duration(milliseconds: 300));

    final progress = _progressData[courseId];
    if (progress != null) {
      final updatedProgress = progress.copyWith(
        completedLessons: completedLessons,
        completedLessonsList: completedLessonsList,
        completedProjects: completedProjects,
        completedProjectsList: completedProjectsList,
        currentStreak: currentStreak,
        totalStudyHours: totalStudyHours,
        linesOfCode: linesOfCode,
        updatedAt: DateTime.now(),
      );

      _progressData[courseId] = updatedProgress;
      return true;
    }

    return false;
  }

  static Future<bool> completeLesson(String courseId, String lessonId) async {
    final progress = _progressData[courseId];
    if (progress != null && !progress.completedLessonsList.contains(lessonId)) {
      final newCompletedLessons = progress.completedLessons + 1;
      final newCompletedLessonsList = [...progress.completedLessonsList, lessonId];
      final newOverallProgress = newCompletedLessons / progress.totalLessons;

      return await updateProgress(
        courseId,
        completedLessons: newCompletedLessons,
        completedLessonsList: newCompletedLessonsList,
        totalStudyHours: progress.totalStudyHours + 0.5, // Assume 30 minutes per lesson
      );
    }

    return false;
  }

  static Future<bool> completeProject(String courseId, String projectId) async {
    final progress = _progressData[courseId];
    if (progress != null && !progress.completedProjectsList.contains(projectId)) {
      final newCompletedProjects = progress.completedProjects + 1;
      final newCompletedProjectsList = [...progress.completedProjectsList, projectId];

      return await updateProgress(
        courseId,
        completedProjects: newCompletedProjects,
        completedProjectsList: newCompletedProjectsList,
        totalStudyHours: progress.totalStudyHours + 2.0, // Assume 2 hours per project
      );
    }

    return false;
  }
}