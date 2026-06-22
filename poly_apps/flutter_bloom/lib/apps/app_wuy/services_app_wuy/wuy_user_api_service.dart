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

import 'package:qyflutter/common/network/network_framework.dart';
import '../config_app_wuy/api_config_app_wuy.dart' hide ApiEndpointsAppWuy;
import '../models_app_wuy/user_model_app_wuy.dart';
import 'wuy_api_client.dart' as wuy_endpoints;
import 'wuy_api_response.dart';

/// User Management API Service for Wuy App
/// Handles all user-related API calls
class WuyUserApiService {
  final UnifiedNetworkClient _networkClient;

  WuyUserApiService(this._networkClient);

  // ==================== USER PROFILE ====================

  /// Get user profile
  ///
  /// [accessToken] - User's access token
  ///
  /// Returns [UserModelAppWuy] with complete user data
  Future<WuyApiResponse<UserModelAppWuy>> getUserProfile({
    required String accessToken,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.userProfile,
        method: RequestMethod.get,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final userData = ApiConfigAppWuy.parseUserFromResponse(response.data!);
        if (userData != null) {
          final user = UserModelAppWuy.fromJson(userData);
          return WuyApiResponse.success(
            data: user,
            message: 'User profile retrieved successfully',
          );
        }
      }

      return WuyApiResponse.error(
        message: response.error ?? 'Failed to get user profile',
        errorCode: _extractErrorCode(response.data),
      );
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  /// Update user profile
  ///
  /// [accessToken] - User's access token
  /// [username] - Optional new username
  /// [email] - Optional new email
  /// [bio] - Optional new bio
  /// [location] - Optional new location
  /// [avatar] - Optional new avatar URL
  ///
  /// Returns updated [UserModelAppWuy]
  Future<WuyApiResponse<UserModelAppWuy>> updateUserProfile({
    required String accessToken,
    String? username,
    String? email,
    String? bio,
    String? location,
    String? avatar,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (username != null) body['username'] = username;
      if (email != null) body['email'] = email;
      if (bio != null) body['bio'] = bio;
      if (location != null) body['location'] = location;
      if (avatar != null) body['avatar'] = avatar;

      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.userProfileUpdate,
        method: RequestMethod.put,
        body: body,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final userData = ApiConfigAppWuy.parseUserFromResponse(response.data!);
        if (userData != null) {
          final user = UserModelAppWuy.fromJson(userData);
          return WuyApiResponse.success(
            data: user,
            message: 'Profile updated successfully',
          );
        }
      }

      return WuyApiResponse.error(
        message: response.error ?? 'Failed to update profile',
        errorCode: _extractErrorCode(response.data),
      );
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== AVATAR MANAGEMENT ====================

  /// Upload user avatar
  ///
  /// [accessToken] - User's access token
  /// [imageFile] - Image file to upload
  ///
  /// Returns avatar URL on success
  Future<WuyApiResponse<String>> uploadAvatar({
    required String accessToken,
    required dynamic imageFile,
    String? fileName,
  }) async {
    return WuyApiResponse.error(
      message: 'Avatar upload is not supported in this build',
      errorCode: 'NOT_IMPLEMENTED',
    );
  }

  // ==================== PASSWORD MANAGEMENT ====================

  /// Change user password
  ///
  /// [accessToken] - User's access token
  /// [currentPassword] - Current password
  /// [newPassword] - New password
  /// [confirmPassword] - Confirm new password
  Future<WuyApiResponse<void>> changePassword({
    required String accessToken,
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    try {
      if (newPassword != confirmPassword) {
        return WuyApiResponse.error(
          message: 'New passwords do not match',
          errorCode: 'PASSWORDS_MISMATCH',
        );
      }

      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.userChangePassword,
        method: RequestMethod.post,
        body: {
          'current_password': currentPassword,
          'new_password': newPassword,
          'confirm_password': confirmPassword,
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess) {
        return WuyApiResponse.success(
          message: 'Password changed successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to change password',
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

  // ==================== PHONE BINDING ====================

  /// Bind phone number to account
  ///
  /// [accessToken] - User's access token
  /// [phone] - Phone number to bind
  /// [verificationCode] - SMS verification code
  Future<WuyApiResponse<void>> bindPhone({
    required String accessToken,
    required String phone,
    required String verificationCode,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.userBindPhone,
        method: RequestMethod.post,
        body: {
          'phone': phone,
          'verification_code': verificationCode,
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess) {
        return WuyApiResponse.success(
          message: 'Phone number bound successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to bind phone number',
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

  /// Request phone binding verification code
  ///
  /// [accessToken] - User's access token
  /// [phone] - Phone number to bind
  /// [countryCode] - Country code (default: +86)
  ///
  /// Returns verification ID on success
  Future<WuyApiResponse<String>> requestPhoneBindingCode({
    required String accessToken,
    required String phone,
    String countryCode = '+86',
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: '${wuy_endpoints.ApiEndpointsAppWuy.userBindPhone}/request-code',
        method: RequestMethod.post,
        body: {
          'phone': phone,
          'country_code': countryCode,
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final verificationId = response.data!['verification_id']?.toString();
        if (verificationId != null) {
          return WuyApiResponse.success(
            data: verificationId,
            message: 'Verification code sent successfully',
          );
        }
      }

      return WuyApiResponse.error(
        message: response.error ?? 'Failed to send verification code',
        errorCode: _extractErrorCode(response.data),
      );
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== EMAIL BINDING ====================

  /// Bind email address to account
  ///
  /// [accessToken] - User's access token
  /// [email] - Email address to bind
  /// [verificationCode] - Email verification code
  Future<WuyApiResponse<void>> bindEmail({
    required String accessToken,
    required String email,
    required String verificationCode,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.userBindEmail,
        method: RequestMethod.post,
        body: {
          'email': email,
          'verification_code': verificationCode,
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess) {
        return WuyApiResponse.success(
          message: 'Email address bound successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to bind email address',
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

  /// Request email binding verification code
  ///
  /// [accessToken] - User's access token
  /// [email] - Email address to bind
  ///
  /// Returns verification ID on success
  Future<WuyApiResponse<String>> requestEmailBindingCode({
    required String accessToken,
    required String email,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: '${wuy_endpoints.ApiEndpointsAppWuy.userBindEmail}/request-code',
        method: RequestMethod.post,
        body: {'email': email},
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final verificationId = response.data!['verification_id']?.toString();
        if (verificationId != null) {
          return WuyApiResponse.success(
            data: verificationId,
            message: 'Verification code sent successfully',
          );
        }
      }

      return WuyApiResponse.error(
        message: response.error ?? 'Failed to send verification code',
        errorCode: _extractErrorCode(response.data),
      );
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== HELPER METHODS ====================

  /// Extract error code from API response
  String? _extractErrorCode(Map<String, dynamic>? data) {
    if (data?['error'] is Map) {
      return (data!['error'] as Map)['code']?.toString();
    }
    return data?['error_code']?.toString();
  }
}
