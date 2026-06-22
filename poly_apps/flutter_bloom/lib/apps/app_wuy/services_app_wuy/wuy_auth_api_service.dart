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
import '../config_app_wuy/api_config_app_wuy.dart' hide ApiEndpointsAppWuy;
import '../models_app_wuy/user_model_app_wuy.dart';
import '../models_app_wuy/auth_models_app_wuy.dart';
import 'wuy_api_client.dart' as wuy_endpoints;
import 'wuy_api_response.dart';

/// Authentication API Service for Wuy App
/// Handles all authentication-related API calls
class WuyAuthApiService {
  final UnifiedNetworkClient _networkClient;

  WuyAuthApiService(this._networkClient);

  // ==================== REGISTRATION ====================

  /// Register a new user
  ///
  /// [username] - User's unique username
  /// [email] - User's email address
  /// [password] - User's password
  /// [phone] - Optional phone number
  ///
  /// Returns [AuthResponse] with user data and tokens on success
  Future<WuyApiResponse<AuthResponse>> register({
    required String username,
    required String email,
    required String password,
    String? phone,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.authRegister,
        method: RequestMethod.post,
        body: {
          'username': username,
          'email': email,
          'password': password,
          if (phone != null) 'phone': phone,
        },
        headers: {'Content-Type': 'application/json'},
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final authResponse = _parseAuthResponse(response.data!);
        return WuyApiResponse.success(
          data: authResponse,
          message: 'Registration successful',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Registration failed',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== LOGIN ====================

  /// Login with username/email and password
  ///
  /// [username] - Username or email address
  /// [password] - User's password
  ///
  /// Returns [AuthResponse] with user data and tokens on success
  Future<WuyApiResponse<AuthResponse>> login({
    required String username,
    required String password,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.authLogin,
        method: RequestMethod.post,
        body: {
          'username': username,
          'password': password,
        },
        headers: {'Content-Type': 'application/json'},
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final authResponse = _parseAuthResponse(response.data!);
        return WuyApiResponse.success(
          data: authResponse,
          message: 'Login successful',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Login failed',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  /// Login with phone number and verification code
  ///
  /// [phone] - User's phone number
  /// [verificationCode] - SMS verification code
  ///
  /// Returns [AuthResponse] with user data and tokens on success
  Future<WuyApiResponse<AuthResponse>> loginWithPhone({
    required String phone,
    required String verificationCode,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.authPhoneLogin,
        method: RequestMethod.post,
        body: {
          'phone': phone,
          'verification_code': verificationCode,
        },
        headers: {'Content-Type': 'application/json'},
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final authResponse = _parseAuthResponse(response.data!);
        return WuyApiResponse.success(
          data: authResponse,
          message: 'Phone login successful',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Phone login failed',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== SMS VERIFICATION ====================

  /// Send SMS verification code
  ///
  /// [phone] - Phone number to send code to
  /// [countryCode] - Country code (default: +86)
  ///
  /// Returns verification ID and timeout on success
  Future<WuyApiResponse<SmsVerificationResponse>> sendSmsCode({
    required String phone,
    String countryCode = '+86',
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.authSendSms,
        method: RequestMethod.post,
        body: {
          'phone': phone,
          'country_code': countryCode,
        },
        headers: {'Content-Type': 'application/json'},
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final data = response.data!;
        final smsResponse = SmsVerificationResponse(
          verificationId: data['verification_id']?.toString() ?? '',
          timeoutSeconds: data['timeout_seconds'] ?? 60,
        );
        return WuyApiResponse.success(
          data: smsResponse,
          message: 'SMS code sent successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to send SMS code',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== EMAIL VERIFICATION ====================

  /// Verify email address with verification code
  ///
  /// [email] - Email address to verify
  /// [verificationCode] - Email verification code
  Future<WuyApiResponse<void>> verifyEmail({
    required String email,
    required String verificationCode,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.authVerifyEmail,
        method: RequestMethod.post,
        body: {
          'email': email,
          'verification_code': verificationCode,
        },
        headers: {'Content-Type': 'application/json'},
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess) {
        return WuyApiResponse.success(
          message: 'Email verified successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Email verification failed',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== PASSWORD RESET ====================

  /// Request password reset
  ///
  /// [email] - Email address for password reset
  Future<WuyApiResponse<void>> forgotPassword({
    required String email,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.authForgotPassword,
        method: RequestMethod.post,
        body: {'email': email},
        headers: {'Content-Type': 'application/json'},
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess) {
        return WuyApiResponse.success(
          message: 'Password reset email sent',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to send password reset email',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  /// Reset password with reset token
  ///
  /// [token] - Password reset token
  /// [newPassword] - New password
  /// [confirmPassword] - Confirm new password
  Future<WuyApiResponse<void>> resetPassword({
    required String token,
    required String newPassword,
    required String confirmPassword,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.authResetPassword,
        method: RequestMethod.post,
        body: {
          'token': token,
          'new_password': newPassword,
          'confirm_password': confirmPassword,
        },
        headers: {'Content-Type': 'application/json'},
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess) {
        return WuyApiResponse.success(
          message: 'Password reset successful',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Password reset failed',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== LOGOUT ====================

  /// Logout user and revoke tokens
  ///
  /// [accessToken] - Current access token
  Future<WuyApiResponse<void>> logout({
    required String accessToken,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.authLogout,
        method: RequestMethod.post,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      // Always return success for logout, even if API call fails
      // User should be logged out locally regardless
      return WuyApiResponse.success(
        message: 'Logout successful',
      );
    } catch (e) {
      debugPrint('Logout API call failed: $e');
      // Still return success since local logout should proceed
      return WuyApiResponse.success(
        message: 'Logout successful',
      );
    }
  }

  // ==================== HELPER METHODS ====================

  /// Parse authentication response from API
  AuthResponse _parseAuthResponse(Map<String, dynamic> data) {
    final userData = ApiConfigAppWuy.parseUserFromResponse(data);
    final tokenData = data['token'] as Map<String, dynamic>? ?? data['data']['token'] as Map<String, dynamic>?;

    final user = UserModelAppWuy.fromJson(userData ?? {});
    final token = AuthToken(
      accessToken: tokenData?['access_token']?.toString() ?? '',
      refreshToken: tokenData?['refresh_token']?.toString(),
      tokenType: tokenData?['token_type']?.toString() ?? 'Bearer',
      expiresIn: tokenData?['expires_in'] as int? ?? 86400,
      expiresAt: DateTime.now().add(Duration(seconds: tokenData?['expires_in'] as int? ?? 86400)),
    );

    return AuthResponse(
      user: user,
      token: token,
    );
  }

  /// Extract error code from API response
  String? _extractErrorCode(Map<String, dynamic>? data) {
    if (data?['error'] is Map) {
      return (data!['error'] as Map)['code']?.toString();
    }
    return data?['error_code']?.toString();
  }
}
