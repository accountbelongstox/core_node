import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/facility_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_public_api_service.dart';

class VipClubShootingController extends ChangeNotifier {
  final VipClubPublicApiService _publicApi;

  bool _isLoading = false;
  String? _errorMessage;
  List<VipClubShootingRangeModel> _shootingRanges = [];
  VipClubShootingRangeModel? _selectedRange;
  List<String> _availableSlots = [];

  VipClubShootingController(this._publicApi);

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<VipClubShootingRangeModel> get shootingRanges => _shootingRanges;
  VipClubShootingRangeModel? get selectedRange => _selectedRange;
  List<String> get availableSlots => _availableSlots;

  Future<void> loadShootingRanges() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final facilities = await _publicApi.getFacilities(type: 'shooting');
      _shootingRanges = facilities
          .where((f) => f is VipClubShootingRangeModel)
          .cast<VipClubShootingRangeModel>()
          .toList();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load shooting ranges: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadShootingRangeDetails(String id) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final facility = await _publicApi.getFacilityById(id);
      if (facility is VipClubShootingRangeModel) {
        _selectedRange = facility;
      }
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load range details: ${e.toString()}';
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
      _errorMessage = 'Failed to load available slots: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  void clearSelection() {
    _selectedRange = null;
    _availableSlots = [];
    notifyListeners();
  }
}
