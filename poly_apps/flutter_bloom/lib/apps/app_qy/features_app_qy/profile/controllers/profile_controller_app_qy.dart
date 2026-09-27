library;

import 'package:flutter/foundation.dart';
import '../domain/model/profile_model.dart';
import '../domain/service/profile_service.dart';

class ProfileControllerAppQy extends ChangeNotifier {
  final ProfileService _profileService;
  UserProfileModel? _profile;
  List<CertificateModel> _certificates;
  List<AchievementModel> _achievements;
  Map<String, dynamic> _stats;
  bool _isLoading;
  String? _errorMessage;

  ProfileControllerAppQy({required ProfileService profileService})
      : _profileService = profileService,
        _certificates = [],
        _achievements = [],
        _stats = {},
        _isLoading = false;

  UserProfileModel? get profile => _profile;
  List<CertificateModel> get certificates => _certificates;
  List<AchievementModel> get achievements => _achievements;
  Map<String, dynamic> get stats => _stats;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  List<AchievementModel> get unlockedAchievements =>
      _achievements.where((a) => a.isUnlocked).toList();

  List<AchievementModel> get lockedAchievements =>
      _achievements.where((a) => !a.isUnlocked).toList();

  int get totalAchievements => _achievements.length;
  int get unlockedAchievementsCount => unlockedAchievements.length;

  Future<void> loadProfile() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _profile = await _profileService.getProfile();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateProfile(UserProfileModel newProfile) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final success = await _profileService.updateProfile(newProfile);
      if (success) {
        _profile = newProfile;
      } else {
        _errorMessage = 'Failed to update profile';
      }
      return success;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateAvatar(String avatarPath) async {
    try {
      final success = await _profileService.updateAvatar(avatarPath);
      if (success && _profile != null) {
        _profile = _profile!.copyWith(avatar: avatarPath);
        notifyListeners();
      }
      return success;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    }
  }

  Future<void> loadCertificates() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _certificates = await _profileService.getCertificates();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadAchievements() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _achievements = await _profileService.getAchievements();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadStats() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _stats = await _profileService.getStats();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadAllData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await Future.wait([
        loadProfile(),
        loadCertificates(),
        loadAchievements(),
        loadStats(),
      ]);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
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
