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

/// Course service for QY App - handles API calls for course data
library;

import '../model/course_model.dart';
import '../../../../services_app_qy/api_service_app_qy.dart';
import '../../sources/course_plan_data.dart';

class CourseService {
  final ApiServiceAppQy _apiService;

  const CourseService({
    required ApiServiceAppQy apiService,
  }) : _apiService = apiService;

  Future<List<CourseModel>> getCoursesByCategory(String category) async {
    try {
      final response = await _apiService.get(
        '/api/v1/courses',
        queryParameters: {'category': category},
      );
      final responseData = response['data'] ?? response;
      final data = (responseData is List) ? responseData : (responseData['courses'] ?? responseData['items'] ?? []);
      final dataList = data as List<dynamic>;
      return dataList
          .map((json) => CourseModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return _getMockCourses(category);
    }
  }

  Future<CourseModel> getCourseById(String id) async {
    try {
      final response = await _apiService.get('/api/v1/courses/$id');
      final data = response['data'] ?? response;
      return CourseModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      rethrow;
    }
  }

  Future<List<CoursePlanModel>> getCoursePlans(String category) async {
    try {
      final response = await _apiService.get(
        '/api/v1/courses/plans',
        queryParameters: {'category': category},
      );
      final responseData = response['data'] ?? response;
      final data = (responseData is List) ? responseData : (responseData['plans'] ?? responseData['items'] ?? []);
      final dataList = data as List<dynamic>;
      return dataList
          .map((json) => CoursePlanModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return _getMockPlans(category);
    }
  }

  Future<void> enrollCourse(String courseId) async {
    try {
      await _apiService.post('/api/v1/courses/$courseId/enroll');
    } catch (e) {
      rethrow;
    }
  }

  Future<void> updateProgress(String courseId, int lessonId) async {
    try {
      await _apiService.post('/api/v1/courses/$courseId/progress', data: {
        'lesson_id': lessonId,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      rethrow;
    }
  }

  List<CourseModel> _getMockCourses(String category) {
    return [
      const CourseModel(
        id: '1',
        title: 'IELTS Writing Master',
        description: 'Comprehensive IELTS writing training',
        category: 'ielts',
        level: 'intermediate',
        totalLessons: 30,
        completedLessons: 5,
        duration: '8 weeks',
        participants: 12500,
        rating: 4.8,
      ),
      const CourseModel(
        id: '2',
        title: 'IELTS Speaking Practice',
        description: 'Improve your speaking skills for IELTS',
        category: 'ielts',
        level: 'intermediate',
        totalLessons: 25,
        completedLessons: 0,
        duration: '6 weeks',
        participants: 8900,
        rating: 4.7,
      ),
    ];
  }

  List<CoursePlanModel> _getMockPlans(String category) {
    return CoursePlanData.getMockPlans(category);
  }
}
