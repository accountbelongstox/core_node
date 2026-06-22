// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/foundation.dart';
import 'package:qyflutter/common/network/network_framework.dart';
import '../config_app_wuy/api_config_app_wuy.dart';
import '../models_app_wuy/auth_models_app_wuy.dart';
import '../models_app_wuy/user_model_app_wuy.dart';
import '../models_app_wuy/friend_model_app_wuy.dart';
import 'wuy_api_response.dart';
import 'wuy_auth_api_service.dart';
import 'wuy_user_api_service.dart';
import 'wuy_friends_api_service.dart';

/// API Service Manager for Wuy App
/// Centralized access to all API services
class WuyApiServiceManager {
  static final WuyApiServiceManager _instance = WuyApiServiceManager._internal();
  factory WuyApiServiceManager() => _instance;
  WuyApiServiceManager._internal();

  UnifiedNetworkClient? _networkClient;
  WuyAuthApiService? _authService;
  WuyUserApiService? _userService;
  WuyFriendsApiService? _friendsService;

  bool _isInitialized = false;

  /// Initialize the API service manager
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize network client
      _networkClient = UnifiedNetworkClient.create(
        config: ApiConfigAppWuy.currentApiConfig,
      );

      // Initialize services
      _authService = WuyAuthApiService(_networkClient!);
      _userService = WuyUserApiService(_networkClient!);
      _friendsService = WuyFriendsApiService(_networkClient!);

      _isInitialized = true;
      debugPrint('WuyApiServiceManager initialized successfully');
    } catch (e) {
      debugPrint('Failed to initialize WuyApiServiceManager: $e');
      rethrow;
    }
  }

  /// Check if the manager is initialized
  bool get isInitialized => _isInitialized;

  /// Get authentication service
  WuyAuthApiService get auth {
    _ensureInitialized();
    return _authService!;
  }

  /// Get user service
  WuyUserApiService get user {
    _ensureInitialized();
    return _userService!;
  }

  /// Get friends service
  WuyFriendsApiService get friends {
    _ensureInitialized();
    return _friendsService!;
  }

  /// Get network client
  UnifiedNetworkClient get network {
    _ensureInitialized();
    return _networkClient!;
  }

  // ==================== CONVENIENCE METHODS ====================

  /// Quick login method that combines login and token storage
  Future<WuyApiResponse<AuthResponse>> loginWithPassword({
    required String username,
    required String password,
    Function(AuthToken)? onTokenReceived,
  }) async {
    final response = await auth.login(username: username, password: password);

    if (response.success && response.data != null && onTokenReceived != null) {
      onTokenReceived(response.data!.token);
    }

    return response;
  }

  /// Quick phone login method
  Future<WuyApiResponse<AuthResponse>> loginWithPhone({
    required String phone,
    required String verificationCode,
    Function(AuthToken)? onTokenReceived,
  }) async {
    final response = await auth.loginWithPhone(
      phone: phone,
      verificationCode: verificationCode,
    );

    if (response.success && response.data != null && onTokenReceived != null) {
      onTokenReceived(response.data!.token);
    }

    return response;
  }

  /// Quick registration method
  Future<WuyApiResponse<AuthResponse>> register({
    required String username,
    required String email,
    required String password,
    String? phone,
    Function(AuthToken)? onTokenReceived,
  }) async {
    final response = await auth.register(
      username: username,
      email: email,
      password: password,
      phone: phone,
    );

    if (response.success && response.data != null && onTokenReceived != null) {
      onTokenReceived(response.data!.token);
    }

    return response;
  }

  /// Get current user profile with token
  Future<WuyApiResponse<UserModelAppWuy>> getCurrentUser({
    required String accessToken,
  }) async {
    return user.getUserProfile(accessToken: accessToken);
  }

  /// Update current user profile
  Future<WuyApiResponse<UserModelAppWuy>> updateCurrentUser({
    required String accessToken,
    String? username,
    String? email,
    String? bio,
    String? location,
    String? avatar,
  }) async {
    return user.updateUserProfile(
      accessToken: accessToken,
      username: username,
      email: email,
      bio: bio,
      location: location,
      avatar: avatar,
    );
  }

  /// Get friends list
  Future<WuyApiResponse<List<FriendModelAppWuy>>> getFriends({
    required String accessToken,
    int page = 1,
    int limit = 20,
  }) async {
    return friends.getFriendsList(
      accessToken: accessToken,
      page: page,
      limit: limit,
    );
  }

  /// Search for users to add as friends
  Future<WuyApiResponse<List<FriendModelAppWuy>>> searchUsers({
    required String accessToken,
    required String query,
    int page = 1,
    int limit = 20,
  }) async {
    return friends.searchFriends(
      accessToken: accessToken,
      query: query,
      page: page,
      limit: limit,
    );
  }

  /// Send friend request
  Future<WuyApiResponse<FriendRequestResponse>> addFriend({
    required String accessToken,
    required String userId,
  }) async {
    return friends.sendFriendRequest(
      accessToken: accessToken,
      userId: userId,
    );
  }

  /// Upload avatar
  Future<WuyApiResponse<String>> uploadAvatar({
    required String accessToken,
    required dynamic imageFile, // File or image source
  }) async {
    return user.uploadAvatar(
      accessToken: accessToken,
      imageFile: imageFile,
    );
  }

  /// Logout user
  Future<WuyApiResponse<void>> logout({
    required String accessToken,
    Function()? onLogoutComplete,
  }) async {
    final response = await auth.logout(accessToken: accessToken);

    if (onLogoutComplete != null) {
      onLogoutComplete();
    }

    return response;
  }

  // ==================== TOKEN MANAGEMENT ====================

  /// Check if token is valid and not expired
  bool isTokenValid(AuthToken token) {
    return !token.isExpired && token.accessToken.isNotEmpty;
  }

  /// Refresh token if needed (placeholder for future implementation)
  Future<WuyApiResponse<AuthToken>> refreshToken({
    required String refreshToken,
  }) async {
    // This would need to be implemented when the backend supports token refresh
    // For now, return an error
    return WuyApiResponse.error(
      message: 'Token refresh not implemented',
      errorCode: 'NOT_IMPLEMENTED',
    );
  }

  // ==================== API HEALTH CHECK ====================

  /// Check overall API health
  Future<Map<String, dynamic>> checkApiHealth() async {
    final results = <String, dynamic>{};

    try {
      // Check friend system health
      final friendsHealth = await friends.checkFriendSystemHealth();
      results['friends_system'] = {
        'status': friendsHealth.success ? 'healthy' : 'unhealthy',
        'message': friendsHealth.message,
        'timestamp': DateTime.now().toIso8601String(),
      };
    } catch (e) {
      results['friends_system'] = {
        'status': 'error',
        'message': e.toString(),
        'timestamp': DateTime.now().toIso8601String(),
      };
    }

    results['overall'] = {
      'status': _isInitialized ? 'initialized' : 'not_initialized',
      'timestamp': DateTime.now().toIso8601String(),
    };

    return results;
  }

  // ==================== UTILITY METHODS ====================

  /// Ensure manager is initialized before use
  void _ensureInitialized() {
    if (!_isInitialized) {
      throw StateError('WuyApiServiceManager must be initialized before use. Call initialize() first.');
    }
  }

  /// Dispose resources
  void dispose() {
    _networkClient?.dispose();
    _networkClient = null;
    _authService = null;
    _userService = null;
    _friendsService = null;
    _isInitialized = false;
    debugPrint('WuyApiServiceManager disposed');
  }

  /// Reset and reinitialize the manager
  Future<void> reset() async {
    dispose();
    await initialize();
  }
}

/// API request wrapper for easier error handling
class ApiRequest<T> {
  final Future<WuyApiResponse<T>> Function() requestFunction;
  final String? errorMessage;
  final String? errorCode;

  ApiRequest({
    required this.requestFunction,
    this.errorMessage,
    this.errorCode,
  });

  /// Execute the request with error handling
  Future<WuyApiResponse<T>> execute() async {
    try {
      return await requestFunction();
    } catch (e) {
      return WuyApiResponse.error(
        message: errorMessage ?? 'Request failed: ${e.toString()}',
        errorCode: errorCode ?? 'REQUEST_ERROR',
      );
    }
  }
}

/// API configuration for different environments
class ApiEnvironment {
  static const String development = 'development';
  static const String staging = 'staging';
  static const String production = 'production';

  static String get currentEnvironment {
    // This could be configured based on build configuration
    return development;
  }

  static bool get isDevelopment => currentEnvironment == development;
  static bool get isStaging => currentEnvironment == staging;
  static bool get isProduction => currentEnvironment == production;
}

/// API error handler for centralized error management
class ApiErrorHandler {
  static WuyApiResponse<T> handleError<T>({
    required String message,
    String? errorCode,
    dynamic originalError,
  }) {
    debugPrint('API Error: $message');
    if (originalError != null) {
      debugPrint('Original error: $originalError');
    }

    return WuyApiResponse.error(
      message: message,
      errorCode: errorCode ?? 'UNKNOWN_ERROR',
    );
  }

  static String getUserFriendlyMessage(String? errorCode, String? errorMessage) {
    if (errorMessage != null && errorMessage.isNotEmpty) {
      return errorMessage;
    }

    switch (errorCode?.toLowerCase()) {
      case 'invalid_credentials':
        return 'Invalid username or password';
      case 'user_not_found':
        return 'User not found';
      case 'email_already_exists':
        return 'Email address is already registered';
      case 'phone_already_exists':
        return 'Phone number is already registered';
      case 'invalid_verification_code':
        return 'Invalid verification code';
      case 'code_expired':
        return 'Verification code has expired';
      case 'too_many_attempts':
        return 'Too many attempts. Please try again later';
      case 'service_unavailable':
        return 'Service is temporarily unavailable';
      case 'network_error':
        return 'Network connection error';
      default:
        return 'An error occurred. Please try again';
    }
  }
}
