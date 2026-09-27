import 'package:flutter/material.dart';
import '../../../common/network/network_framework.dart';

/// Authenticated API service for app_example
/// Provides standardized API methods with authentication verification
class AuthApiAppExampleService extends AdvancedNetworkService {
  final BuildContext context;

  AuthApiAppExampleService({required this.context}) : super();

  @override
  String get serviceName => 'AuthApiAppExample';

  @override
  ApiConfig get apiConfig => ApiConfig(
    baseUrl: 'https://api.example.com',
    authenticationType: AuthenticationType.jwt,
    responseValidation: ResponseValidationConfig.defaultConfig(),
  );

  @override
  EndpointConfig get endpointConfig => EndpointConfig(appName: 'app_example');

  /// Login with username and password using new network framework
  Future<NetworkResponse<Map<String, dynamic>>> login({
    required String username,
    required String password,
    bool remember = false,
  }) async {
    try {
      final response = await request<Map<String, dynamic>>('login', data: {
        'username': username,
        'password': password,
        'remember': remember,
      });
      
      return response;
    } catch (e) {
      return NetworkResponse<Map<String, dynamic>>(
        data: null,
        message: 'Login failed: $e',
        statusCode: 500,
      );
    }
  }

  /// Register new user using new network framework
  Future<NetworkResponse<Map<String, dynamic>>> register({
    required String email,
    required String password,
    required String username,
    String? firstName,
    String? lastName,
  }) async {
    try {
      final response = await request<Map<String, dynamic>>('register', data: {
        'email': email,
        'password': password,
        'username': username,
        'first_name': firstName,
        'last_name': lastName,
      });
      
      return response;
    } catch (e) {
      return NetworkResponse<Map<String, dynamic>>(
        data: null,
        message: 'Registration failed: $e',
        statusCode: 500,
      );
    }
  }

  /// Logout current user
  Future<NetworkResponse<Map<String, dynamic>>> logout() async {
    try {
      final response = await request<Map<String, dynamic>>('logout', data: {});
      
      return response;
    } catch (e) {
      return NetworkResponse<Map<String, dynamic>>(
        data: null,
        message: 'Logout failed: $e',
        statusCode: 500,
      );
    }
  }

  /// Change password
  Future<NetworkResponse<Map<String, dynamic>>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final response = await request<Map<String, dynamic>>('change-password', data: {
        'current_password': currentPassword,
        'new_password': newPassword,
      });
      
      return response;
    } catch (e) {
      return NetworkResponse<Map<String, dynamic>>(
        data: null,
        message: 'Password change failed: $e',
        statusCode: 500,
      );
    }
  }

  /// Get user token
  String? getUserToken() {
    // This would be implemented to get the stored token
    // For now, return null as placeholder
    return null;
  }

  /// Check if user is authenticated
  @override
  bool get isAuthenticated {
    // This would be implemented to check authentication status
    // For now, return false as placeholder
    return false;
  }

  /// Check if user is logged in (alias for isAuthenticated)
  bool get isLoggedIn => isAuthenticated;

  /// Get user info from auth manager
  Map<String, dynamic>? getQyUserInfo() {
    // This would be implemented to get user info from auth manager
    // For now, return null as placeholder
    return null;
  }

  /// Get username
  String? getUsername() {
    // This would be implemented to get username from auth manager
    // For now, return null as placeholder
    return null;
  }

  /// Get user email
  String? getUserEmail() {
    // This would be implemented to get user email from auth manager
    // For now, return null as placeholder
    return null;
  }

  /// Get login expiration
  DateTime? getLoginExpiration() {
    // This would be implemented to get login expiration from auth manager
    // For now, return null as placeholder
    return null;
  }

  /// Check if login is expired
  bool isLoginExpired() {
    // This would be implemented to check if login is expired
    // For now, return false as placeholder
    return false;
  }

  /// Get service status
  Map<String, dynamic> getServiceStatus() {
    return {
      'service_name': 'AuthApiAppExampleService',
      'auth_status': isLoggedIn,
      'app_name': 'app_example',
    };
  }
}