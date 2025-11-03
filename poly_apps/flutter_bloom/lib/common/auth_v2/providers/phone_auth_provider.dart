/// Phone authentication provider implementation
/// Supports SMS verification and phone number based authentication
library phone_auth_provider;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../auth_interface.dart';
import '../auth_models.dart';
import '../auth_config.dart';

/// Phone authentication provider
class PhoneAuthProvider extends IAuthProvider implements IPhoneAuthProvider {
  static const MethodChannel _channel = MethodChannel('flutter_bloom/auth_phone');

  PhoneAuthConfig? _config;
  bool _isInitialized = false;
  AuthUser? _currentUser;
  AuthToken? _currentToken;
  final StreamController<PhoneAuthState> _authStateController =
      StreamController<PhoneAuthState>.broadcast();
  Timer? _resendTimer;
  int _remainingTime = 0;

  @override
  AuthProvider get providerType => AuthProvider.phone;

  @override
  bool get isInitialized => _isInitialized;

  @override
  Future<bool> get isAvailable async {
    try {
      final result = await _channel.invokeMethod('isAvailable');
      return result as bool? ?? false;
    } catch (e) {
      return false;
    }
  }

  @override
  Future<void> initialize(AuthConfig config) async {
    if (config is! PhoneAuthConfig) {
      throw ArgumentError('PhoneAuthConfig required for Phone provider');
    }

    try {
      await _channel.invokeMethod('initialize', {
        'countryCode': config.countryCode,
        'autoVerification': config.autoVerification,
        'timeoutSeconds': config.timeoutSeconds,
        'retryIntervalSeconds': config.retryIntervalSeconds,
        'maxRetries': config.maxRetries,
      });

      _config = config;
      _isInitialized = true;
    } catch (e) {
      _isInitialized = false;
      rethrow;
    }
  }

  @override
  Stream<PhoneAuthState> get authStateStream => _authStateController.stream;

  @override
  Future<PhoneAuthResult> sendVerificationCode(
    String phoneNumber, {
    String? countryCode,
    Map<String, dynamic>? additionalParameters,
  }) async {
    if (!_isInitialized) {
      return PhoneAuthResult.failure(
        errorMessage: 'Phone provider not initialized',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }

    if (!await _validatePhoneNumber(phoneNumber, countryCode: countryCode)) {
      return PhoneAuthResult.failure(
        errorMessage: 'Invalid phone number',
        errorCode: PhoneAuthError.invalidPhoneNumber,
      );
    }

    try {
      final fullPhoneNumber = countryCode != null
          ? '$countryCode$phoneNumber'
          : phoneNumber;

      final result = await _channel.invokeMethod('sendVerificationCode', {
        'phoneNumber': fullPhoneNumber,
        'countryCode': countryCode,
        'timeoutSeconds': _config?.timeoutSeconds,
        'additionalParameters': additionalParameters,
      });

      if (result == null) {
        return PhoneAuthResult.failure(
          errorMessage: 'Failed to send verification code',
          errorCode: PhoneAuthError.serviceUnavailable,
        );
      }

      final resultData = result as Map<String, dynamic>;
      final success = resultData['success'] as bool? ?? false;

      if (!success) {
        return PhoneAuthResult.failure(
          errorMessage: resultData['errorMessage'] as String? ?? 'Unknown error',
          errorCode: _mapPhoneError(resultData['errorCode'] as String?),
          timeoutSeconds: resultData['timeoutSeconds'] as int?,
        );
      }

      final verificationId = resultData['verificationId'] as String?;
      final timeoutSeconds = resultData['timeoutSeconds'] as int?;

      // Start countdown timer
      _startResendTimer(timeoutSeconds ?? _config?.timeoutSeconds ?? 60);

      // Update auth state
      _authStateController.add(PhoneAuthState(
        phoneNumber: fullPhoneNumber,
        verificationId: verificationId,
        codeSent: true,
        remainingTime: timeoutSeconds,
      ));

      return PhoneAuthResult.success(
        verificationId: verificationId,
        timeoutSeconds: timeoutSeconds,
      );
    } catch (e) {
      return PhoneAuthResult.failure(
        errorMessage: 'Send verification code error: ${e.toString()}',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }
  }

  @override
  Future<PhoneAuthResult> verifyCode(
    String verificationId,
    String smsCode, {
    Map<String, dynamic>? additionalParameters,
  }) async {
    if (!_isInitialized) {
      return PhoneAuthResult.failure(
        errorMessage: 'Phone provider not initialized',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }

    if (verificationId.isEmpty || smsCode.isEmpty) {
      return PhoneAuthResult.failure(
        errorMessage: 'Invalid verification ID or SMS code',
        errorCode: PhoneAuthError.invalidVerificationCode,
      );
    }

    try {
      final result = await _channel.invokeMethod('verifyCode', {
        'verificationId': verificationId,
        'smsCode': smsCode,
        'additionalParameters': additionalParameters,
      });

      if (result == null) {
        return PhoneAuthResult.failure(
          errorMessage: 'Failed to verify code',
          errorCode: PhoneAuthError.serviceUnavailable,
        );
      }

      final resultData = result as Map<String, dynamic>;
      final success = resultData['success'] as bool? ?? false;

      if (!success) {
        final error = _mapPhoneError(resultData['errorCode'] as String?);

        // Update auth state with error
        _authStateController.add(PhoneAuthState(
          verificationFailed: true,
          errorMessage: resultData['errorMessage'] as String?,
        ));

        return PhoneAuthResult.failure(
          errorMessage: resultData['errorMessage'] as String? ?? 'Code verification failed',
          errorCode: error,
        );
      }

      // Create user and token from verification result
      final userId = resultData['userId'] as String?;
      final accessToken = resultData['accessToken'] as String?;
      final phoneNumber = resultData['phoneNumber'] as String?;

      if (userId == null || accessToken == null) {
        return PhoneAuthResult.failure(
          errorMessage: 'Invalid verification response',
          errorCode: PhoneAuthError.invalidResponse,
        );
      }

      final user = AuthUser(
        id: userId,
        provider: AuthProvider.phone,
        phone: phoneNumber,
        lastLoginAt: DateTime.now(),
      );

      final token = AuthToken(
        accessToken: accessToken,
        refreshToken: resultData['refreshToken'] as String?,
        tokenType: 'Bearer',
        expiresIn: resultData['expiresIn'] as int?,
        expiresAt: resultData['expiresIn'] != null
            ? DateTime.now().add(Duration(seconds: resultData['expiresIn'] as int))
            : null,
      );

      _currentUser = user;
      _currentToken = token;

      // Update auth state with success
      _authStateController.add(PhoneAuthState(
        phoneNumber: phoneNumber,
        verificationId: verificationId,
        codeVerified: true,
      ));

      return PhoneAuthResult.success();
    } catch (e) {
      return PhoneAuthResult.failure(
        errorMessage: 'Code verification error: ${e.toString()}',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }
  }

  @override
  Future<PhoneAuthResult> resendCode(
    String phoneNumber, {
    String? countryCode,
    Map<String, dynamic>? additionalParameters,
  }) async {
    if (!_isInitialized) {
      return PhoneAuthResult.failure(
        errorMessage: 'Phone provider not initialized',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }

    try {
      final fullPhoneNumber = countryCode != null
          ? '$countryCode$phoneNumber'
          : phoneNumber;

      final result = await _channel.invokeMethod('resendCode', {
        'phoneNumber': fullPhoneNumber,
        'countryCode': countryCode,
        'additionalParameters': additionalParameters,
      });

      if (result == null) {
        return PhoneAuthResult.failure(
          errorMessage: 'Failed to resend verification code',
          errorCode: PhoneAuthError.serviceUnavailable,
        );
      }

      final resultData = result as Map<String, dynamic>;
      final success = resultData['success'] as bool? ?? false;

      if (!success) {
        return PhoneAuthResult.failure(
          errorMessage: resultData['errorMessage'] as String? ?? 'Unknown error',
          errorCode: _mapPhoneError(resultData['errorCode'] as String?),
          timeoutSeconds: resultData['timeoutSeconds'] as int?,
        );
      }

      final verificationId = resultData['verificationId'] as String?;
      final timeoutSeconds = resultData['timeoutSeconds'] as int?;

      // Restart countdown timer
      _startResendTimer(timeoutSeconds ?? _config?.timeoutSeconds ?? 60);

      return PhoneAuthResult.success(
        verificationId: verificationId,
        timeoutSeconds: timeoutSeconds,
      );
    } catch (e) {
      return PhoneAuthResult.failure(
        errorMessage: 'Resend code error: ${e.toString()}',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }
  }

  @override
  Future<bool> validatePhoneNumber(String phoneNumber, {String? countryCode}) async {
    if (phoneNumber.isEmpty) {
      return false;
    }

    try {
      final result = await _channel.invokeMethod('validatePhoneNumber', {
        'phoneNumber': phoneNumber,
        'countryCode': countryCode,
      });

      return result as bool? ?? false;
    } catch (e) {
      return false;
    }
  }

  @override
  Future<AuthResult> authenticate({
    Map<String, dynamic>? additionalParameters,
  }) async {
    // Phone authentication requires a 2-step process: send code -> verify code
    // This method is not applicable for phone auth
    return AuthResult.failure(
      errorMessage: 'Phone authentication requires sendVerificationCode and verifyCode methods',
      errorCode: AuthError.invalidRequest,
    );
  }

  @override
  Future<void> signOut() async {
    try {
      await _channel.invokeMethod('signOut');
      _currentUser = null;
      _currentToken = null;
      _resetAuthState();
    } catch (e) {
      // Continue with cleanup even if sign out fails
      _currentUser = null;
      _currentToken = null;
      _resetAuthState();
    }
  }

  @override
  Future<AuthToken?> refreshToken(String? refreshToken) async {
    if (refreshToken == null || refreshToken.isEmpty) {
      return null;
    }

    try {
      final result = await _channel.invokeMethod('refreshToken', {
        'refreshToken': refreshToken,
      });

      if (result == null) {
        return null;
      }

      final resultData = result as Map<String, dynamic>;
      final success = resultData['success'] as bool? ?? false;

      if (!success) {
        return null;
      }

      final accessToken = resultData['accessToken'] as String?;
      final expiresIn = resultData['expiresIn'] as int?;

      if (accessToken == null) {
        return null;
      }

      return AuthToken(
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenType: 'Bearer',
        expiresIn: expiresIn,
        expiresAt: expiresIn != null
            ? DateTime.now().add(Duration(seconds: expiresIn))
            : null,
      );
    } catch (e) {
      return null;
    }
  }

  @override
  Future<AuthUser?> getCurrentUser() async {
    if (_currentUser != null) {
      return _currentUser;
    }

    try {
      final result = await _channel.invokeMethod('getCurrentUser');
      if (result != null) {
        final userData = result as Map<String, dynamic>;
        _currentUser = AuthUser(
          id: userData['id'] as String? ?? '',
          provider: AuthProvider.phone,
          phone: userData['phoneNumber'] as String?,
          lastLoginAt: DateTime.now(),
        );
        return _currentUser;
      }
    } catch (e) {
      // Ignore error and return null
    }

    return null;
  }

  @override
  Future<bool> get isAuthenticated async {
    if (_currentToken != null && !_currentToken!.isExpired) {
      return true;
    }

    final user = await getCurrentUser();
    return user != null;
  }

  @override
  Future<Map<String, dynamic>?> getUserProfile() async {
    final user = await getCurrentUser();
    return user?.profile;
  }

  @override
  Future<bool> updateUserProfile(Map<String, dynamic> profile) async {
    // Phone auth doesn't typically support profile updates
    return false;
  }

  @override
  Future<AuthResult> linkAdditionalProvider(
    AuthProvider provider,
    AuthConfig config,
  ) async {
    // Phone auth doesn't support linking additional providers
    return AuthResult.failure(
      errorMessage: 'Phone authentication does not support linking additional providers',
      errorCode: AuthError.accountNotLinked,
    );
  }

  @override
  Future<bool> unlinkProvider(AuthProvider provider) async {
    // Phone auth doesn't support unlinking providers
    return false;
  }

  @override
  Future<List<AuthProvider>> getLinkedProviders() async {
    // Phone auth doesn't support linked providers
    return [];
  }

  @override
  void dispose() {
    _currentUser = null;
    _currentToken = null;
    _config = null;
    _isInitialized = false;
    _resetAuthState();
    _authStateController.close();
  }

  /// Start countdown timer for resend functionality
  void _startResendTimer(int seconds) {
    _remainingTime = seconds;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _remainingTime--;
      _authStateController.add(PhoneAuthState(
        remainingTime: _remainingTime,
        codeSent: true,
      ));

      if (_remainingTime <= 0) {
        timer.cancel();
      }
    });
  }

  /// Reset authentication state
  void _resetAuthState() {
    _resendTimer?.cancel();
    _remainingTime = 0;
    _authStateController.add(const PhoneAuthState());
  }

  /// Map phone error codes to PhoneAuthError
  PhoneAuthError _mapPhoneError(String? errorCode) {
    if (errorCode == null) return PhoneAuthError.unknownError;

    switch (errorCode.toLowerCase()) {
      case 'invalid_phone_number':
        return PhoneAuthError.invalidPhoneNumber;
      case 'invalid_country_code':
        return PhoneAuthError.invalidCountryCode;
      case 'invalid_verification_code':
        return PhoneAuthError.invalidVerificationCode;
      case 'code_expired':
        return PhoneAuthError.codeExpired;
      case 'too_many_attempts':
        return PhoneAuthError.tooManyAttempts;
      case 'network_error':
        return PhoneAuthError.networkError;
      case 'service_unavailable':
        return PhoneAuthError.serviceUnavailable;
      case 'quota_exceeded':
        return PhoneAuthError.quotaExceeded;
      case 'carrier_not_supported':
        return PhoneAuthError.carrierNotSupported;
      default:
        return PhoneAuthError.unknownError;
    }
  }
}