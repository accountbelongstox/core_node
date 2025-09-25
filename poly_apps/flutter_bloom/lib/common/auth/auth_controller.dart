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

// MOVED TO: lib/common/controller/settings_controller/auth_controller.dart
// This file is kept for backward compatibility

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../network/models/api_config.dart';
import '../network/authenticated_client.dart';
import '../network/public_client.dart';
import '../network/api_client.dart';
import '../provider_status/user_provider.dart';
// UserModel is now provided by each app, not in common

/// Universal authentication controller that works with different API configurations
/// This controller provides authentication methods that can be used across different apps
class AuthController extends ChangeNotifier {
  final BuildContext context;
  final ApiConfig apiConfig;
  late final AuthenticatedClient _authenticatedClient;
  late final PublicClient _publicClient;
  
  bool _isLoading = false;
  String? _lastError;

  AuthController({
    required this.context,
    required this.apiConfig,
  }) {
    _authenticatedClient = AuthenticatedClient(config: apiConfig, context: context);
    _publicClient = PublicClient(config: apiConfig);
  }

  /// Getters
  bool get isLoading => _isLoading;
  String? get lastError => _lastError;
  AuthenticatedClient get authenticatedClient => _authenticatedClient;
  PublicClient get publicClient => _publicClient;

  BaseUserProvider get _userProvider =>
      Provider.of<BaseUserProvider>(context, listen: false);

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

  /// Login with username and password
  Future<AuthResult> login({
    required String username,
    required String password,
    bool remember = false,
    String loginEndpoint = '/auth/login',
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

      final response = await _publicClient.post(loginEndpoint, loginData);

      if (_isSuccessResponse(response)) {
        final userData = _extractUserData(response);
        if (userData != null) {
          // Create user data map with token information
          final userDataWithToken = Map<String, dynamic>.from(userData);
          userDataWithToken['token'] = _extractToken(response);
          userDataWithToken['tokenType'] = _extractTokenType(response);
          userDataWithToken['expiration'] = _extractExpiration(response);

          _userProvider.setUser(userDataWithToken);
          
          return AuthResult.success(
            user: userDataWithToken,
            message: _extractMessage(response) ?? 'Login successful',
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
    String registerEndpoint = '/auth/register',
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

      final response = await _publicClient.post(registerEndpoint, registerData);

      if (_isSuccessResponse(response)) {
        final userData = _extractUserData(response);
        if (userData != null) {
          // Create user data map with token information
          final userDataWithToken = Map<String, dynamic>.from(userData);
          userDataWithToken['token'] = _extractToken(response);
          userDataWithToken['tokenType'] = _extractTokenType(response);
          
          _userProvider.setUser(userDataWithToken);
          
          return AuthResult.success(
            user: userDataWithToken,
            message: _extractMessage(response) ?? 'Registration successful',
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

  /// Logout user
  Future<AuthResult> logout({
    String logoutEndpoint = '/auth/logout',
  }) async {
    if (!_userProvider.isAuthenticated) {
      return AuthResult.success(message: 'Already logged out');
    }

    _setLoading(true);
    _setError(null);

    try {
      // Try to call logout endpoint
      final response = await _authenticatedClient.post(logoutEndpoint, {});
      
      // Clear user regardless of response (logout should always succeed locally)
      _userProvider.clearUser();
      _authenticatedClient.clearCache();
      
      return AuthResult.success(
        message: _extractMessage(response) ?? 'Logout successful',
      );
    } catch (e) {
      // Even if logout fails on server, clear local session
      _userProvider.clearUser();
      _authenticatedClient.clearCache();
      
      return AuthResult.success(
        message: 'Logout successful (local)',
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Refresh authentication token
  Future<AuthResult> refreshToken({
    String refreshEndpoint = '/auth/refresh',
  }) async {
    if (!_userProvider.isAuthenticated) {
      return AuthResult.failure(error: 'Not authenticated');
    }

    try {
      final response = await _authenticatedClient.post(refreshEndpoint, {});

      if (_isSuccessResponse(response)) {
        final token = _extractToken(response);
        if (token != null) {
          final currentUser = _userProvider.user;
          if (currentUser != null) {
            // Update user data with new token information
            final updatedUser = Map<String, dynamic>.from(currentUser);
            updatedUser['token'] = token;
            updatedUser['tokenType'] = _extractTokenType(response);
            updatedUser['expiration'] = _extractExpiration(response);
            _userProvider.setUser(updatedUser);
          }
        }
        
        return AuthResult.success(
          message: 'Token refreshed successfully',
        );
      } else {
        return AuthResult.failure(
          error: _extractErrorMessage(response) ?? 'Token refresh failed',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  /// Forgot password
  Future<AuthResult> forgotPassword({
    required String email,
    String forgotPasswordEndpoint = '/auth/forgot-password',
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      final response = await _publicClient.post(forgotPasswordEndpoint, {
        'email': email,
      });

      if (_isSuccessResponse(response)) {
        return AuthResult.success(
          message: _extractMessage(response) ?? 'Password reset email sent',
        );
      } else {
        return AuthResult.failure(
          error: _extractErrorMessage(response) ?? 'Failed to send reset email',
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

  /// Reset password
  Future<AuthResult> resetPassword({
    required String email,
    required String code,
    required String newPassword,
    String resetPasswordEndpoint = '/auth/reset-password',
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      final response = await _publicClient.post(resetPasswordEndpoint, {
        'email': email,
        'code': code,
        'password': newPassword,
      });

      if (_isSuccessResponse(response)) {
        return AuthResult.success(
          message: _extractMessage(response) ?? 'Password reset successful',
        );
      } else {
        return AuthResult.failure(
          error: _extractErrorMessage(response) ?? 'Password reset failed',
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

  /// Check if response indicates success
  bool _isSuccessResponse(Response response) {
    if (response.statusCode == null) return false;
    
    final body = response.body is Map<String, dynamic> 
        ? response.body as Map<String, dynamic>
        : null;
    
    return apiConfig.responseValidation.isSuccess(response.statusCode!, body);
  }

  /// Extract user data from response
  Map<String, dynamic>? _extractUserData(Response response) {
    if (response.body is! Map<String, dynamic>) return null;
    
    final body = response.body as Map<String, dynamic>;
    
    // Try common user data fields
    if (body.containsKey('user')) {
      return body['user'] as Map<String, dynamic>?;
    }
    if (body.containsKey('data')) {
      final data = body['data'];
      if (data is Map<String, dynamic> && data.containsKey('user')) {
        return data['user'] as Map<String, dynamic>?;
      }
    }
    
    return null;
  }

  /// Extract token from response
  String? _extractToken(Response response) {
    if (response.body is! Map<String, dynamic>) return null;
    
    final body = response.body as Map<String, dynamic>;
    
    // Try common token fields
    return body['token'] ?? body['access_token'] ?? body['auth_token'];
  }

  /// Extract token type from response
  String? _extractTokenType(Response response) {
    if (response.body is! Map<String, dynamic>) return null;
    
    final body = response.body as Map<String, dynamic>;
    
    return body['token_type'] ?? 'Bearer';
  }

  /// Extract expiration from response
  String? _extractExpiration(Response response) {
    if (response.body is! Map<String, dynamic>) return null;
    
    final body = response.body as Map<String, dynamic>;
    
    return body['expiration']?.toString() ?? body['expires_at']?.toString();
  }

  /// Extract message from response
  String? _extractMessage(Response response) {
    if (response.body is! Map<String, dynamic>) return null;
    
    final body = response.body as Map<String, dynamic>;
    
    return apiConfig.responseValidation.getErrorMessage(body) ?? 
           body['message']?.toString();
  }

  /// Extract error message from response
  String? _extractErrorMessage(Response response) {
    if (response.body is! Map<String, dynamic>) {
      return 'Request failed with status ${response.statusCode}';
    }
    
    final body = response.body as Map<String, dynamic>;
    
    return apiConfig.responseValidation.getErrorMessage(body) ?? 
           'Request failed with status ${response.statusCode}';
  }
}

/// Authentication result wrapper
class AuthResult {
  final bool isSuccess;
  final dynamic user;
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
    dynamic user,
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
