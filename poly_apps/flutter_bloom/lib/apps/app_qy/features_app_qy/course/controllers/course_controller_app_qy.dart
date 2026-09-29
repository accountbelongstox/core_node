/// Course controller for QY App - manages course state
library;

import 'package:flutter/material.dart';
import '../domain/model/course_model.dart';
import '../domain/service/course_service.dart';

class CourseControllerAppQy extends ChangeNotifier {
  final CourseService _courseService;
  List<CourseModel> _courses;
  List<CoursePlanModel> _plans;
  String _selectedCategory;
  bool _isLoading;
  String? _errorMessage;

  CourseControllerAppQy({
    required CourseService courseService,
    String initialCategory = 'ielts',
  })  : _courseService = courseService,
        _courses = [],
        _plans = [],
        _selectedCategory = initialCategory,
        _isLoading = false;

  List<CourseModel> get courses => _courses;
  List<CoursePlanModel> get plans => _plans;
  List<CoursePlanModel> get coursePlans => _plans;
  String get selectedCategory => _selectedCategory;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  void setCategory(String category) {
    if (_selectedCategory != category) {
      _selectedCategory = category;
      notifyListeners();
      loadCourses();
    }
  }

  Future<void> loadCourses() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _courses = await _courseService.getCoursesByCategory(_selectedCategory);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadPlans() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _plans = await _courseService.getCoursePlans(_selectedCategory);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadCoursePlans() async {
    await loadPlans();
  }

  Future<void> enrollCourse(String courseId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _courseService.enrollCourse(courseId);

      // Update local state
      final index = _courses.indexWhere((c) => c.id == courseId);
      if (index != -1) {
        _courses[index] = _courses[index].copyWith(isEnrolled: true);
      }
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateProgress(String courseId, int lessonId) async {
    try {
      await _courseService.updateProgress(courseId, lessonId);
      await loadCourses();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    super.dispose();
  }
}
