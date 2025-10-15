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

// CREATED BY: AI Assistant for controller architecture fix
// NOTE FOR OTHER AIs: This controller follows the new unified controller architecture
// Please use common services and storage, avoid complex secondary wrapping

import 'package:flutter/material.dart';
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:qyflutter/apps/app_example/model_app_example/user_model.dart';
import 'package:qyflutter/apps/app_example/config_app_example/storage_app_example.dart';
import 'package:qyflutter/apps/app_example/services_app_example/auth_api_app_example_service.dart';
import 'package:qyflutter/common/network/network_framework.dart';

/// Profile controller for Example app
/// Manages user profile data and operations
class ProfileControllerAppExample extends ChangeNotifier {
  final StorageAppExample _storage = StorageAppExample.instance;
  late final AuthApiAppExampleService _authService;

  UserModel? _user;
  bool _isLoading = false;
  bool _isSaving = false;
  String? _errorMessage;
  File? _profilePhotoFile;
  bool _notificationsEnabled = true;
  String _privacyLevel = 'Public';

  // Text controllers
  final TextEditingController nameController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController phoneController = TextEditingController();
  final TextEditingController bioController = TextEditingController();
  final TextEditingController locationController = TextEditingController();

  final ImagePicker _picker = ImagePicker();

  // Getters
  UserModel? get user => _user;
  UserModel? get currentProfile => _user;
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  String? get errorMessage => _errorMessage;
  bool get hasUser => _user != null;
  File? get profilePhotoFile => _profilePhotoFile;
  bool get notificationsEnabled => _notificationsEnabled;
  String get privacyLevel => _privacyLevel;

  bool get isFormValid {
    return nameController.text.trim().isNotEmpty &&
        emailController.text.trim().isNotEmpty &&
        _isValidEmail(emailController.text.trim());
  }

  ProfileControllerAppExample(BuildContext context) {
    _authService = AuthApiAppExampleService(context: context);
    _loadStoredUser();
  }

  /// Load user from storage
  Future<void> _loadStoredUser() async {
    try {
      final userData = await _storage.getUserData();
      if (userData != null) {
        _user = UserModel.fromJson(userData);
        _initializeControllers();
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = 'Failed to load user data: ${e.toString()}';
      notifyListeners();
    }
  }

  /// Refresh user profile from server
  Future<void> refreshProfile() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Mock implementation - replace with actual API call when available
      await Future.delayed(const Duration(seconds: 1));
      _errorMessage = null;
    } catch (e) {
      _errorMessage = 'Network error: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Update user profile
  Future<bool> updateProfile({
    String? name,
    String? email,
    String? phone,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Mock implementation - replace with actual API call when available
      await Future.delayed(const Duration(seconds: 1));

      // Update user model
      if (_user != null) {
        _user = _user!.copyWith(
          name: name ?? _user!.name,
          email: email ?? _user!.email,
          phone: phone ?? _user!.phone,
        );
        await _storage.setUserData(_user!.toJson());
      }

      _errorMessage = null;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Network error: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Change password
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
    required String passwordConfirmation,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _authService.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

      _errorMessage = result.isSuccess ? null : result.message;
      _isLoading = false;
      notifyListeners();

      return result.isSuccess;
    } catch (e) {
      _errorMessage = 'Network error: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Update user avatar
  Future<bool> updateAvatar(String avatarPath) async {
    if (_user == null) return false;

    try {
      // Update locally first
      _user = _user!.copyWith(avatar: avatarPath);
      await _storage.setUserData(_user!.toJson());
      notifyListeners();

      // TODO: Upload to server if needed
      return true;
    } catch (e) {
      _errorMessage = 'Failed to update avatar: ${e.toString()}';
      notifyListeners();
      return false;
    }
  }

  /// Get user preferences
  Future<Map<String, dynamic>> getUserPreferences() async {
    return await _storage.getUserPreferences();
  }

  /// Update user preferences
  Future<void> updateUserPreferences(Map<String, dynamic> preferences) async {
    await _storage.setUserPreferences(preferences);
    notifyListeners();
  }

  /// Get user bookmarks
  Future<List<String>> getUserBookmarks() async {
    final bookmarks = await _storage.getBookmarks();
    return bookmarks.cast<String>();
  }

  /// Add bookmark
  Future<void> addBookmark(String bookmark) async {
    await _storage.addBookmark(bookmark);
    notifyListeners();
  }

  /// Remove bookmark
  Future<void> removeBookmark(String bookmark) async {
    await _storage.removeBookmark(bookmark);
    notifyListeners();
  }

  /// Get reading history
  Future<List<Map<String, dynamic>>> getReadingHistory() async {
    final history = await _storage.getReadingHistory();
    return history.cast<Map<String, dynamic>>();
  }

  /// Add to reading history
  Future<void> addToReadingHistory(Map<String, dynamic> item) async {
    await _storage.addToReadingHistory(item);
    notifyListeners();
  }

  /// Clear reading history
  Future<void> clearReadingHistory() async {
    await _storage.clearReadingHistory();
    notifyListeners();
  }

  /// Logout user
  Future<bool> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      final result = await _authService.logout();
      _user = null;
      _errorMessage = null;
      _isLoading = false;
      notifyListeners();
      return result.isSuccess;
    } catch (e) {
      _errorMessage = 'Logout failed: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Clear error message
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Get profile completion percentage
  double get profileCompletionPercentage {
    if (_user == null) return 0.0;

    int completedFields = 0;
    int totalFields = 5; // name, email, phone, avatar, bio

    if (_user!.name.isNotEmpty) completedFields++;
    if (_user!.email.isNotEmpty) completedFields++;
    if (_user!.phone?.isNotEmpty == true) completedFields++;
    if (_user!.avatar?.isNotEmpty == true) completedFields++;
    if (_user!.bio?.isNotEmpty == true) completedFields++;

    return completedFields / totalFields;
  }

  /// Check if profile is complete
  bool get isProfileComplete => profileCompletionPercentage >= 0.8;

  /// Get display name
  String get displayName {
    if (_user == null) return 'Guest';
    return _user!.name.isNotEmpty ? _user!.name : 'User';
  }

  /// Get user initials for avatar
  String get userInitials {
    if (_user == null || _user!.name.isEmpty) return 'U';
    final names = _user!.name.split(' ');
    if (names.length >= 2) {
      return '${names[0][0]}${names[1][0]}'.toUpperCase();
    }
    return _user!.name[0].toUpperCase();
  }

  /// Toggle notifications setting
  void toggleNotifications() {
    _notificationsEnabled = !_notificationsEnabled;
    notifyListeners();
  }

  /// Set privacy level
  void setPrivacyLevel(String level) {
    _privacyLevel = level;
    notifyListeners();
  }

  /// Pick profile photo from gallery
  Future<void> pickProfilePhotoFromGallery() async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 80,
      );

      if (image != null) {
        _profilePhotoFile = File(image.path);
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = 'Failed to pick image from gallery';
      notifyListeners();
    }
  }

  /// Take profile photo with camera
  Future<void> takeProfilePhoto() async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 80,
      );

      if (image != null) {
        _profilePhotoFile = File(image.path);
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = 'Failed to take photo';
      notifyListeners();
    }
  }

  /// Save profile with current form data
  Future<bool> saveProfile() async {
    if (!isFormValid) return false;

    _isSaving = true;
    notifyListeners();

    try {
      // Mock save operation - replace with actual API call
      await Future.delayed(const Duration(seconds: 2));

      // Update user model with form data
      if (_user != null) {
        _user = _user!.copyWith(
          name: nameController.text.trim(),
          email: emailController.text.trim(),
          phone: phoneController.text.trim(),
          bio: bioController.text.trim(),
        );
      }

      _isSaving = false;
      _errorMessage = null;
      notifyListeners();
      return true;
    } catch (e) {
      _isSaving = false;
      _errorMessage = 'Failed to save profile';
      notifyListeners();
      return false;
    }
  }

  /// Validate email format
  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  /// Initialize form controllers with user data
  void _initializeControllers() {
    if (_user != null) {
      nameController.text = _user!.name;
      emailController.text = _user!.email;
      phoneController.text = _user!.phone ?? '';
      bioController.text = _user!.bio ?? '';
    }
  }

  @override
  void dispose() {
    nameController.dispose();
    emailController.dispose();
    phoneController.dispose();
    bioController.dispose();
    locationController.dispose();
    super.dispose();
  }
}
