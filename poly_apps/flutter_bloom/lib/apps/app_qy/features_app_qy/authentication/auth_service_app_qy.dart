/// Authentication service for app_qy
/// Handles business logic for authentication flows
library;

import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../../../common/auth_v2/auth_v2.dart';

class AuthServiceAppQy {
  final AuthenticationManager _authManager;

  AuthServiceAppQy(this._authManager);

  /// Perform phone number authentication
  Future<AuthResult> authenticateWithPhone(
    String phoneNumber,
    String verificationCode,
  ) async {
    try {
      final phoneProvider = _authManager.availableProviders
          .firstWhere((p) => p == AuthProvider.phone) as IPhoneAuthProvider;

      // In a real implementation, you would have stored the verificationId
      // from the sendVerificationCode step and use it here
      // For now, we'll simulate the verification process

      // Create mock successful result for development
      if (kDebugMode) {
        final mockUser = AuthUser(
          id: 'phone_user_${DateTime.now().millisecondsSinceEpoch}',
          provider: AuthProvider.phone,
          phone: phoneNumber,
          displayName: '手机用户',
          createdAt: DateTime.now(),
          lastLoginAt: DateTime.now(),
        );

        final mockToken = AuthToken(
          accessToken: 'mock_phone_token_${DateTime.now().millisecondsSinceEpoch}',
          refreshToken: 'mock_refresh_token',
          tokenType: 'Bearer',
          expiresIn: 86400,
          expiresAt: DateTime.now().add(const Duration(hours: 24)),
        );

        return AuthResult.success(
          user: mockUser,
          token: mockToken,
          additionalData: {'loginMethod': 'phone'},
        );
      }

      // Production implementation would call:
      // final result = await phoneProvider.verifyCode(verificationId, verificationCode);
      // return result;

      throw UnimplementedError('Phone verification not implemented in production');

    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'Phone authentication failed: $e',
        errorCode: AuthError.unknownError,
      );
    }
  }

  /// Perform WeChat authentication
  Future<AuthResult> authenticateWithWeChat() async {
    try {
      return await _authManager.authenticate(AuthProvider.wechat);
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'WeChat authentication failed: $e',
        errorCode: AuthError.providerNotAvailable,
      );
    }
  }

  /// Send verification code to phone number
  Future<PhoneAuthResult> sendVerificationCode(String phoneNumber) async {
    try {
      final phoneProvider = _authManager.availableProviders
          .firstWhere((p) => p == AuthProvider.phone) as IPhoneAuthProvider;

      return await phoneProvider.sendVerificationCode(phoneNumber);
    } catch (e) {
      return PhoneAuthResult.failure(
        errorMessage: 'Failed to send verification code: $e',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }
  }

  /// Resend verification code to phone number
  Future<PhoneAuthResult> resendVerificationCode(String phoneNumber) async {
    try {
      final phoneProvider = _authManager.availableProviders
          .firstWhere((p) => p == AuthProvider.phone) as IPhoneAuthProvider;

      return await phoneProvider.resendCode(phoneNumber);
    } catch (e) {
      return PhoneAuthResult.failure(
        errorMessage: 'Failed to resend verification code: $e',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }
  }

  /// Validate phone number format
  bool validatePhoneNumber(String phoneNumber) {
    if (phoneNumber.isEmpty) return false;

    // Simple Chinese phone number validation
    return RegExp(r'^1[3-9]\d{9}$').hasMatch(phoneNumber);
  }

  /// Validate verification code format
  bool validateVerificationCode(String code) {
    if (code.isEmpty) return false;
    return code.length == 6 && RegExp(r'^\d{6}$').hasMatch(code);
  }

  /// Get current authentication state
  Stream<AuthResult?> get authStateStream => _authManager.authStateStream;

  /// Check if user is authenticated
  bool get isAuthenticated => _authManager.isAuthenticated;

  /// Get current user
  AuthUser? get currentUser => _authManager.currentUser;

  /// Sign out current user
  Future<void> signOut() async {
    await _authManager.signOut();
  }

  /// Refresh authentication token
  Future<bool> refreshToken() async {
    return await _authManager.refreshToken();
  }

  /// Validate current session
  Future<bool> validateSession() async {
    return await _authManager.validateSession();
  }
}