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

import 'package:flutter/material.dart';
import '../network/models/api_config.dart';
import '../network/authenticated_client.dart';
import '../network/public_client.dart';
import '../network/api_client.dart';
import '../utils/database/cache_operations.dart';

/// Universal authentication controller factory
/// Creates authentication objects that can be reused across different API services
class AuthController {
  /// Create an authentication object for a specific app configuration
  static AuthObject createAuthObject({
    required ApiConfig apiConfig,
    required Map<String, String> authEndpoints,
    required Map<String, dynamic> Function(Map<String, dynamic>) userDataParser,
    required String? Function(Map<String, dynamic>) tokenExtractor,
    required String? Function(Map<String, dynamic>) tokenTypeExtractor,
    required String? Function(Map<String, dynamic>) expirationExtractor,
    required String? Function(Map<String, dynamic>) messageExtractor,
    required String? Function(Map<String, dynamic>) errorExtractor,
    BuildContext? context,
  }) {
    return AuthObject._(
      apiConfig: apiConfig,
      authEndpoints: authEndpoints,
      userDataParser: userDataParser,
      tokenExtractor: tokenExtractor,
      tokenTypeExtractor: tokenTypeExtractor,
      expirationExtractor: expirationExtractor,
      messageExtractor: messageExtractor,
      errorExtractor: errorExtractor,
      context: context,
    );
  }
}

/// Authentication object that provides all authentication methods
/// Can be reused across different API services within the same app
class AuthObject extends ChangeNotifier {
  final ApiConfig apiConfig;
  final Map<String, String> authEndpoints;
  final Map<String, dynamic> Function(Map<String, dynamic>) userDataParser;
  final String? Function(Map<String, dynamic>) tokenExtractor;
  final String? Function(Map<String, dynamic>) tokenTypeExtractor;
  final String? Function(Map<String, dynamic>) expirationExtractor;
  final String? Function(Map<String, dynamic>) messageExtractor;
  final String? Function(Map<String, dynamic>) errorExtractor;
  final BuildContext? context;

  late final AuthenticatedClient _authenticatedClient;
  late final PublicClient _publicClient;

  bool _isLoading = false;
  String? _lastError;
  Map<String, dynamic>? _currentUser;
  String? _currentToken;
  String? _tokenType;
  DateTime? _tokenExpiration;

  AuthObject._({
    required this.apiConfig,
    required this.authEndpoints,
    required this.userDataParser,
    required this.tokenExtractor,
    required this.tokenTypeExtractor,
    required this.expirationExtractor,
    required this.messageExtractor,
    required this.errorExtractor,
    this.context,
  }) {
    _authenticatedClient = AuthenticatedClient(config: apiConfig, context: context);
    _publicClient = PublicClient(config: apiConfig);
    _loadPersistedData();
  }


  bool get isLoading => _isLoading;
  String? get lastError => _lastError;
  Map<String, dynamic>? get currentUser => _currentUser;
  String? get currentToken => _currentToken;
  String? get tokenType => _tokenType;
  DateTime? get tokenExpiration => _tokenExpiration;
  AuthenticatedClient get authenticatedClient => _authenticatedClient;
  PublicClient get publicClient => _publicClient;


  /// Check if user is currently logged in
  bool isLoggedIn() {
    return _currentUser != null && _currentToken != null;
  }

  /// Check if login is expired
  bool isLoginExpired() {
    if (_tokenExpiration == null) return false;
    return DateTime.now().isAfter(_tokenExpiration!);
  }

  /// Get user information
  Map<String, dynamic>? getUserInfo() {
    return _currentUser;
  }

  /// Get username from user info
  String? getUsername() {
    return _currentUser?['username'];
  }

  /// Get user email
  String? getUserEmail() {
    return _currentUser?['email'];
  }

  /// Get user display name
  String? getUserDisplayName() {
    final firstName = _currentUser?['firstName'];
    final lastName = _currentUser?['lastName'];
    final username = _currentUser?['username'];

    if (firstName != null && lastName != null) {
      return '$firstName $lastName'.trim();
    } else if (firstName != null) {
      return firstName;
    } else {
      return username;
    }
  }


  /// Set loading state
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  /// Set error state
  void _setError(String? error) {
    _lastError = error;
    notifyListeners();
  }

  /// Clear error
  void clearError() {
    _setError(null);
  }

  /// Load persisted authentication data
  void _loadPersistedData() {
    try {
      final userData = CacheOperations.get<Map<String, dynamic>>('user_data');
      final token = CacheOperations.get<String>('auth_token');
      final tokenType = CacheOperations.get<String>('token_type');
      final expiration = CacheOperations.get<String>('token_expiration');

      if (userData != null && token != null) {
        _currentUser = userData;
        _currentToken = token;
        _tokenType = tokenType;

        if (expiration != null) {
          try {
            _tokenExpiration = DateTime.parse(expiration);
          } catch (e) {
            _tokenExpiration = null;
          }
        }
      }
    } catch (e) {
      // Ignore errors during loading
    }
  }

  /// Set user data and persist it
  Future<void> _setUserData(
    Map<String, dynamic> userData,
    String token,
    String? tokenType,
    String? expiration,
  ) async {
    _currentUser = userData;
    _currentToken = token;
    _tokenType = tokenType ?? 'Bearer';

    if (expiration != null) {
      try {
        _tokenExpiration = DateTime.parse(expiration);
      } catch (e) {
        _tokenExpiration = null;
      }
    }

    // Persist data
    CacheOperations.set('user_data', userData);
    CacheOperations.set('auth_token', token);
    if (tokenType != null) CacheOperations.set('token_type', tokenType);
    if (expiration != null) CacheOperations.set('token_expiration', expiration);

    notifyListeners();
  }

  /// Clear user data
  Future<void> _clearUserData() async {
    _currentUser = null;
    _currentToken = null;
    _tokenType = null;
    _tokenExpiration = null;

    // Clear persisted data
    CacheOperations.remove('user_data');
    CacheOperations.remove('auth_token');
    CacheOperations.remove('token_type');
    CacheOperations.remove('token_expiration');

    // Clear network caches
    _authenticatedClient.clearCache();
    _publicClient.clearCache();

    notifyListeners();
  }


  /// Login with username and password
  Future<AuthResult> login({
    required String username,
    required String password,
    bool remember = false,
    Map<String, dynamic>? additionalData,
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      final loginData = {
        'username': username,
        'password': password,
        'remember': remember,
        ...?additionalData,
      };

      final endpoint = authEndpoints['login'] ?? '/auth/login';
      final response = await _publicClient.post(endpoint, loginData);

      if (_isSuccessResponse(response)) {
        final responseBody = response.body as Map<String, dynamic>;

        // Parse user data using app-specific parser
        final userData = userDataParser(responseBody);
        final token = tokenExtractor(responseBody);
        final tokenType = tokenTypeExtractor(responseBody);
        final expiration = expirationExtractor(responseBody);
        final message = messageExtractor(responseBody);

        if (userData.isNotEmpty && token != null) {
          await _setUserData(userData, token, tokenType, expiration);

          return AuthResult.success(
            user: userData,
            message: message ?? 'Login successful',
          );
        } else {
          return AuthResult.failure(
            error: 'Invalid user data received',
            statusCode: response.statusCode,
          );
        }
      } else {
        return AuthResult.failure(
          error: _extractErrorMessage(response) ?? 'Login failed',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      _setError(e.toString());
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Register new user
  Future<AuthResult> register({
    required String email,
    required String password,
    required String username,
    Map<String, dynamic>? additionalData,
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      final registerData = {
        'email': email,
        'password': password,
        'username': username,
        ...?additionalData,
      };

      final endpoint = authEndpoints['register'] ?? '/auth/register';
      final response = await _publicClient.post(endpoint, registerData);

      if (_isSuccessResponse(response)) {
        final responseBody = response.body as Map<String, dynamic>;

        // Parse user data using app-specific parser
        final userData = userDataParser(responseBody);
        final token = tokenExtractor(responseBody);
        final tokenType = tokenTypeExtractor(responseBody);
        final expiration = expirationExtractor(responseBody);
        final message = messageExtractor(responseBody);

        if (userData.isNotEmpty && token != null) {
          await _setUserData(userData, token, tokenType, expiration);

          return AuthResult.success(
            user: userData,
            message: message ?? 'Registration successful',
          );
        } else {
          return AuthResult.failure(
            error: 'Invalid user data received',
            statusCode: response.statusCode,
          );
        }
      } else {
        return AuthResult.failure(
          error: _extractErrorMessage(response) ?? 'Registration failed',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      _setError(e.toString());
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Logout current user
  Future<AuthResult> logout() async {
    if (!isLoggedIn()) {
      return AuthResult.success(message: 'Already logged out');
    }

    _setLoading(true);
    _setError(null);

    try {
      final endpoint = authEndpoints['logout'] ?? '/auth/logout';

      // Try to call logout endpoint
      await _authenticatedClient.post(endpoint, {});

      // Clear user data regardless of response
      await _clearUserData();

      return AuthResult.success(message: 'Logout successful');
    } catch (e) {
      // Even if logout fails on server, clear local session
      await _clearUserData();

      return AuthResult.success(message: 'Logout successful (local)');
    } finally {
      _setLoading(false);
    }
  }

  /// Refresh authentication token
  Future<AuthResult> refreshToken() async {
    if (!isLoggedIn()) {
      return AuthResult.failure(error: 'Not authenticated');
    }

    try {
      final endpoint = authEndpoints['refresh'] ?? '/auth/refresh';
      final response = await _authenticatedClient.post(endpoint, {});

      if (_isSuccessResponse(response)) {
        final responseBody = response.body as Map<String, dynamic>;
        final token = tokenExtractor(responseBody);
        final tokenType = tokenTypeExtractor(responseBody);
        final expiration = expirationExtractor(responseBody);

        if (token != null && _currentUser != null) {
          await _setUserData(_currentUser!, token, tokenType, expiration);

          return AuthResult.success(message: 'Token refreshed successfully');
        }
      }

      return AuthResult.failure(
        error: _extractErrorMessage(response) ?? 'Token refresh failed',
        statusCode: response.statusCode,
      );
    } catch (e) {
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    }
  }


  /// Get authentication status
  Map<String, dynamic> getAuthStatus() {
    return {
      'is_logged_in': isLoggedIn(),
      'is_expired': isLoginExpired(),
      'user_id': _currentUser?['id'],
      'username': getUsername(),
      'email': getUserEmail(),
      'display_name': getUserDisplayName(),
      'expiration': _tokenExpiration?.toIso8601String(),
      'token_available': _currentToken != null,
    };
  }

  /// Clear all caches
  void clearCache() {
    _authenticatedClient.clearCache();
    _publicClient.clearCache();
  }

  /// Get cache statistics
  Map<String, dynamic> getCacheStats() {
    return {
      'authenticated_cache': _authenticatedClient.getCacheStats(),
      'public_cache': _publicClient.getCacheStats(),
    };
  }

  /// Dispose resources
  void dispose() {
    clearCache();
    super.dispose();
  }

  /// Check if response indicates success
  bool _isSuccessResponse(Response response) {
    if (response.statusCode == null) return false;

    final body = response.body is Map<String, dynamic>
        ? response.body as Map<String, dynamic>
        : null;

    return apiConfig.responseValidation.isSuccess(response.statusCode!, body);
  }

  /// Extract error message from response
  String? _extractErrorMessage(Response response) {
    if (response.body is! Map<String, dynamic>) {
      return 'Request failed with status ${response.statusCode}';
    }

    final body = response.body as Map<String, dynamic>;

    return errorExtractor(body) ??
           'Request failed with status ${response.statusCode}';
  }
}

/// Authentication result wrapper
class AuthResult {
  final bool isSuccess;
  final Map<String, dynamic>? user;
  final String? message;
  final String? error;
  final int? statusCode;

  const AuthResult._({
    required this.isSuccess,
    this.user,
    this.message,
    this.error,
    this.statusCode,
  });

  factory AuthResult.success({
    Map<String, dynamic>? user,
    String? message,
  }) {
    return AuthResult._(
      isSuccess: true,
      user: user,
      message: message,
    );
  }

  factory AuthResult.failure({
    required String error,
    int? statusCode,
  }) {
    return AuthResult._(
      isSuccess: false,
      error: error,
      statusCode: statusCode,
    );
  }

  @override
  String toString() {
    if (isSuccess) {
      return 'AuthResult.success(message: $message)';
    } else {
      return 'AuthResult.failure(error: $error, statusCode: $statusCode)';
    }
  }
}
