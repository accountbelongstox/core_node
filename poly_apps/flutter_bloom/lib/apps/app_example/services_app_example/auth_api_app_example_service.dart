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
import '../../../common/controller/auth_controller.dart';
import '../../../common/network/api_client.dart';
import '../config_app_example/api_config_app_example.dart';
import '../config_app_example/api_endpoints_app_example.dart';
import '../config_app_example/api_data_models_app_example.dart';

/// Authenticated API service for app_example
/// Provides standardized API methods with authentication verification
class AuthApiAppExampleService {
  final BuildContext context;
  late final AuthObject _authObject;

  AuthApiAppExampleService({required this.context}) {
    _authObject = AuthController.createAuthObject(
      apiConfig: AppEnvironmentConfig.currentApiConfig,
      authEndpoints: ApiConfigAppExample.authEndpoints,
      userDataParser: ApiConfigAppExample.parseUserFromResponse,
      tokenExtractor: ApiConfigAppExample.extractTokenFromResponse,
      tokenTypeExtractor: ApiConfigAppExample.extractTokenTypeFromResponse,
      expirationExtractor: ApiConfigAppExample.extractExpirationFromResponse,
      messageExtractor: ApiConfigAppExample.extractMessageFromResponse,
      errorExtractor: ApiConfigAppExample.extractErrorFromResponse,
      context: context,
    );
  }


  /// Login with username and password using standardized data model
  Future<AuthResult> login({
    required String username,
    required String password,
    bool remember = false,
  }) async {
    final loginData = LoginRequestData(
      username: username,
      password: password,
      remember: remember,
    );

    return await _authObject.login(
      username: username,
      password: password,
      remember: remember,
      additionalData: loginData.toJson(),
    );
  }

  /// Register new user using standardized data model
  Future<AuthResult> register({
    required String email,
    required String password,
    required String username,
    String? firstName,
    String? lastName,
  }) async {
    final registerData = RegisterRequestData(
      email: email,
      password: password,
      username: username,
      firstName: firstName,
      lastName: lastName,
    );

    return await _authObject.register(
      email: email,
      password: password,
      username: username,
      additionalData: registerData.toJson(),
    );
  }

  /// Logout current user
  Future<AuthResult> logout() async {
    return await _authObject.logout();
  }

  /// Check if user is currently logged in
  bool isLoggedIn() {
    return _authObject.isLoggedIn();
  }

  /// Get login expiration time
  DateTime? getLoginExpiration() {
    return _authObject.tokenExpiration;
  }

  /// Check if login is expired
  bool isLoginExpired() {
    return _authObject.isLoginExpired();
  }

  /// Get current user information
  Map<String, dynamic>? getUserInfo() {
    return _authObject.getUserInfo();
  }

  /// Get current user information (legacy method name for compatibility)
  Map<String, dynamic>? getQyUserInfo() {
    return getUserInfo();
  }

  /// Get user token
  String? getUserToken() {
    return _authObject.currentToken;
  }

  /// Get username
  String? getUsername() {
    return _authObject.getUsername();
  }

  /// Get user email
  String? getUserEmail() {
    return _authObject.getUserEmail();
  }

  /// Get user display name
  String? getUserDisplayName() {
    return _authObject.getUserDisplayName();
  }


  /// POST request with authentication verification
  Future<Response> post(String endpoint, Map<String, dynamic> data) async {
    if (!isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (isLoginExpired()) {
      final refreshResult = await _authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await _authObject.authenticatedClient.post(endpoint, data);
  }

  /// GET request with authentication verification
  Future<Response> get(String endpoint, {Map<String, String>? queryParams}) async {
    if (!isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (isLoginExpired()) {
      final refreshResult = await _authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await _authObject.authenticatedClient.get(endpoint, queryParams: queryParams);
  }

  /// PUT request with authentication verification
  Future<Response> put(String endpoint, Map<String, dynamic> data) async {
    if (!isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (isLoginExpired()) {
      final refreshResult = await _authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await _authObject.authenticatedClient.put(endpoint, data);
  }

  /// DELETE request with authentication verification
  Future<Response> delete(String endpoint) async {
    if (!isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (isLoginExpired()) {
      final refreshResult = await _authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await _authObject.authenticatedClient.delete(endpoint);
  }


  /// Get user profile with typed response
  Future<UserData?> getUserProfile() async {
    final response = await get(ApiEndpointsAppExample.userProfile);

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final userData = body['user'] ?? body['data'];
      
      if (userData != null) {
        return UserData.fromJson(userData);
      }
    }

    return null;
  }

  /// Update user profile with typed request
  Future<bool> updateUserProfile(UpdateUserRequestData profileData) async {
    final response = await put(ApiEndpointsAppExample.userUpdate, profileData.toJson());
    return response.statusCode == 200;
  }

  /// Change password
  Future<AuthResult> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await post(
      ApiEndpointsAppExample.authChangePassword,
      {
        'current_password': currentPassword,
        'new_password': newPassword,
      },
    );

    if (response.statusCode == 200) {
      return AuthResult.success(message: 'Password changed successfully');
    } else {
      final errorMessage = response.body is Map<String, dynamic>
          ? (response.body as Map<String, dynamic>)['message']?.toString()
          : 'Failed to change password';
      
      return AuthResult.failure(
        error: errorMessage ?? 'Failed to change password',
        statusCode: response.statusCode,
      );
    }
  }


  /// Create unauthenticated response
  Response _createUnauthenticatedResponse() {
    return Response(
      body: {
        'error': 'User not authenticated or session expired',
        'code': 'UNAUTHENTICATED',
        'requires_login': true,
        'app_id': 'app_example',
      },
      bodyString: '{"error": "User not authenticated or session expired", "code": "UNAUTHENTICATED", "requires_login": true, "app_id": "app_example"}',
      statusCode: 401,
      headers: {'x-auth-status': 'UNAUTHENTICATED'},
      method: 'ERROR',
    );
  }

  /// Get authentication status
  Map<String, dynamic> getAuthStatus() {
    return _authObject.getAuthStatus();
  }

  /// Clear all caches
  void clearCache() {
    _authObject.clearCache();
  }

  /// Get cache statistics
  Map<String, dynamic> getCacheStats() {
    return _authObject.getCacheStats();
  }

  /// Dispose resources
  void dispose() {
    _authObject.dispose();
  }

  /// Get the auth object for sharing with other services
  AuthObject get authObject => _authObject;
}
