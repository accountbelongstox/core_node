
/// Authentication data models for the multi-provider authentication system
library;

import 'dart:convert';
import 'package:equatable/equatable.dart';
import 'auth_config.dart';

/// Authentication result from any provider
class AuthResult extends Equatable {
  final bool success;
  final AuthUser? user;
  final AuthToken? token;
  final String? errorMessage;
  final AuthError? errorCode;
  final Map<String, dynamic>? additionalData;

  const AuthResult({
    required this.success,
    this.user,
    this.token,
    this.errorMessage,
    this.errorCode,
    this.additionalData,
  });

  /// Successful authentication result
  factory AuthResult.success({
    required AuthUser user,
    required AuthToken token,
    Map<String, dynamic>? additionalData,
  }) {
    return AuthResult(
      success: true,
      user: user,
      token: token,
      additionalData: additionalData,
    );
  }

  /// Failed authentication result
  factory AuthResult.failure({
    required String errorMessage,
    AuthError? errorCode,
    Map<String, dynamic>? additionalData,
  }) {
    return AuthResult(
      success: false,
      errorMessage: errorMessage,
      errorCode: errorCode,
      additionalData: additionalData,
    );
  }

  @override
  List<Object?> get props => [
        success,
        user,
        token,
        errorMessage,
        errorCode,
        additionalData,
      ];

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'user': user?.toJson(),
      'token': token?.toJson(),
      'errorMessage': errorMessage,
      'errorCode': errorCode?.name,
      'additionalData': additionalData,
    };
  }

  factory AuthResult.fromJson(Map<String, dynamic> json) {
    if (json['success'] as bool == true) {
      return AuthResult.success(
        user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
        token: AuthToken.fromJson(json['token'] as Map<String, dynamic>),
        additionalData: json['additionalData'] as Map<String, dynamic>?,
      );
    } else {
      return AuthResult.failure(
        errorMessage: json['errorMessage'] as String,
        errorCode: json['errorCode'] != null
            ? AuthError.values.firstWhere(
                (error) => error.name == json['errorCode'],
                orElse: () => AuthError.unknownError,
              )
            : null,
        additionalData: json['additionalData'] as Map<String, dynamic>?,
      );
    }
  }
}

/// Authentication user model
class AuthUser extends Equatable {
  final String id;
  final AuthProvider provider;
  final String? email;
  final String? phone;
  final String? username;
  final String? displayName;
  final String? avatar;
  final String? unionId;
  final String? openId;
  final Map<String, dynamic>? profile;
  final DateTime? createdAt;
  final DateTime? lastLoginAt;
  final bool isVerified;
  final bool isActive;

  const AuthUser({
    required this.id,
    required this.provider,
    this.email,
    this.phone,
    this.username,
    this.displayName,
    this.avatar,
    this.unionId,
    this.openId,
    this.profile,
    this.createdAt,
    this.lastLoginAt,
    this.isVerified = false,
    this.isActive = true,
  });

  AuthUser copyWith({
    String? id,
    AuthProvider? provider,
    String? email,
    String? phone,
    String? username,
    String? displayName,
    String? avatar,
    String? unionId,
    String? openId,
    Map<String, dynamic>? profile,
    DateTime? createdAt,
    DateTime? lastLoginAt,
    bool? isVerified,
    bool? isActive,
  }) {
    return AuthUser(
      id: id ?? this.id,
      provider: provider ?? this.provider,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      username: username ?? this.username,
      displayName: displayName ?? this.displayName,
      avatar: avatar ?? this.avatar,
      unionId: unionId ?? this.unionId,
      openId: openId ?? this.openId,
      profile: profile ?? this.profile,
      createdAt: createdAt ?? this.createdAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      isVerified: isVerified ?? this.isVerified,
      isActive: isActive ?? this.isActive,
    );
  }

  @override
  List<Object?> get props => [
        id,
        provider,
        email,
        phone,
        username,
        displayName,
        avatar,
        unionId,
        openId,
        profile,
        createdAt,
        lastLoginAt,
        isVerified,
        isActive,
      ];

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'provider': provider.name,
      'email': email,
      'phone': phone,
      'username': username,
      'displayName': displayName,
      'avatar': avatar,
      'unionId': unionId,
      'openId': openId,
      'profile': profile,
      'createdAt': createdAt?.toIso8601String(),
      'lastLoginAt': lastLoginAt?.toIso8601String(),
      'isVerified': isVerified,
      'isActive': isActive,
    };
  }

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      provider: AuthProvider.values.firstWhere(
        (p) => p.name == json['provider'],
        orElse: () => AuthProvider.email,
      ),
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      username: json['username'] as String?,
      displayName: json['displayName'] as String?,
      avatar: json['avatar'] as String?,
      unionId: json['unionId'] as String?,
      openId: json['openId'] as String?,
      profile: json['profile'] as Map<String, dynamic>?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      lastLoginAt: json['lastLoginAt'] != null
          ? DateTime.parse(json['lastLoginAt'] as String)
          : null,
      isVerified: json['isVerified'] as bool? ?? false,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}

/// Authentication token model
class AuthToken extends Equatable {
  final String accessToken;
  final String? refreshToken;
  final String? tokenType;
  final int? expiresIn;
  final DateTime? expiresAt;
  final String? scope;
  final Map<String, dynamic>? additionalData;

  const AuthToken({
    required this.accessToken,
    this.refreshToken,
    this.tokenType,
    this.expiresIn,
    this.expiresAt,
    this.scope,
    this.additionalData,
  });

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  bool get isExpiringSoon {
    if (expiresAt == null) return false;
    return DateTime.now().add(const Duration(minutes: 5)).isAfter(expiresAt!);
  }

  AuthToken copyWith({
    String? accessToken,
    String? refreshToken,
    String? tokenType,
    int? expiresIn,
    DateTime? expiresAt,
    String? scope,
    Map<String, dynamic>? additionalData,
  }) {
    return AuthToken(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      tokenType: tokenType ?? this.tokenType,
      expiresIn: expiresIn ?? this.expiresIn,
      expiresAt: expiresAt ?? this.expiresAt,
      scope: scope ?? this.scope,
      additionalData: additionalData ?? this.additionalData,
    );
  }

  @override
  List<Object?> get props => [
        accessToken,
        refreshToken,
        tokenType,
        expiresIn,
        expiresAt,
        scope,
        additionalData,
      ];

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'tokenType': tokenType,
      'expiresIn': expiresIn,
      'expiresAt': expiresAt?.toIso8601String(),
      'scope': scope,
      'additionalData': additionalData,
    };
  }

  factory AuthToken.fromJson(Map<String, dynamic> json) {
    return AuthToken(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String?,
      tokenType: json['tokenType'] as String?,
      expiresIn: json['expiresIn'] as int?,
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'] as String)
          : null,
      scope: json['scope'] as String?,
      additionalData: json['additionalData'] as Map<String, dynamic>?,
    );
  }

  /// Create a token that expires after specified duration
  factory AuthToken.expiring({
    required String accessToken,
    String? refreshToken,
    String tokenType = 'Bearer',
    required Duration expiresIn,
    String? scope,
    Map<String, dynamic>? additionalData,
  }) {
    return AuthToken(
      accessToken: accessToken,
      refreshToken: refreshToken,
      tokenType: tokenType,
      expiresIn: expiresIn.inSeconds,
      expiresAt: DateTime.now().add(expiresIn),
      scope: scope,
      additionalData: additionalData,
    );
  }
}

/// Authentication error codes
enum AuthError {
  userCancelled,
  networkError,
  invalidCredentials,
  accountNotLinked,
  providerNotAvailable,
  providerNotConfigured,
  sessionExpired,
  tokenRefreshFailed,
  invalidResponse,
  verificationFailed,
  accountDisabled,
  accountLocked,
  emailNotVerified,
  phoneNotVerified,
  invalidSmsCode,
  smsCodeExpired,
  tooManyAttempts,
  invalidRequest,
  unknownError,
}

/// Phone authentication state
class PhoneAuthState extends Equatable {
  final String? phoneNumber;
  final String? verificationId;
  final bool codeSent;
  final bool codeVerified;
  final bool verificationFailed;
  final String? errorMessage;
  final int? remainingTime;
  final int? resendAttempts;

  const PhoneAuthState({
    this.phoneNumber,
    this.verificationId,
    this.codeSent = false,
    this.codeVerified = false,
    this.verificationFailed = false,
    this.errorMessage,
    this.remainingTime,
    this.resendAttempts,
  });

  PhoneAuthState copyWith({
    String? phoneNumber,
    String? verificationId,
    bool? codeSent,
    bool? codeVerified,
    bool? verificationFailed,
    String? errorMessage,
    int? remainingTime,
    int? resendAttempts,
  }) {
    return PhoneAuthState(
      phoneNumber: phoneNumber ?? this.phoneNumber,
      verificationId: verificationId ?? this.verificationId,
      codeSent: codeSent ?? this.codeSent,
      codeVerified: codeVerified ?? this.codeVerified,
      verificationFailed: verificationFailed ?? this.verificationFailed,
      errorMessage: errorMessage ?? this.errorMessage,
      remainingTime: remainingTime ?? this.remainingTime,
      resendAttempts: resendAttempts ?? this.resendAttempts,
    );
  }

  @override
  List<Object?> get props => [
        phoneNumber,
        verificationId,
        codeSent,
        codeVerified,
        verificationFailed,
        errorMessage,
        remainingTime,
        resendAttempts,
      ];
}

/// Authentication session information
class AuthSession extends Equatable {
  final String sessionId;
  final String userId;
  final AuthProvider provider;
  final DateTime createdAt;
  final DateTime? expiresAt;
  final DateTime? lastActivityAt;
  final Map<String, dynamic>? metadata;
  final bool isActive;

  const AuthSession({
    required this.sessionId,
    required this.userId,
    required this.provider,
    required this.createdAt,
    this.expiresAt,
    this.lastActivityAt,
    this.metadata,
    this.isActive = true,
  });

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  bool get isInactive {
    if (lastActivityAt == null) return false;
    return DateTime.now().difference(lastActivityAt!).inMinutes > 30;
  }

  AuthSession copyWith({
    String? sessionId,
    String? userId,
    AuthProvider? provider,
    DateTime? createdAt,
    DateTime? expiresAt,
    DateTime? lastActivityAt,
    Map<String, dynamic>? metadata,
    bool? isActive,
  }) {
    return AuthSession(
      sessionId: sessionId ?? this.sessionId,
      userId: userId ?? this.userId,
      provider: provider ?? this.provider,
      createdAt: createdAt ?? this.createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
      lastActivityAt: lastActivityAt ?? this.lastActivityAt,
      metadata: metadata ?? this.metadata,
      isActive: isActive ?? this.isActive,
    );
  }

  @override
  List<Object?> get props => [
        sessionId,
        userId,
        provider,
        createdAt,
        expiresAt,
        lastActivityAt,
        metadata,
        isActive,
      ];

  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'userId': userId,
      'provider': provider.name,
      'createdAt': createdAt.toIso8601String(),
      'expiresAt': expiresAt?.toIso8601String(),
      'lastActivityAt': lastActivityAt?.toIso8601String(),
      'metadata': metadata,
      'isActive': isActive,
    };
  }

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      sessionId: json['sessionId'] as String,
      userId: json['userId'] as String,
      provider: AuthProvider.values.firstWhere(
        (p) => p.name == json['provider'],
        orElse: () => AuthProvider.email,
      ),
      createdAt: DateTime.parse(json['createdAt'] as String),
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'] as String)
          : null,
      lastActivityAt: json['lastActivityAt'] != null
          ? DateTime.parse(json['lastActivityAt'] as String)
          : null,
      metadata: json['metadata'] as Map<String, dynamic>?,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}