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
// Connectivity functionality removed as WuyDataCenter was deleted
import 'package:qyflutter/common/network/network_framework.dart'
    hide AuthResult;
import 'package:qyflutter/common/network/core/endpoint_network_models.dart'
    as models;
import 'package:qyflutter/common/utils/validation/phone_checker.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../config_app_wuy/app_config_app_wuy.dart';
import '../config_app_wuy/api_config_app_wuy.dart';
import '../config_app_wuy/api_endpoints_app_wuy.dart' as legacy_endpoints;
import '../models_app_wuy/user_model_app_wuy.dart';
import '../models_app_wuy/friend_model_app_wuy.dart';
import '../models_app_wuy/chat_message_model_app_wuy.dart';
import '../models_app_wuy/location_model_app_wuy.dart';
import '../localization_app_wuy/localization_keys_app_wuy.dart';
import '../providers_app_wuy/wu_user_provider.dart';
import 'wuy_fake_data_generator.dart';
import 'wuy_auth_state_manager.dart';
import 'wuy_api_service_manager.dart';

/// Unified Wuy Service
/// Consolidates WuyApiCenter, WuyAuthService, and WuyService functionality
/// Provides comprehensive API access, authentication, and business logic
class WuyUnifiedService extends AdvancedNetworkService {
  static final WuyUnifiedService _instance = WuyUnifiedService._internal();
  factory WuyUnifiedService() => _instance;
  WuyUnifiedService._internal();

  UnifiedNetworkClient? _networkClient;
  WuUserProvider? _userProvider;
  final WuyAuthStateManager _authStateManager = WuyAuthStateManager.instance;

  // New API service manager
  WuyApiServiceManager? _apiServiceManager;
  bool _useNewApi = false; // Flag to switch between old and new API

  @override
  String get serviceName => AppConfigAppWuy.appId;

  @override
  ApiConfig get apiConfig => ApiConfigAppWuy.currentApiConfig;

  @override
  EndpointConfig get endpointConfig =>
      EndpointConfig(appName: AppConfigAppWuy.appId);

  /// Initialize the unified service
  @override
  Future<void> initialize() async {
    await super.initialize();

    // Initialize new API service manager if enabled
    if (AppConfigAppWuy.enableNewApiIntegration) {
      try {
        _apiServiceManager = WuyApiServiceManager();
        await _apiServiceManager!.initialize();
        _useNewApi = true;
        debugPrint('WuyUnifiedService: New API integration enabled');
      } catch (e) {
        debugPrint('WuyUnifiedService: Failed to initialize new API, falling back to legacy: $e');
        _useNewApi = false;
      }
    }

    // Storage will be initialized by runCommonApp
    // No need to initialize storage here to avoid binding issues

    debugPrint(
        'WuyUnifiedService initialized (storage handled by runCommonApp)');
  }

  /// Initialize with user provider
  void initializeWithUserProvider({WuUserProvider? userProvider}) {
    _userProvider = userProvider;
    // Auth state manager is initialized separately to avoid circular dependency
  }

  // Storage operations moved to WuyAuthStateManager to avoid duplication

  /// Initialize network client
  void _initializeNetworkClient() {
    _networkClient ??= UnifiedNetworkClient.create(
      config: apiConfig,
    );
  }

  /// Create authenticated request with user model binding (merged from WuyNetworkRequestBuilder)
  NetworkRequest createAuthenticatedRequest({
    required String endpoint,
    RequestMethod method = RequestMethod.get,
    Map<String, dynamic>? parameters,
    Map<String, String>? headers,
    dynamic body,
    RequestType requestType = RequestType.authenticated,
    RequestPriority priority = RequestPriority.normal,
    Duration? timeout,
    int? maxRetries,
    bool enableCache = false,
    Duration? cacheStaleTime,
    bool allowOffline = false,
    String? permission,
    Map<String, dynamic>? metadata,
  }) {
    // Merge headers with user authentication headers
    final mergedHeaders = <String, String>{
      ...headers ?? {},
    };

    // Add user authentication headers if user is available
    if (_authStateManager.isAuthenticated) {
      final userContext = _authStateManager.getUserContext();
      if (userContext != null) {
        mergedHeaders['X-User-ID'] = userContext['user_id']?.toString() ?? '';
        mergedHeaders['X-User-Name'] =
            userContext['user_name']?.toString() ?? '';
        mergedHeaders['X-User-Phone'] =
            userContext['user_phone']?.toString() ?? '';
        mergedHeaders['X-User-Verified'] =
            userContext['is_verified']?.toString() ?? 'false';
        mergedHeaders['X-User-Active'] =
            userContext['is_active']?.toString() ?? 'false';
        mergedHeaders['X-Auth-Timestamp'] =
            userContext['auth_timestamp']?.toString() ?? '';
      }
    }

    // Merge metadata with user information
    final mergedMetadata = <String, dynamic>{
      ...metadata ?? {},
    };

    if (_authStateManager.isAuthenticated) {
      final userContext = _authStateManager.getUserContext();
      if (userContext != null) {
        mergedMetadata['user_model'] = userContext;
      }
    }

    return NetworkRequest(
      endpoint: endpoint,
      method: method,
      parameters: parameters,
      headers: mergedHeaders,
      body: body,
      requestType: requestType,
      priority: priority,
      timeout: timeout,
      maxRetries: maxRetries,
      enableCache: enableCache,
      cacheStaleTime: cacheStaleTime,
      allowOffline: allowOffline,
      permission: permission,
      metadata: mergedMetadata,
    );
  }

  /// Create public request (merged from WuyNetworkRequestBuilder)
  NetworkRequest createPublicRequest({
    required String endpoint,
    RequestMethod method = RequestMethod.get,
    Map<String, dynamic>? parameters,
    Map<String, String>? headers,
    dynamic body,
    RequestType requestType = RequestType.public,
    RequestPriority priority = RequestPriority.normal,
    Duration? timeout,
    int? maxRetries,
    bool enableCache = false,
    Duration? cacheStaleTime,
    bool allowOffline = false,
    Map<String, dynamic>? metadata,
  }) {
    return NetworkRequest(
      endpoint: endpoint,
      method: method,
      parameters: parameters,
      headers: headers,
      body: body,
      requestType: requestType,
      priority: priority,
      timeout: timeout,
      maxRetries: maxRetries,
      enableCache: enableCache,
      cacheStaleTime: cacheStaleTime,
      allowOffline: allowOffline,
      metadata: metadata,
    );
  }

  /// Check if user is logged in - unified authentication state
  bool get isLoggedIn => _userProvider?.isAuthenticated ?? false;

  /// Get current user
  UserModelAppWuy? get currentUser => _authStateManager.currentUser;

  /// Check if user is authenticated across all systems
  @override
  bool get isAuthenticated => _authStateManager.isAuthenticated;

  /// Get initial route based on authentication status
  String getInitialRoute() {
    final route = _authStateManager.getInitialRoute();
    debugPrint(
        'WuyUnifiedService: ${LocalizationKeysAppWuy.wuyDebugGetInitialRoute.tr()} = $route');
    return route;
  }

  // ==================== AUTHENTICATION METHODS ====================

  /// Login with phone and verification code
  Future<AuthResult> loginWithPhone({
    required String phone,
    required String verificationCode,
  }) async {
    if (!PhoneChecker.isValidPhone(phone)) {
      return AuthResult.error('Invalid phone number format');
    }

    // Use new API if enabled and available
    if (_useNewApi && _apiServiceManager != null) {
      return _newApiLoginWithPhone(phone, verificationCode);
    }

    if (AppConfigAppWuy.enableMockApi) {
      return _mockLogin(phone, verificationCode);
    }

    return _realLogin(phone, verificationCode);
  }

  /// Register with phone and verification code
  Future<AuthResult> registerWithPhone({
    required String phone,
    required String verificationCode,
  }) async {
    if (!PhoneChecker.isValidPhone(phone)) {
      return AuthResult.error('Invalid phone number format');
    }

    if (AppConfigAppWuy.enableMockApi) {
      return _mockRegister(phone, verificationCode);
    }

    return _realRegister(phone, verificationCode);
  }

  /// Send verification code
  Future<AuthResult> sendVerificationCode(String phone) async {
    if (!PhoneChecker.isValidPhone(phone)) {
      return AuthResult.error('Invalid phone number format');
    }

    if (AppConfigAppWuy.enableMockApi) {
      return _mockSendVerificationCode(phone);
    }

    return _realSendVerificationCode(phone);
  }

  /// Logout user - delegates to AuthGuard for centralized logout logic
  Future<void> logout() async {
    await _authStateManager.clearAuthentication();
    _userProvider?.syncWithAuthStateManager();
  }

  // ==================== MOCK API METHODS ====================

  /// Mock login API call
  Future<AuthResult> _mockLogin(String phone, String verificationCode) async {
    await Future.delayed(const Duration(seconds: 1));

    // Generate user with phone-based data for consistency
    final user = WuyFakeDataGenerator.generateFakeUser(
      phone: phone,
      username: 'user_${phone.substring(phone.length - 4)}',
      nickname: WuyFakeDataGenerator.generateRandomName(),
      email: 'user_${phone.substring(phone.length - 4)}@anwuyou.test',
    );

    // Use auth state manager for consistent state management
    await _authStateManager.setAuthenticatedUser(user);

    // Sync user provider state immediately
    _userProvider?.syncWithAuthStateManager();

    // Ensure state is fully synchronized
    await Future.delayed(const Duration(milliseconds: 50));

    return AuthResult.success(user, 'Login successful');
  }

  /// Mock registration API call
  Future<AuthResult> _mockRegister(
      String phone, String verificationCode) async {
    await Future.delayed(const Duration(seconds: 1));

    // Generate user with phone-based data for consistency
    final user = WuyFakeDataGenerator.generateFakeUser(
      phone: phone,
      username: 'user_${phone.substring(phone.length - 4)}',
      nickname: WuyFakeDataGenerator.generateRandomName(),
      email: 'user_${phone.substring(phone.length - 4)}@anwuyou.test',
    );

    // Use auth state manager for consistent state management
    await _authStateManager.setAuthenticatedUser(user);

    // Sync user provider state immediately
    _userProvider?.syncWithAuthStateManager();

    // Ensure state is fully synchronized
    await Future.delayed(const Duration(milliseconds: 50));

    return AuthResult.success(user, 'Registration successful');
  }

  /// Mock send verification code API call
  Future<AuthResult> _mockSendVerificationCode(String phone) async {
    await Future.delayed(const Duration(milliseconds: 500));
    return AuthResult.success(null, 'Verification code sent successfully');
  }

  /// Mock logout API call
  Future<void> _mockLogout() async {
    await logout();
  }

  // ==================== REAL API METHODS ====================

  /// Real login API call
  Future<AuthResult> _realLogin(String phone, String verificationCode) async {
    _initializeNetworkClient();

    final request = createPublicRequest(
      endpoint: legacy_endpoints.ApiEndpointsAppWuy.authLogin,
      method: RequestMethod.post,
      body: {
        'phone': phone,
        'verification_code': verificationCode,
      },
    );

    final response =
        await _networkClient!.request<Map<String, dynamic>>(request);

    if (response.statusCode == 200 && response.data != null) {
      final userData = ApiConfigAppWuy.parseUserFromResponse(response.data!);
      if (userData != null) {
        final user = UserModelAppWuy.fromJson(userData);

        await _authStateManager.setAuthenticatedUser(user);
        _userProvider?.syncWithAuthStateManager();
        await Future.delayed(const Duration(milliseconds: 50));

        return AuthResult.success(user, 'Login successful');
      }
    }

    final errorMessage = response.error ?? 'Login failed';
    return AuthResult.error(errorMessage);
  }

  /// Real registration API call
  Future<AuthResult> _realRegister(
      String phone, String verificationCode) async {
    _initializeNetworkClient();

    final request = createPublicRequest(
      endpoint: legacy_endpoints.ApiEndpointsAppWuy.authRegister,
      method: RequestMethod.post,
      body: {
        'phone': phone,
        'verification_code': verificationCode,
      },
    );

    final response =
        await _networkClient!.request<Map<String, dynamic>>(request);

    if (response.statusCode == 200 && response.data != null) {
      final userData = ApiConfigAppWuy.parseUserFromResponse(response.data!);
      if (userData != null) {
        final user = UserModelAppWuy.fromJson(userData);

        await _authStateManager.setAuthenticatedUser(user);
        _userProvider?.syncWithAuthStateManager();
        await Future.delayed(const Duration(milliseconds: 50));

        return AuthResult.success(user, 'Registration successful');
      }
    }

    final errorMessage = response.error ?? 'Registration failed';
    return AuthResult.error(errorMessage);
  }

  /// Real send verification code API call
  Future<AuthResult> _realSendVerificationCode(String phone) async {
    _initializeNetworkClient();

    final request = createPublicRequest(
      endpoint: legacy_endpoints.ApiEndpointsAppWuy.authSendCode,
      method: RequestMethod.post,
      body: {
        'phone': phone,
      },
    );

    final response =
        await _networkClient!.request<Map<String, dynamic>>(request);

    if (response.statusCode == 200 && response.data != null) {
      final message =
          ApiConfigAppWuy.extractMessageFromResponse(response.data!) ??
              'Verification code sent';
      return AuthResult.success(null, message);
    }

    final errorMessage = response.error ?? 'Failed to send verification code';
    return AuthResult.error(errorMessage);
  }

  /// Real logout API call
  Future<void> _realLogout() async {
    try {
      _initializeNetworkClient();

      final request = createAuthenticatedRequest(
        endpoint: legacy_endpoints.ApiEndpointsAppWuy.authLogout,
        method: RequestMethod.post,
      );

      await _networkClient!.request<Map<String, dynamic>>(request);
    } catch (e) {
      debugPrint('${LocalizationKeysAppWuy.wuyDebugRealLogoutFailed.tr()}: $e');
    } finally {
      await logout();
    }
  }

  // ==================== NEW API METHODS ====================

  /// Login with phone using new API
  Future<AuthResult> _newApiLoginWithPhone(String phone, String verificationCode) async {
    try {
      final response = await _apiServiceManager!.auth.loginWithPhone(
        phone: phone,
        verificationCode: verificationCode,
      );

      if (response.success && response.data != null) {
        final authResponse = response.data!;

        // Update auth state manager
        await _authStateManager.setAuthenticatedUser(authResponse.user);

        // Sync user provider state immediately
        _userProvider?.syncWithAuthStateManager();
        await Future.delayed(const Duration(milliseconds: 50));

        return AuthResult.success(authResponse.user, 'Login successful');
      } else {
        return AuthResult.error(response.message ?? 'Login failed');
      }
    } catch (e) {
      return AuthResult.error('Login failed: ${e.toString()}');
    }
  }

  /// Register with phone using new API
  Future<AuthResult> _newApiRegisterWithPhone(String phone, String verificationCode) async {
    try {
      // For phone registration, we need to generate username and email
      final username = 'user_${phone.substring(phone.length - 4)}';
      final email = 'user_${phone.substring(phone.length - 4)}@anwuyou.test';
      final password = 'defaultPassword123'; // This should be provided by user

      final response = await _apiServiceManager!.auth.register(
        username: username,
        email: email,
        password: password,
        phone: phone,
      );

      if (response.success && response.data != null) {
        final authResponse = response.data!;

        // Update auth state manager
        await _authStateManager.setAuthenticatedUser(authResponse.user);

        // Sync user provider state immediately
        _userProvider?.syncWithAuthStateManager();
        await Future.delayed(const Duration(milliseconds: 50));

        return AuthResult.success(authResponse.user, 'Registration successful');
      } else {
        return AuthResult.error(response.message ?? 'Registration failed');
      }
    } catch (e) {
      return AuthResult.error('Registration failed: ${e.toString()}');
    }
  }

  /// Send verification code using new API
  Future<AuthResult> _newApiSendVerificationCode(String phone) async {
    try {
      final response = await _apiServiceManager!.auth.sendSmsCode(phone: phone);

      if (response.success) {
        return AuthResult.success(null, response.message ?? 'Verification code sent successfully');
      } else {
        return AuthResult.error(response.message ?? 'Failed to send verification code');
      }
    } catch (e) {
      return AuthResult.error('Failed to send verification code: ${e.toString()}');
    }
  }

  /// Login with username/password using new API
  Future<AuthResult> _newApiLoginWithPassword(String username, String password) async {
    try {
      final response = await _apiServiceManager!.auth.login(username: username, password: password);

      if (response.success && response.data != null) {
        final authResponse = response.data!;

        // Update auth state manager
        await _authStateManager.setAuthenticatedUser(authResponse.user);

        // Sync user provider state immediately
        _userProvider?.syncWithAuthStateManager();
        await Future.delayed(const Duration(milliseconds: 50));

        return AuthResult.success(authResponse.user, 'Login successful');
      } else {
        return AuthResult.error(response.message ?? 'Login failed');
      }
    } catch (e) {
      return AuthResult.error('Login failed: ${e.toString()}');
    }
  }

  /// Logout using new API
  Future<void> _newApiLogout() async {
    try {
      final user = _authStateManager.currentUser;
      if (user != null) {
        // We would need the access token, but it's not stored in the user model
        // This is a placeholder for future implementation
        await _apiServiceManager!.auth.logout(accessToken: 'placeholder_token');
      }
    } catch (e) {
      debugPrint('New API logout failed: $e');
    } finally {
      await logout();
    }
  }

  // ==================== USER API METHODS ====================

  /// Get user profile
  Future<models.NetworkResponse<UserModelAppWuy>> getUserProfile() async {
    return _getApiCall<UserModelAppWuy>(
      endpoint: 'user/profile',
      offlineDataProvider: () => WuyFakeDataGenerator.generateTestUser(),
      operationName: 'Get user profile',
    );
  }

  /// Update user profile
  Future<models.NetworkResponse<UserModelAppWuy>> updateUserProfile({
    required String nickname,
    String? avatar,
    String? phone,
  }) async {
    return _putApiCall<UserModelAppWuy>(
      endpoint: 'user/profile',
      data: {
        'nickname': nickname,
        'avatar': avatar,
        'phone': phone,
      },
      offlineDataProvider: () =>
          WuyFakeDataGenerator.generateTestUser().copyWith(
        nickname: nickname,
        avatar: avatar,
        phone: phone,
      ),
      operationName: 'Update user profile',
    );
  }

  // ==================== FRIEND API METHODS ====================

  /// Get friends list
  Future<models.NetworkResponse<List<FriendModelAppWuy>>> getFriends() async {
    return _getApiCall<List<FriendModelAppWuy>>(
      endpoint: 'friend/list',
      offlineDataProvider: () => WuyFakeDataGenerator.generateFakeFriends(),
      operationName: 'Get friends list',
    );
  }

  /// Add a friend
  Future<models.NetworkResponse<FriendModelAppWuy>> addFriend({
    required String username,
  }) async {
    return _postApiCall<FriendModelAppWuy>(
      endpoint: 'friend/add',
      data: {'username': username},
      offlineDataProvider: () =>
          WuyFakeDataGenerator.generateFakeFriends().first.copyWith(
                id: '3',
                username: username,
                displayName: username,
              ),
      operationName: 'Add friend',
    );
  }

  // ==================== CHAT API METHODS ====================

  /// Get chat history
  Future<models.NetworkResponse<List<ChatMessageModelAppWuy>>> getChatHistory({
    required String friendId,
  }) async {
    return _getApiCall<List<ChatMessageModelAppWuy>>(
      endpoint: 'chat/history/$friendId',
      offlineDataProvider: () {
        final fakeMessages = WuyFakeDataGenerator.generateFakeChatMessages();
        return fakeMessages.values.first;
      },
      operationName: 'Get chat history',
    );
  }

  /// Send message
  Future<models.NetworkResponse<ChatMessageModelAppWuy>> sendMessage({
    required String chatId,
    required String receiverId,
    required String content,
    String messageType = 'text',
  }) async {
    return _postApiCall<ChatMessageModelAppWuy>(
      endpoint: 'chat/send',
      data: {
        'chat_id': chatId,
        'receiver_id': receiverId,
        'content': content,
        'message_type': messageType,
      },
      offlineDataProvider: () {
        final fakeMessages = WuyFakeDataGenerator.generateFakeChatMessages();
        final firstMessage = fakeMessages.values.first.first;
        return firstMessage.copyWith(
          id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
          chatId: chatId,
          senderId: 'current_user',
          receiverId: receiverId,
          content: content,
          messageType: messageType,
          isRead: false,
          createdAt: DateTime.now(),
        );
      },
      operationName: 'Send message',
    );
  }

  // ==================== LOCATION API METHODS ====================

  /// Get user location
  Future<models.NetworkResponse<LocationModelAppWuy>> getUserLocation() async {
    return _getApiCall<LocationModelAppWuy>(
      endpoint: 'location/current',
      offlineDataProvider: () {
        final fakeLocation = WuyFakeDataGenerator.generateFakeCurrentLocation();
        return LocationModelAppWuy(
          id: 'loc1',
          userId: 'current_user',
          latitude: fakeLocation['latitude'] as double,
          longitude: fakeLocation['longitude'] as double,
          address: fakeLocation['address'] as String,
          timestamp: DateTime.now(),
        );
      },
      operationName: 'Get user location',
    );
  }

  /// Update user location
  Future<models.NetworkResponse<LocationModelAppWuy>> updateUserLocation({
    required double latitude,
    required double longitude,
    String? address,
  }) async {
    return _postApiCall<LocationModelAppWuy>(
      endpoint: 'location/update',
      data: {
        'latitude': latitude,
        'longitude': longitude,
        'address': address,
      },
      offlineDataProvider: () {
        final fakeLocation = WuyFakeDataGenerator.generateFakeCurrentLocation();
        return LocationModelAppWuy(
          id: 'loc1',
          userId: 'current_user',
          latitude: latitude,
          longitude: longitude,
          address: address ?? fakeLocation['address'] as String,
          timestamp: DateTime.now(),
        );
      },
      operationName: 'Update user location',
    );
  }

  // ==================== BUSINESS LOGIC METHODS ====================

  /// Validate content data before creation
  static bool validateContentData(Map<String, dynamic> contentData) {
    final title = contentData['title']?.toString() ?? '';
    if (title.trim().isEmpty) {
      return false;
    }

    if (title.length > 200) {
      return false;
    }

    final description = contentData['description']?.toString();
    if (description != null && description.length > 1000) {
      return false;
    }

    return true;
  }

  /// Validate user update data
  static bool validateUserUpdateData(Map<String, dynamic> userData) {
    final firstName =
        userData['firstName']?.toString() ?? userData['first_name']?.toString();
    if (firstName != null && firstName.length > 50) {
      return false;
    }

    final lastName =
        userData['lastName']?.toString() ?? userData['last_name']?.toString();
    if (lastName != null && lastName.length > 50) {
      return false;
    }

    final phoneNumber = userData['phoneNumber']?.toString() ??
        userData['phone_number']?.toString();
    if (phoneNumber != null) {
      final phoneRegex = RegExp(AppConfigAppWuy.regexPhone);
      if (!phoneRegex.hasMatch(phoneNumber)) {
        return false;
      }
    }

    return true;
  }

  /// Validate registration data
  static bool validateRegistrationData(Map<String, dynamic> regData) {
    final email = regData['email']?.toString() ?? '';
    final username = regData['username']?.toString() ?? '';
    final password = regData['password']?.toString() ?? '';

    // Validate email
    final emailRegex = RegExp(AppConfigAppWuy.regexEmail);
    if (!emailRegex.hasMatch(email)) {
      return false;
    }

    // Validate username
    if (username.length < AppConfigAppWuy.minUsernameLength ||
        username.length > AppConfigAppWuy.maxUsernameLength) {
      return false;
    }

    // Validate password
    if (password.length < AppConfigAppWuy.minPasswordLength) {
      return false;
    }

    // Check password strength
    final hasLetter = RegExp(r'[a-zA-Z]').hasMatch(password);
    final hasNumber = RegExp(r'[0-9]').hasMatch(password);

    if (!hasLetter || !hasNumber) {
      return false;
    }

    return true;
  }

  /// Format date for display
  static String formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays > 7) {
      return '${date.day}/${date.month}/${date.year}';
    } else if (difference.inDays > 0) {
      return '${difference.inDays} days ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours} hours ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes} minutes ago';
    } else {
      return 'Just now';
    }
  }

  /// Truncate text with ellipsis
  static String truncateText(String text, int maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return '${text.substring(0, maxLength)}...';
  }

  // ==================== GENERIC API WRAPPER METHODS ====================

  /// Generic API call wrapper that handles offline mode and error handling
  Future<models.NetworkResponse<T>> _apiCall<T>({
    required String operationName,
    required T Function() offlineDataProvider,
    required Future<models.NetworkResponse<T>> Function() onlineApiCall,
    String? offlineMessage,
  }) async {
    if (AppConfigAppWuy.enableMockApi) {
      debugPrint(
          'WuyUnifiedService: ${LocalizationKeysAppWuy.wuyDebugUsingFakeData.tr()} for $operationName');
      final data = offlineDataProvider();
      return Future.value(_createSuccessResponse(
        data: data,
        message: offlineMessage ?? '$operationName successful',
      ));
    }

    try {
      return await onlineApiCall();
    } catch (e) {
      return Future.value(_createErrorResponse(
        message: '$operationName failed: ${e.toString()}',
        statusCode: 500,
      ));
    }
  }

  /// Generic POST API call wrapper
  Future<models.NetworkResponse<T>> _postApiCall<T>({
    required String endpoint,
    required Map<String, dynamic> data,
    required T Function() offlineDataProvider,
    required String operationName,
    String? offlineMessage,
  }) async {
    return _apiCall<T>(
      operationName: operationName,
      offlineDataProvider: offlineDataProvider,
      onlineApiCall: () async {
        final response = await post<T>(endpoint, data: data);
        return models.NetworkResponse<T>(
          requestId: _generateRequestId(),
          statusCode: response.statusCode ?? 200,
          data: response.data,
          message: response.message,
          error: response.error != null
              ? models.NetworkError.server(
                  statusCode: response.statusCode ?? 500,
                  message: response.error!,
                )
              : null,
          headers: response.headers,
          isSuccess: response.isSuccess,
          isFromCache: response.isFromCache,
          timestamp: response.timestamp,
          duration: response.latency,
          metadata: response.metadata,
        );
      },
      offlineMessage: offlineMessage,
    );
  }

  /// Generic GET API call wrapper
  Future<models.NetworkResponse<T>> _getApiCall<T>({
    required String endpoint,
    required T Function() offlineDataProvider,
    required String operationName,
    String? offlineMessage,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _apiCall<T>(
      operationName: operationName,
      offlineDataProvider: offlineDataProvider,
      onlineApiCall: () async {
        final response =
            await get<T>(endpoint, queryParameters: queryParameters);
        return models.NetworkResponse<T>(
          requestId: _generateRequestId(),
          statusCode: response.statusCode ?? 200,
          data: response.data,
          message: response.message,
          error: response.error != null
              ? models.NetworkError.server(
                  statusCode: response.statusCode ?? 500,
                  message: response.error!,
                )
              : null,
          headers: response.headers,
          isSuccess: response.isSuccess,
          isFromCache: response.isFromCache,
          timestamp: response.timestamp,
          duration: response.latency,
          metadata: response.metadata,
        );
      },
      offlineMessage: offlineMessage,
    );
  }

  /// Generic PUT API call wrapper
  Future<models.NetworkResponse<T>> _putApiCall<T>({
    required String endpoint,
    required Map<String, dynamic> data,
    required T Function() offlineDataProvider,
    required String operationName,
    String? offlineMessage,
  }) async {
    return _apiCall<T>(
      operationName: operationName,
      offlineDataProvider: offlineDataProvider,
      onlineApiCall: () async {
        final response = await put<T>(endpoint, data: data);
        return models.NetworkResponse<T>(
          requestId: _generateRequestId(),
          statusCode: response.statusCode ?? 200,
          data: response.data,
          message: response.message,
          error: response.error != null
              ? models.NetworkError.server(
                  statusCode: response.statusCode ?? 500,
                  message: response.error!,
                )
              : null,
          headers: response.headers,
          isSuccess: response.isSuccess,
          isFromCache: response.isFromCache,
          timestamp: response.timestamp,
          duration: response.latency,
          metadata: response.metadata,
        );
      },
      offlineMessage: offlineMessage,
    );
  }

  /// Generate a request ID
  String _generateRequestId() {
    return '${DateTime.now().millisecondsSinceEpoch}_${UniqueKey().toString()}';
  }

  /// Create success response
  models.NetworkResponse<T> _createSuccessResponse<T>({
    required T data,
    String? message,
    int statusCode = 200,
  }) {
    return models.NetworkResponse<T>(
      requestId: _generateRequestId(),
      statusCode: statusCode,
      data: data,
      message: message,
      isSuccess: true,
      timestamp: DateTime.now(),
    );
  }

  /// Create error response
  models.NetworkResponse<T> _createErrorResponse<T>({
    required String message,
    int statusCode = 500,
    String? errorCode,
  }) {
    return models.NetworkResponse<T>(
      requestId: _generateRequestId(),
      statusCode: statusCode,
      message: message,
      errorCode: errorCode,
      isSuccess: false,
      timestamp: DateTime.now(),
    );
  }
}
