import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/facility_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_public_api_service.dart';

class VipClubGolfController extends ChangeNotifier {
  final VipClubPublicApiService _publicApi;

  bool _isLoading = false;
  String? _errorMessage;
  List<VipClubGolfCourseModel> _golfCourses = [];
  VipClubGolfCourseModel? _selectedCourse;
  List<String> _availableSlots = [];

  VipClubGolfController(this._publicApi);

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<VipClubGolfCourseModel> get golfCourses => _golfCourses;
  VipClubGolfCourseModel? get selectedCourse => _selectedCourse;
  List<String> get availableSlots => _availableSlots;

  Future<void> loadGolfCourses() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final facilities = await _publicApi.getFacilities(type: 'golf');
      _golfCourses = facilities
          .where((f) => f is VipClubGolfCourseModel)
          .cast<VipClubGolfCourseModel>()
          .toList();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load golf courses: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadGolfCourseDetails(String id) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final facility = await _publicApi.getFacilityById(id);
      if (facility is VipClubGolfCourseModel) {
        _selectedCourse = facility;
      }
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load course details: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadAvailableSlots(String facilityId, DateTime date) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _availableSlots = await _publicApi.getAvailableSlots(
        facilityId: facilityId,
        date: date,
      );
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load available tee times: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  void clearSelection() {
    _selectedCourse = null;
    _availableSlots = [];
    notifyListeners();
  }
}
