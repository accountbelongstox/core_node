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
import '../../../common/network/models/api_response.dart';
import '../config_app_example/api_config_app_example.dart';
import '../config_app_example/api_endpoints_app_example.dart';
import '../config_app_example/api_data_models_app_example.dart';

/// User management API service for app_example
/// Demonstrates how to reuse the same AuthObject across different API services
class UserApiAppExampleService {
  final AuthObject authObject;

  UserApiAppExampleService({required this.authObject});

  /// Factory constructor to create service with shared auth object
  factory UserApiAppExampleService.withSharedAuth(AuthObject authObject) {
    return UserApiAppExampleService(authObject: authObject);
  }

  /// Factory constructor to create service with new auth object
  factory UserApiAppExampleService.withContext(BuildContext context) {
    final authObject = AuthController.createAuthObject(
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
    
    return UserApiAppExampleService(authObject: authObject);
  }


  /// POST request with authentication verification
  Future<Response> post(String endpoint, Map<String, dynamic> data) async {
    if (!authObject.isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (authObject.isLoginExpired()) {
      final refreshResult = await authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await authObject.authenticatedClient.post(endpoint, data);
  }

  /// GET request with authentication verification
  Future<Response> get(String endpoint, {Map<String, String>? queryParams}) async {
    if (!authObject.isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (authObject.isLoginExpired()) {
      final refreshResult = await authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await authObject.authenticatedClient.get(endpoint, queryParams: queryParams);
  }

  /// PUT request with authentication verification
  Future<Response> put(String endpoint, Map<String, dynamic> data) async {
    if (!authObject.isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (authObject.isLoginExpired()) {
      final refreshResult = await authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await authObject.authenticatedClient.put(endpoint, data);
  }

  /// DELETE request with authentication verification
  Future<Response> delete(String endpoint) async {
    if (!authObject.isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (authObject.isLoginExpired()) {
      final refreshResult = await authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await authObject.authenticatedClient.delete(endpoint);
  }


  /// Get current user profile
  Future<UserData?> getUserProfile() async {
    if (!authObject.isLoggedIn()) {
      return null;
    }

    final response = await authObject.authenticatedClient.get(
      ApiEndpointsAppExample.userProfile,
    );

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final userData = body['user'] ?? body['data'];
      
      if (userData != null) {
        return UserData.fromJson(userData);
      }
    }

    return null;
  }

  /// Update user profile
  Future<bool> updateUserProfile(UpdateUserRequestData profileData) async {
    if (!authObject.isLoggedIn()) {
      return false;
    }

    final response = await authObject.authenticatedClient.put(
      ApiEndpointsAppExample.userUpdate,
      profileData.toJson(),
    );

    return response.statusCode == 200;
  }

  /// Update user avatar
  Future<bool> updateUserAvatar(String avatarUrl) async {
    if (!authObject.isLoggedIn()) {
      return false;
    }

    final response = await authObject.authenticatedClient.put(
      ApiEndpointsAppExample.userAvatar,
      {'avatar': avatarUrl},
    );

    return response.statusCode == 200;
  }

  /// Get user settings
  Future<Map<String, dynamic>?> getUserSettings() async {
    if (!authObject.isLoggedIn()) {
      return null;
    }

    final response = await authObject.authenticatedClient.get(
      ApiEndpointsAppExample.userSettings,
    );

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      return body['settings'] ?? body['data'];
    }

    return null;
  }

  /// Update user settings
  Future<bool> updateUserSettings(Map<String, dynamic> settings) async {
    if (!authObject.isLoggedIn()) {
      return false;
    }

    final response = await authObject.authenticatedClient.put(
      ApiEndpointsAppExample.userSettings,
      {'settings': settings},
    );

    return response.statusCode == 200;
  }

  /// Get user preferences
  Future<Map<String, dynamic>?> getUserPreferences() async {
    if (!authObject.isLoggedIn()) {
      return null;
    }

    final response = await authObject.authenticatedClient.get(
      ApiEndpointsAppExample.userPreferences,
    );

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      return body['preferences'] ?? body['data'];
    }

    return null;
  }

  /// Update user preferences
  Future<bool> updateUserPreferences(Map<String, dynamic> preferences) async {
    if (!authObject.isLoggedIn()) {
      return false;
    }

    final response = await authObject.authenticatedClient.put(
      ApiEndpointsAppExample.userPreferences,
      {'preferences': preferences},
    );

    return response.statusCode == 200;
  }


  /// Get user activity history
  Future<List<Map<String, dynamic>>> getUserActivity({
    int limit = 20,
    int offset = 0,
  }) async {
    if (!authObject.isLoggedIn()) {
      return [];
    }

    final response = await authObject.authenticatedClient.get(
      ApiEndpointsAppExample.userActivity,
      queryParams: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final activities = body['activities'] ?? body['data'];
      
      if (activities is List) {
        return activities.cast<Map<String, dynamic>>();
      }
    }

    return [];
  }

  /// Get user sessions
  Future<List<Map<String, dynamic>>> getUserSessions() async {
    if (!authObject.isLoggedIn()) {
      return [];
    }

    final response = await authObject.authenticatedClient.get(
      ApiEndpointsAppExample.userSessions,
    );

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final sessions = body['sessions'] ?? body['data'];
      
      if (sessions is List) {
        return sessions.cast<Map<String, dynamic>>();
      }
    }

    return [];
  }

  /// Terminate user session
  Future<bool> terminateSession(String sessionId) async {
    if (!authObject.isLoggedIn()) {
      return false;
    }

    final response = await authObject.authenticatedClient.delete(
      '/user/sessions/$sessionId',
    );

    return response.statusCode == 200;
  }


  /// Check if user is authenticated (delegate to auth object)
  bool isAuthenticated() {
    return authObject.isLoggedIn();
  }

  /// Get current user info (delegate to auth object)
  Map<String, dynamic>? getCurrentUser() {
    return authObject.getUserInfo();
  }

  /// Get username (delegate to auth object)
  String? getUsername() {
    return authObject.getUsername();
  }

  /// Get user email (delegate to auth object)
  String? getUserEmail() {
    return authObject.getUserEmail();
  }

  /// Get user display name (delegate to auth object)
  String? getUserDisplayName() {
    return authObject.getUserDisplayName();
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

  /// Get service status
  Map<String, dynamic> getServiceStatus() {
    return {
      'service_name': 'UserApiAppExampleService',
      'auth_status': authObject.getAuthStatus(),
      'cache_stats': authObject.getCacheStats(),
    };
  }

  /// Clear cache (delegate to auth object)
  void clearCache() {
    authObject.clearCache();
  }
}
