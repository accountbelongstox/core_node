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
import '../../../common/network/network_framework.dart';
import '../config_app_example/api_endpoints_app_example.dart';
import '../config_app_example/api_data_models_app_example.dart';

/// User management API service for app_example
/// Uses the new unified network framework
class UserApiAppExampleService extends AdvancedNetworkService {
  UserApiAppExampleService(BuildContext context) : super();

  @override
  String get serviceName => 'UserApiAppExampleService';

  @override
  ApiConfig get apiConfig => ApiConfig.jwtAuth(
    baseUrl: 'https://api.example.com',
    responseValidation: ResponseValidationConfig.defaultConfig(),
  );

  @override
  EndpointConfig get endpointConfig => EndpointConfig(appName: 'app_example');


  /// POST request with authentication verification
  Future<NetworkResponse<Map<String, dynamic>>> postRequest(String endpoint, Map<String, dynamic> data) async {
    return await request<Map<String, dynamic>>(
      endpoint,
      data: data,
    );
  }

  /// GET request with authentication verification
  Future<NetworkResponse<Map<String, dynamic>>> getRequest(String endpoint, {Map<String, String>? queryParams}) async {
    return await request<Map<String, dynamic>>(
      endpoint,
      queryParameters: queryParams,
    );
  }

  /// PUT request with authentication verification
  Future<NetworkResponse<Map<String, dynamic>>> putRequest(String endpoint, Map<String, dynamic> data) async {
    return await request<Map<String, dynamic>>(
      endpoint,
      data: data,
    );
  }

  /// DELETE request with authentication verification
  Future<NetworkResponse<Map<String, dynamic>>> deleteRequest(String endpoint) async {
    return await request<Map<String, dynamic>>(endpoint);
  }


  /// Get current user profile
  Future<UserData?> getUserProfile() async {
    final response = await getRequest(ApiEndpointsAppExample.userProfile);

    if (response.isSuccess && response.data != null) {
      final userData = response.data!['user'] ?? response.data!['data'];
      
      if (userData != null) {
        return UserData.fromJson(userData);
      }
    }

    return null;
  }

  /// Update user profile
  Future<bool> updateUserProfile(UpdateUserRequestData profileData) async {
    final response = await putRequest(
      ApiEndpointsAppExample.userUpdate,
      profileData.toJson(),
    );

    return response.isSuccess;
  }

  /// Update user avatar
  Future<bool> updateUserAvatar(String avatarUrl) async {
    final response = await putRequest(
      ApiEndpointsAppExample.userAvatar,
      {'avatar': avatarUrl},
    );

    return response.isSuccess;
  }

  /// Get user settings
  Future<Map<String, dynamic>?> getUserSettings() async {
    final response = await getRequest(ApiEndpointsAppExample.userSettings);

    if (response.isSuccess && response.data != null) {
      return response.data!['settings'] ?? response.data!['data'];
    }

    return null;
  }

  /// Update user settings
  Future<bool> updateUserSettings(Map<String, dynamic> settings) async {
    final response = await putRequest(
      ApiEndpointsAppExample.userSettings,
      {'settings': settings},
    );

    return response.isSuccess;
  }

  /// Get user preferences
  Future<Map<String, dynamic>?> getUserPreferences() async {
    final response = await getRequest(ApiEndpointsAppExample.userPreferences);

    if (response.isSuccess && response.data != null) {
      return response.data!['preferences'] ?? response.data!['data'];
    }

    return null;
  }

  /// Update user preferences
  Future<bool> updateUserPreferences(Map<String, dynamic> preferences) async {
    final response = await putRequest(
      ApiEndpointsAppExample.userPreferences,
      {'preferences': preferences},
    );

    return response.isSuccess;
  }


  /// Get user activity history
  Future<List<Map<String, dynamic>>> getUserActivity({
    int limit = 20,
    int offset = 0,
  }) async {
    final response = await getRequest(
      ApiEndpointsAppExample.userActivity,
      queryParams: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );

    if (response.isSuccess && response.data != null) {
      final activities = response.data!['activities'] ?? response.data!['data'];
      
      if (activities is List) {
        return activities.cast<Map<String, dynamic>>();
      }
    }

    return [];
  }

  /// Get user sessions
  Future<List<Map<String, dynamic>>> getUserSessions() async {
    final response = await getRequest(ApiEndpointsAppExample.userSessions);

    if (response.isSuccess && response.data != null) {
      final sessions = response.data!['sessions'] ?? response.data!['data'];
      
      if (sessions is List) {
        return sessions.cast<Map<String, dynamic>>();
      }
    }

    return [];
  }

  /// Terminate user session
  Future<bool> terminateSession(String sessionId) async {
    final response = await deleteRequest('/user/sessions/$sessionId');

    return response.isSuccess;
  }

  /// Check if user is authenticated
  @override
  bool get isAuthenticated => super.isAuthenticated;

  /// Get current user info
  Map<String, dynamic>? getCurrentUser() {
    return getQyUserInfo();
  }

  /// Get username
  String? getUsername() {
    return getUserToken();
  }

  /// Get user email
  String? getUserEmail() {
    final userInfo = getQyUserInfo();
    return userInfo?['email'];
  }

  /// Get user display name
  String? getUserDisplayName() {
    final userInfo = getQyUserInfo();
    return userInfo?['name'] ?? userInfo?['username'];
  }

  /// Get QY user info (placeholder implementation)
  Map<String, dynamic>? getQyUserInfo() {
    // This would be implemented to get user info from auth manager
    // For now, return null as placeholder
    return null;
  }

  /// Get user token (placeholder implementation)
  String? getUserToken() {
    // This would be implemented to get user token from auth manager
    // For now, return null as placeholder
    return null;
  }

  /// Get service status
  Map<String, dynamic> getServiceStatus() {
    return {
      'service_name': 'UserApiAppExampleService',
      'auth_status': isAuthenticated,
      'app_name': 'app_example',
    };
  }
}
