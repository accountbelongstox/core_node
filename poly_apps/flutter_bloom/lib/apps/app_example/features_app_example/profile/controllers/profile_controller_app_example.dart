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

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/apps/app_example/services_app_example/user_api_app_example_service.dart';
import 'package:qyflutter/apps/app_example/model_app_example/user_model.dart';

/// Profile Controller for App Example
/// Manages user profile data, settings integration, and API communication
///
/// Architecture Design:
/// 1. Integrates with SettingsController for system settings
/// 2. Uses AuthApiService for authentication-related operations
/// 3. Uses UserApiService for profile data operations
/// 4. Manages local profile state and persistence
class ProfileControllerAppExample extends GetxController {


  /// Settings controller for system settings integration
  late final SettingsController _settingsController;

  /// User API service for profile operations
  late final UserApiAppExampleService _userApiService;

  /// Image picker for profile photo selection
  final ImagePicker _imagePicker = ImagePicker();


  /// Current user profile data
  final Rx<UserModel?> _currentProfile = Rx<UserModel?>(null);
  UserModel? get currentProfile => _currentProfile.value;

  /// Profile loading state
  final RxBool _isLoading = false.obs;
  bool get isLoading => _isLoading.value;

  /// Profile saving state
  final RxBool _isSaving = false.obs;
  bool get isSaving => _isSaving.value;

  /// Profile photo file
  final Rx<File?> _profilePhotoFile = Rx<File?>(null);
  File? get profilePhotoFile => _profilePhotoFile.value;

  /// Form controllers for profile editing
  final TextEditingController nameController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController phoneController = TextEditingController();
  final TextEditingController bioController = TextEditingController();
  final TextEditingController locationController = TextEditingController();

  /// Form validation state
  final RxBool _isFormValid = false.obs;
  bool get isFormValid => _isFormValid.value;

  /// Error message
  final RxString _errorMessage = ''.obs;
  String get errorMessage => _errorMessage.value;


  @override
  void onInit() {
    super.onInit();
    _initializeDependencies();
    _initializeProfile();
    _setupFormValidation();
  }

  /// Initialize controller dependencies
  void _initializeDependencies() async {
    // Get settings controller instance (should be initialized in app bootstrap)
    try {
      _settingsController = Get.find<SettingsController>();
    } catch (e) {
      // If not found, create a temporary one for now
      debugPrint('SettingsController not found, using temporary instance: $e');
      // We'll handle this differently - use direct preferences
    }

    // Initialize user API service with context
    if (Get.context != null) {
      _userApiService = UserApiAppExampleService.withContext(Get.context!);
    }
  }

  /// Initialize profile data
  Future<void> _initializeProfile() async {
    await loadProfile();
  }

  /// Setup form validation listeners
  void _setupFormValidation() {
    // Listen to form field changes
    nameController.addListener(_validateForm);
    emailController.addListener(_validateForm);
    phoneController.addListener(_validateForm);
  }


  /// Load user profile from API
  Future<void> loadProfile() async {
    try {
      _isLoading.value = true;
      _errorMessage.value = '';

      // Check if user is authenticated
      // For now, assume user is authenticated - this should be checked via auth controller

      // Create a mock profile for now - this should come from API
      _currentProfile.value = UserModel(
        id: '1',
        name: 'User Name',
        email: 'user@example.com',
        phone: '',
        bio: '',
        avatar: null,
      );
      _populateFormControllers();

      // Optionally fetch additional profile data from user API
      await _fetchExtendedProfileData();

    } catch (e) {
      _errorMessage.value = 'Failed to load profile: ${e.toString()}';
    } finally {
      _isLoading.value = false;
    }
  }

  /// Fetch extended profile data from user API
  Future<void> _fetchExtendedProfileData() async {
    try {
      // TODO: Implement actual API call when user service is ready
      // For now, just use mock data
      debugPrint('Extended profile data fetch - not implemented yet');
    } catch (e) {
      // Extended data is optional, don't show error
      debugPrint('Failed to fetch extended profile data: $e');
    }
  }

  /// Save profile changes
  Future<bool> saveProfile() async {
    if (!_isFormValid.value) {
      _errorMessage.value = 'Please fill in all required fields correctly';
      return false;
    }

    try {
      _isSaving.value = true;
      _errorMessage.value = '';

      // Create updated profile data
      final updatedProfile = _createUpdatedProfile();

      // TODO: Save to API when user service is ready
      // For now, just update local state
      _currentProfile.value = updatedProfile;

      // Update auth controller user data if needed
      _updateAuthUserData(updatedProfile);

      // Show success message
      Get.snackbar(
        'Success',
        'Profile updated successfully',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.green,
        colorText: Colors.white,
      );

      return true;

    } catch (e) {
      _errorMessage.value = 'Failed to save profile: ${e.toString()}';
      return false;
    } finally {
      _isSaving.value = false;
    }
  }


  /// Pick profile photo from gallery
  Future<void> pickProfilePhotoFromGallery() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 80,
      );

      if (image != null) {
        _profilePhotoFile.value = File(image.path);
        await _uploadProfilePhoto();
      }
    } catch (e) {
      _errorMessage.value = 'Failed to pick image: ${e.toString()}';
    }
  }

  /// Take profile photo with camera
  Future<void> takeProfilePhoto() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 80,
      );

      if (image != null) {
        _profilePhotoFile.value = File(image.path);
        await _uploadProfilePhoto();
      }
    } catch (e) {
      _errorMessage.value = 'Failed to take photo: ${e.toString()}';
    }
  }

  /// Upload profile photo to server
  Future<void> _uploadProfilePhoto() async {
    if (_profilePhotoFile.value == null) return;

    try {
      _isSaving.value = true;

      // Create multipart request data
      final uploadData = {
        'file': _profilePhotoFile.value!,
        'type': 'profile_photo',
      };

      // TODO: Upload to API when user service is ready
      // For now, just use local file path
      final photoUrl = _profilePhotoFile.value!.path;
      _currentProfile.value = _currentProfile.value?.copyWith(avatar: photoUrl);

      Get.snackbar(
        'Success',
        'Profile photo updated successfully',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.green,
        colorText: Colors.white,
      );

    } catch (e) {
      _errorMessage.value = 'Failed to upload photo: ${e.toString()}';
    } finally {
      _isSaving.value = false;
    }
  }


  /// Get user preference from settings
  T? getUserPreference<T>(String key) {
    try {
      return _settingsController.getSetting<T>(key);
    } catch (e) {
      // Fallback values for common settings
      if (key == 'example_notifications_enabled') {
        return true as T?;
      } else if (key == 'example_privacy_level') {
        return 'public' as T?;
      }
      return null;
    }
  }

  /// Set user preference in settings
  Future<void> setUserPreference<T>(String key, T value) async {
    try {
      await _settingsController.setSetting<T>(key, value);
    } catch (e) {
      debugPrint('Failed to set preference $key: $e');
    }
  }

  /// Check if notifications are enabled
  bool get notificationsEnabled {
    return getUserPreference<bool>('example_notifications_enabled') ?? true;
  }

  /// Toggle notifications setting
  Future<void> toggleNotifications() async {
    await setUserPreference('example_notifications_enabled', !notificationsEnabled);
  }

  /// Get privacy level setting
  String get privacyLevel {
    return getUserPreference<String>('example_privacy_level') ?? 'public';
  }

  /// Set privacy level
  Future<void> setPrivacyLevel(String level) async {
    await setUserPreference('example_privacy_level', level);
  }


  /// Populate form controllers with current profile data
  void _populateFormControllers() {
    final profile = _currentProfile.value;
    if (profile != null) {
      nameController.text = profile.name;
      emailController.text = profile.email;
      phoneController.text = profile.phone ?? '';
      bioController.text = profile.bio ?? '';
    }
  }

  /// Create updated profile from form data
  UserModel _createUpdatedProfile() {
    return _currentProfile.value!.copyWith(
      name: nameController.text.trim(),
      email: emailController.text.trim(),
      phone: phoneController.text.trim(),
      bio: bioController.text.trim(),
      updatedAt: DateTime.now().toIso8601String(),
    );
  }

  /// Update auth controller user data
  void _updateAuthUserData(UserModel profile) {
    // Update basic user data in auth controller if needed
    // This ensures consistency between auth and profile data
    try {
      // Note: AuthController may not have updateProfile method
      // We'll just log the update for now
      debugPrint('Profile updated: ${profile.name}, ${profile.email}');
    } catch (e) {
      debugPrint('Failed to update auth user data: $e');
    }
  }

  /// Validate form fields
  void _validateForm() {
    final isValid = nameController.text.trim().isNotEmpty &&
                   emailController.text.trim().isNotEmpty &&
                   GetUtils.isEmail(emailController.text.trim());

    _isFormValid.value = isValid;
  }


  @override
  void onClose() {
    nameController.dispose();
    emailController.dispose();
    phoneController.dispose();
    bioController.dispose();
    locationController.dispose();
    super.onClose();
  }
}
