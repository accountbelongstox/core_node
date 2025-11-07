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

import 'user_model_app_wuy.dart';

/// Authentication models for Wuy App
/// Contains all auth-related data models

/// Authentication response containing user and token data
class AuthResponse {
  final UserModelAppWuy user;
  final AuthToken token;

  AuthResponse({
    required this.user,
    required this.token,
  });

  /// Create AuthResponse from JSON
  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      user: UserModelAppWuy.fromJson(json['user'] ?? json['data']?['user'] ?? {}),
      token: AuthToken.fromJson(json['token'] ?? json['data']?['token'] ?? {}),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'user': user.toJson(),
      'token': token.toJson(),
    };
  }

  @override
  String toString() {
    return 'AuthResponse(user: ${user.username}, token: ${token.tokenType})';
  }
}

/// Authentication token information
class AuthToken {
  final String accessToken;
  final String? refreshToken;
  final String tokenType;
  final int expiresIn;
  final DateTime expiresAt;

  AuthToken({
    required this.accessToken,
    this.refreshToken,
    required this.tokenType,
    required this.expiresIn,
    required this.expiresAt,
  });

  /// Create AuthToken from JSON
  factory AuthToken.fromJson(Map<String, dynamic> json) {
    final expiresIn = json['expires_in'] as int? ?? 86400;
    return AuthToken(
      accessToken: json['access_token']?.toString() ?? json['accessToken']?.toString() ?? '',
      refreshToken: json['refresh_token']?.toString() ?? json['refreshToken']?.toString(),
      tokenType: json['token_type']?.toString() ?? json['tokenType']?.toString() ?? 'Bearer',
      expiresIn: expiresIn,
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'])
          : DateTime.now().add(Duration(seconds: expiresIn)),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'access_token': accessToken,
      'refresh_token': refreshToken,
      'token_type': tokenType,
      'expires_in': expiresIn,
      'expires_at': expiresAt.toIso8601String(),
    };
  }

  /// Check if token is expired
  bool get isExpired => DateTime.now().isAfter(expiresAt);

  /// Check if token is about to expire (within 5 minutes)
  bool get isAboutToExpired {
    final fiveMinutesFromNow = DateTime.now().add(const Duration(minutes: 5));
    return expiresAt.isBefore(fiveMinutesFromNow);
  }

  /// Get authorization header value
  String get authorizationHeader => '$tokenType $accessToken';

  @override
  String toString() {
    return 'AuthToken(type: $tokenType, expiresAt: $expiresAt)';
  }
}

/// SMS verification response
class SmsVerificationResponse {
  final String verificationId;
  final int timeoutSeconds;

  SmsVerificationResponse({
    required this.verificationId,
    required this.timeoutSeconds,
  });

  /// Create SmsVerificationResponse from JSON
  factory SmsVerificationResponse.fromJson(Map<String, dynamic> json) {
    return SmsVerificationResponse(
      verificationId: json['verification_id']?.toString() ?? '',
      timeoutSeconds: json['timeout_seconds'] as int? ?? 60,
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'verification_id': verificationId,
      'timeout_seconds': timeoutSeconds,
    };
  }

  @override
  String toString() {
    return 'SmsVerificationResponse(id: $verificationId, timeout: ${timeoutSeconds}s)';
  }
}

/// Password reset request response
class PasswordResetResponse {
  final String resetToken;
  final DateTime expiresAt;
  final int timeoutMinutes;

  PasswordResetResponse({
    required this.resetToken,
    required this.expiresAt,
    required this.timeoutMinutes,
  });

  /// Create PasswordResetResponse from JSON
  factory PasswordResetResponse.fromJson(Map<String, dynamic> json) {
    final timeoutMinutes = json['timeout_minutes'] as int? ?? 30;
    return PasswordResetResponse(
      resetToken: json['reset_token']?.toString() ?? json['token']?.toString() ?? '',
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'])
          : DateTime.now().add(Duration(minutes: timeoutMinutes)),
      timeoutMinutes: timeoutMinutes,
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'reset_token': resetToken,
      'expires_at': expiresAt.toIso8601String(),
      'timeout_minutes': timeoutMinutes,
    };
  }

  /// Check if reset token is expired
  bool get isExpired => DateTime.now().isAfter(expiresAt);

  @override
  String toString() {
    return 'PasswordResetResponse(token: ${resetToken.substring(0, 8)}..., expiresAt: $expiresAt)';
  }
}

/// Email verification response
class EmailVerificationResponse {
  final String verificationId;
  final DateTime expiresAt;
  final int timeoutMinutes;

  EmailVerificationResponse({
    required this.verificationId,
    required this.expiresAt,
    required this.timeoutMinutes,
  });

  /// Create EmailVerificationResponse from JSON
  factory EmailVerificationResponse.fromJson(Map<String, dynamic> json) {
    final timeoutMinutes = json['timeout_minutes'] as int? ?? 15;
    return EmailVerificationResponse(
      verificationId: json['verification_id']?.toString() ?? '',
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'])
          : DateTime.now().add(Duration(minutes: timeoutMinutes)),
      timeoutMinutes: timeoutMinutes,
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'verification_id': verificationId,
      'expires_at': expiresAt.toIso8601String(),
      'timeout_minutes': timeoutMinutes,
    };
  }

  /// Check if verification is expired
  bool get isExpired => DateTime.now().isAfter(expiresAt);

  @override
  String toString() {
    return 'EmailVerificationResponse(id: $verificationId, expiresAt: $expiresAt)';
  }
}

/// Authentication state enum
enum AuthStatus {
  /// User is not authenticated
  unauthenticated,

  /// Authentication is in progress (loading)
  authenticating,

  /// User is authenticated
  authenticated,

  /// Authentication failed
  authenticationFailed,

  /// Token expired
  tokenExpired,

  /// Session revoked
  sessionRevoked,
}

/// Authentication method enum
enum AuthMethod {
  /// Username/email + password
  password,

  /// Phone number + SMS code
  phone,

  /// Social login (Google, Apple, etc.)
  social,

  /// Biometric authentication
  biometric,
}

/// Authentication error types
enum AuthErrorType {
  /// Invalid credentials
  invalidCredentials,

  /// User not found
  userNotFound,

  /// Email already exists
  emailAlreadyExists,

  /// Phone already exists
  phoneAlreadyExists,

  /// Invalid verification code
  invalidVerificationCode,

  /// Verification code expired
  codeExpired,

  /// Too many attempts
  tooManyAttempts,

  /// Service unavailable
  serviceUnavailable,

  /// Network error
  networkError,

  /// Unknown error
  unknown,
}

/// Authentication error model
class AuthError {
  final AuthErrorType type;
  final String message;
  final String? code;
  final Map<String, dynamic>? details;

  AuthError({
    required this.type,
    required this.message,
    this.code,
    this.details,
  });

  /// Create AuthError from API response
  factory AuthError.fromApiResponse(Map<String, dynamic> json) {
    final errorCode = json['error_code']?.toString() ?? json['code']?.toString();
    final errorMessage = json['error']?['message']?.toString() ?? json['message']?.toString() ?? 'Unknown error';

    final type = _parseErrorType(errorCode);

    return AuthError(
      type: type,
      message: errorMessage,
      code: errorCode,
      details: json['error']?['details'] as Map<String, dynamic>?,
    );
  }

  /// Parse error type from error code
  static AuthErrorType _parseErrorType(String? code) {
    if (code == null) return AuthErrorType.unknown;

    switch (code.toLowerCase()) {
      case 'invalid_credentials':
      case 'invalid_credential':
        return AuthErrorType.invalidCredentials;
      case 'user_not_found':
        return AuthErrorType.userNotFound;
      case 'email_already_exists':
        return AuthErrorType.emailAlreadyExists;
      case 'phone_already_exists':
        return AuthErrorType.phoneAlreadyExists;
      case 'invalid_verification_code':
      case 'invalid_code':
        return AuthErrorType.invalidVerificationCode;
      case 'code_expired':
      case 'verification_code_expired':
        return AuthErrorType.codeExpired;
      case 'too_many_attempts':
      case 'rate_limit_exceeded':
        return AuthErrorType.tooManyAttempts;
      case 'service_unavailable':
      case 'server_error':
        return AuthErrorType.serviceUnavailable;
      case 'network_error':
      case 'connection_error':
        return AuthErrorType.networkError;
      default:
        return AuthErrorType.unknown;
    }
  }

  @override
  String toString() {
    return 'AuthError(type: $type, message: $message, code: $code)';
  }
}
