/// Course Data Service
library;

import '../../../../../../../common/theme/app_theme.dart';
import '../models/course_model.dart';
import '../../sources/course_service_data.dart';

class CourseService {
  static const String _currentUserId = 'user_qy_001';

  // Course data
  static List<CourseModel> get _courses => CourseServiceData.getCourses();

  // Module data for IELTS course
  static List<CourseModule> get _ieltsModules => CourseServiceData.getIeltsModules();

  // Module data for Python course
  static List<CourseModule> get _pythonModules => CourseServiceData.getPythonModules();

  // Project data for IELTS course
  static List<CourseProject> get _ieltsProjects => CourseServiceData.getIeltsProjects();

  // Project data for Python course
  static List<CourseProject> get _pythonProjects => CourseServiceData.getPythonProjects();

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