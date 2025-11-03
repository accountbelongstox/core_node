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

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:qyflutter/common/network/network_framework.dart';
import '../config_app_wuy/api_config_app_wuy.dart';
import '../models_app_wuy/user_model_app_wuy.dart';
import 'wuy_api_client.dart';
import 'wuy_auth_api_service.dart';

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
  Future<ApiResponse<UserModelAppWuy>> getUserProfile({
    required String accessToken,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: ApiEndpointsAppWuy.userProfile,
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
          return ApiResponse.success(
            data: user,
            message: 'User profile retrieved successfully',
          );
        }
      }

      return ApiResponse.error(
        message: response.error ?? 'Failed to get user profile',
        errorCode: _extractErrorCode(response.data),
      );
    } catch (e) {
      return ApiResponse.error(
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
  Future<ApiResponse<UserModelAppWuy>> updateUserProfile({
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
        endpoint: ApiEndpointsAppWuy.userProfileUpdate,
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
          return ApiResponse.success(
            data: user,
            message: 'Profile updated successfully',
          );
        }
      }

      return ApiResponse.error(
        message: response.error ?? 'Failed to update profile',
        errorCode: _extractErrorCode(response.data),
      );
    } catch (e) {
      return ApiResponse.error(
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
  Future<ApiResponse<String>> uploadAvatar({
    required String accessToken,
    required File imageFile,
  }) async {
    try {
      // Validate file size and type
      final fileSize = await imageFile.length();
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      if (fileSize > maxFileSize) {
        return ApiResponse.error(
          message: 'Avatar file size must be less than 5MB',
          errorCode: 'FILE_TOO_LARGE',
        );
      }

      final fileName = imageFile.path.split('/').last;
      final allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
      final fileExtension = fileName.split('.').last.toLowerCase();
      if (!allowedTypes.contains(fileExtension)) {
        return ApiResponse.error(
          message: 'Avatar file must be JPG, PNG, or GIF',
          errorCode: 'INVALID_FILE_TYPE',
        );
      }

      // Create multipart request
      final request = NetworkRequest(
        endpoint: ApiEndpointsAppWuy.userAvatar,
        method: RequestMethod.post,
        body: {
          'avatar': await MultipartFile.fromPath(
            'avatar',
            imageFile.path,
            filename: fileName,
          ),
        },
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'multipart/form-data',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final data = response.data!;
        final avatarUrl = data['avatar_url']?.toString() ?? data['data']?['avatar_url']?.toString();
        if (avatarUrl != null) {
          return ApiResponse.success(
            data: avatarUrl,
            message: 'Avatar uploaded successfully',
          );
        }
      }

      return ApiResponse.error(
        message: response.error ?? 'Failed to upload avatar',
        errorCode: _extractErrorCode(response.data),
      );
    } catch (e) {
      return ApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== PASSWORD MANAGEMENT ====================

  /// Change user password
  ///
  /// [accessToken] - User's access token
  /// [currentPassword] - Current password
  /// [newPassword] - New password
  /// [confirmPassword] - Confirm new password
  Future<ApiResponse<void>> changePassword({
    required String accessToken,
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    try {
      if (newPassword != confirmPassword) {
        return ApiResponse.error(
          message: 'New passwords do not match',
          errorCode: 'PASSWORDS_MISMATCH',
        );
      }

      final request = NetworkRequest(
        endpoint: ApiEndpointsAppWuy.userChangePassword,
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
        return ApiResponse.success(
          message: 'Password changed successfully',
        );
      } else {
        return ApiResponse.error(
          message: response.error ?? 'Failed to change password',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return ApiResponse.error(
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
  Future<ApiResponse<void>> bindPhone({
    required String accessToken,
    required String phone,
    required String verificationCode,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: ApiEndpointsAppWuy.userBindPhone,
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
        return ApiResponse.success(
          message: 'Phone number bound successfully',
        );
      } else {
        return ApiResponse.error(
          message: response.error ?? 'Failed to bind phone number',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return ApiResponse.error(
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
  Future<ApiResponse<String>> requestPhoneBindingCode({
    required String accessToken,
    required String phone,
    String countryCode = '+86',
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: '${ApiEndpointsAppWuy.userBindPhone}/request-code',
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
          return ApiResponse.success(
            data: verificationId,
            message: 'Verification code sent successfully',
          );
        }
      }

      return ApiResponse.error(
        message: response.error ?? 'Failed to send verification code',
        errorCode: _extractErrorCode(response.data),
      );
    } catch (e) {
      return ApiResponse.error(
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
  Future<ApiResponse<void>> bindEmail({
    required String accessToken,
    required String email,
    required String verificationCode,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: ApiEndpointsAppWuy.userBindEmail,
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
        return ApiResponse.success(
          message: 'Email address bound successfully',
        );
      } else {
        return ApiResponse.error(
          message: response.error ?? 'Failed to bind email address',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return ApiResponse.error(
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
  Future<ApiResponse<String>> requestEmailBindingCode({
    required String accessToken,
    required String email,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: '${ApiEndpointsAppWuy.userBindEmail}/request-code',
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
          return ApiResponse.success(
            data: verificationId,
            message: 'Verification code sent successfully',
          );
        }
      }

      return ApiResponse.error(
        message: response.error ?? 'Failed to send verification code',
        errorCode: _extractErrorCode(response.data),
      );
    } catch (e) {
      return ApiResponse.error(
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