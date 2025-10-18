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

import 'package:flutter/foundation.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/storage/unified_storage.dart';
import '../config_app_wuy/app_config_app_wuy.dart';
import '../models_app_wuy/user_model_app_wuy.dart';
import '../models_app_wuy/friend_model_app_wuy.dart';
import '../models_app_wuy/chat_message_model_app_wuy.dart';
import '../models_app_wuy/location_model_app_wuy.dart';
import '../localization_app_wuy/localization_keys_app_wuy.dart';
import 'wuy_fake_data_generator.dart';
import 'wuy_auth_state_manager.dart';
import 'wuy_unified_service.dart';
import '../providers_app_wuy/wu_user_provider.dart';

/// Unified Data Manager for Wuy App
/// Single source of truth for all user data and application state
/// Integrates fake data generation, authentication, and API services
class WuyDataManager {
  static WuyDataManager? _instance;
  static WuyDataManager get instance =>
      _instance ??= WuyDataManager._internal();

  WuyDataManager._internal();

  // Core services
  final WuyAuthStateManager _authStateManager = WuyAuthStateManager.instance;
  final WuyUnifiedService _unifiedService = WuyUnifiedService();
  WuUserProvider? _userProvider;

  // Data cache
  List<FriendModelAppWuy>? _friendsList;
  Map<String, List<ChatMessageModelAppWuy>>? _chatMessages;
  LocationModelAppWuy? _currentLocation;

  // Getters - use auth state manager as single source of truth
  UserModelAppWuy? get currentUser => _authStateManager.currentUser;
  List<FriendModelAppWuy>? get friendsList => _friendsList;
  Map<String, List<ChatMessageModelAppWuy>>? get chatMessages => _chatMessages;
  LocationModelAppWuy? get currentLocation => _currentLocation;
  bool get isAuthenticated => _authStateManager.isAuthenticated;

  /// Initialize the data manager
  Future<void> initialize({WuUserProvider? userProvider}) async {
    _userProvider = userProvider;

    // Initialize auth state manager
    await _authStateManager.initialize();

    // Initialize unified service
    await _unifiedService.initialize();
    _unifiedService.initializeWithUserProvider(userProvider: userProvider);

    // Load current user if authenticated
    if (_authStateManager.isAuthenticated) {
      await _loadUserData();
    }

    debugPrint(
        'WuyDataManager initialized - isAuthenticated: $isAuthenticated');
  }

  /// Get unified user data - single source of truth
  Future<UserModelAppWuy?> getUserData() async {
    // Use auth state manager as single source of truth
    return _authStateManager.currentUser;
  }

  /// Login with phone and verification code
  Future<AuthResult> loginWithPhone({
    required String phone,
    required String verificationCode,
  }) async {
    try {
      final result = await _unifiedService.loginWithPhone(
        phone: phone,
        verificationCode: verificationCode,
      );

      if (result.isSuccess && result.user != null) {
        // User is already set in auth state manager by unified service
        await _loadUserData();
        debugPrint(
            'WuyDataManager: User logged in successfully - ${result.user?.displayName}');
      }

      return result;
    } catch (e) {
      debugPrint(
          'WuyDataManager: ${LocalizationKeysAppWuy.wuyDebugLoginError.tr()} - $e');
      return AuthResult.error('Login failed: $e');
    }
  }

  /// Register with phone and verification code
  Future<AuthResult> registerWithPhone({
    required String phone,
    required String verificationCode,
  }) async {
    try {
      final result = await _unifiedService.registerWithPhone(
        phone: phone,
        verificationCode: verificationCode,
      );

      if (result.isSuccess && result.user != null) {
        // User is already set in auth state manager by unified service
        await _loadUserData();
        debugPrint(
            'WuyDataManager: User registered successfully - ${result.user?.displayName}');
      }

      return result;
    } catch (e) {
      debugPrint(
          'WuyDataManager: ${LocalizationKeysAppWuy.wuyDebugRegistrationError.tr()} - $e');
      return AuthResult.error('Registration failed: $e');
    }
  }

  /// Send verification code
  Future<AuthResult> sendVerificationCode(String phone) async {
    try {
      return await _unifiedService.sendVerificationCode(phone);
    } catch (e) {
      debugPrint(
          'WuyDataManager: ${LocalizationKeysAppWuy.wuyDebugVerificationCodeError.tr()} - $e');
      return AuthResult.error('Failed to send verification code: $e');
    }
  }

  /// Logout user
  Future<void> logout() async {
    try {
      await _unifiedService.logout();
      _clearUserData();
      debugPrint(
          'WuyDataManager: ${LocalizationKeysAppWuy.wuyDebugLogoutHandled.tr()}');
    } catch (e) {
      debugPrint(
          'WuyDataManager: ${LocalizationKeysAppWuy.wuyDebugLogoutError.tr()} - $e');
    }
  }

  /// Get friends list
  Future<List<FriendModelAppWuy>> getFriends() async {
    if (_friendsList != null) {
      return _friendsList!;
    }

    try {
      final storage = await UnifiedStorage.get('friends_list');
      if (storage != null && storage is List) {
        _friendsList = storage
            .map((json) => FriendModelAppWuy.fromJson(json as Map<String, dynamic>))
            .toList();
        debugPrint(
            'WuyDataManager: Loaded ${_friendsList!.length} friends from local storage');
      }
    } catch (e) {
      debugPrint('WuyDataManager: Load from storage error - $e');
    }

    try {
      if (AppConfigAppWuy.enableMockApi) {
        final fakeFriends = WuyFakeDataGenerator.generateFakeFriends();
        if (_friendsList == null || _friendsList!.isEmpty) {
          _friendsList = fakeFriends;
        }
        await UnifiedStorage.set('friends_list', _friendsList!.map((f) => f.toJson()).toList());
        debugPrint(
            'WuyDataManager: Loaded ${_friendsList!.length} friends from fake data');
        return _friendsList!;
      } else {
        final response = await _unifiedService.getFriends();
        if (response.isSuccess && response.data != null) {
          _friendsList = response.data!;
          await UnifiedStorage.set('friends_list', _friendsList!.map((f) => f.toJson()).toList());
          debugPrint(
              'WuyDataManager: Loaded ${_friendsList!.length} friends from API');
          return _friendsList!;
        }
      }
    } catch (e) {
      debugPrint('WuyDataManager: Get friends error - $e');
      if (_friendsList != null && _friendsList!.isNotEmpty) {
        debugPrint('WuyDataManager: Using cached friends list (${_friendsList!.length} friends)');
        return _friendsList!;
      }
    }

    if (_friendsList == null || _friendsList!.isEmpty) {
      _friendsList = WuyFakeDataGenerator.generateFakeFriends();
      await UnifiedStorage.set('friends_list', _friendsList!.map((f) => f.toJson()).toList());
    }
    return _friendsList!;
  }

  /// Get chat messages for a friend
  Future<List<ChatMessageModelAppWuy>> getChatMessages(String friendId) async {
    if (_chatMessages != null && _chatMessages!.containsKey(friendId)) {
      return _chatMessages![friendId]!;
    }

    try {
      if (AppConfigAppWuy.enableMockApi) {
        final allMessages = WuyFakeDataGenerator.generateFakeChatMessages();
        _chatMessages = allMessages;
        debugPrint('WuyDataManager: Loaded chat messages from fake data');
        return allMessages[friendId] ?? [];
      } else {
        final response =
            await _unifiedService.getChatHistory(friendId: friendId);
        if (response.isSuccess && response.data != null) {
          _chatMessages ??= {};
          _chatMessages![friendId] = response.data!;
          debugPrint('WuyDataManager: Loaded chat messages from API');
          return response.data!;
        }
      }
    } catch (e) {
      debugPrint('WuyDataManager: Get chat messages error - $e');
    }

    // Fallback to fake data
    final allMessages = WuyFakeDataGenerator.generateFakeChatMessages();
    _chatMessages = allMessages;
    return allMessages[friendId] ?? [];
  }

  /// Get current location
  Future<LocationModelAppWuy?> getCurrentLocation() async {
    if (_currentLocation != null) {
      return _currentLocation;
    }

    try {
      if (AppConfigAppWuy.enableMockApi) {
        final fakeLocation = WuyFakeDataGenerator.generateFakeCurrentLocation();
        _currentLocation = LocationModelAppWuy(
          id: 'loc1',
          userId:
              _authStateManager.currentUser?.id?.toString() ?? 'current_user',
          latitude: fakeLocation['latitude'] as double,
          longitude: fakeLocation['longitude'] as double,
          address: fakeLocation['address'] as String,
          timestamp: DateTime.now(),
        );
        debugPrint('WuyDataManager: Loaded location from fake data');
        return _currentLocation;
      } else {
        final response = await _unifiedService.getUserLocation();
        if (response.isSuccess && response.data != null) {
          _currentLocation = response.data!;
          debugPrint('WuyDataManager: Loaded location from API');
          return _currentLocation;
        }
      }
    } catch (e) {
      debugPrint('WuyDataManager: Get location error - $e');
    }

    return null;
  }

  /// Update user profile
  Future<UserModelAppWuy?> updateUserProfile({
    required String nickname,
    String? avatar,
    String? phone,
  }) async {
    try {
      final currentUser = _authStateManager.currentUser;
      if (currentUser == null) {
        debugPrint('WuyDataManager: Cannot update profile, no current user');
        return null;
      }

      if (AppConfigAppWuy.enableMockApi) {
        // Update local user data
        final updatedUser = currentUser.copyWith(
          nickname: nickname,
          avatar: avatar,
          phone: phone,
          updatedAt: DateTime.now(),
        );

        // Update auth state manager
        await _authStateManager.setAuthenticatedUser(updatedUser);

        // Sync user provider
        _userProvider?.syncWithAuthStateManager();

        debugPrint('WuyDataManager: Updated user profile');
        return updatedUser;
      } else {
        final response = await _unifiedService.updateUserProfile(
          nickname: nickname,
          avatar: avatar,
          phone: phone,
        );

        if (response.isSuccess && response.data != null) {
          await _authStateManager.setAuthenticatedUser(response.data!);
          _userProvider?.syncWithAuthStateManager();
          debugPrint('WuyDataManager: Updated user profile via API');
          return response.data;
        }
      }
    } catch (e) {
      debugPrint('WuyDataManager: Update profile error - $e');
    }

    return null;
  }

  /// Load user data after authentication
  Future<void> _loadUserData() async {
    final currentUser = _authStateManager.currentUser;
    if (currentUser == null) return;

    try {
      // Load friends list
      await getFriends();

      // Load current location
      await getCurrentLocation();

      debugPrint('WuyDataManager: User data loaded successfully');
    } catch (e) {
      debugPrint('WuyDataManager: Load user data error - $e');
    }
  }

  /// Clear user data
  void _clearUserData() {
    _friendsList = null;
    _chatMessages = null;
    _currentLocation = null;
    UnifiedStorage.remove('friends_list');
    debugPrint('WuyDataManager: User data cleared');
  }

  /// Get initial route based on authentication state
  String getInitialRoute() {
    return _authStateManager.getInitialRoute();
  }

  /// Check if mock API is enabled
  bool get isMockMode => AppConfigAppWuy.enableMockApi;

  /// Get app configuration
  Map<String, dynamic> getAppConfig() {
    return AppConfigAppWuy.appInfo;
  }

  /// Get feature flags
  Map<String, bool> getFeatureFlags() {
    return AppConfigAppWuy.getFeatureFlags();
  }
}
