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

/// Authentication model for QY App
library;

class LoginRequestModel {
  final String identifier; // phone, email, or username
  final String? password;
  final String? verificationCode;
  final String loginMethod; // phone, wechat, weibo, qq, qy_account
  final String? deviceId;

  const LoginRequestModel({
    required this.identifier,
    this.password,
    this.verificationCode,
    required this.loginMethod,
    this.deviceId,
  });

  Map<String, dynamic> toJson() {
    return {
      'identifier': identifier,
      'password': password,
      'verification_code': verificationCode,
      'login_method': loginMethod,
      'device_id': deviceId,
    };
  }
}

class LoginResponseModel {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final int expiresIn;
  final Map<String, dynamic>? userInfo;

  const LoginResponseModel({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.expiresIn,
    this.userInfo,
  });

  factory LoginResponseModel.fromJson(Map<String, dynamic> json) {
    return LoginResponseModel(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
      userId: json['user_id'] as String,
      expiresIn: json['expires_in'] as int,
      userInfo: json['user_info'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'access_token': accessToken,
      'refresh_token': refreshToken,
      'user_id': userId,
      'expires_in': expiresIn,
      'user_info': userInfo,
    };
  }
}

class VerificationCodeRequestModel {
  final String phoneNumber;
  final String purpose; // login, register, reset_password

  const VerificationCodeRequestModel({
    required this.phoneNumber,
    required this.purpose,
  });

  Map<String, dynamic> toJson() {
    return {
      'phone_number': phoneNumber,
      'purpose': purpose,
    };
  }
}

class VerificationCodeResponseModel {
  final bool success;
  final String message;
  final int? expiresIn;

  const VerificationCodeResponseModel({
    required this.success,
    required this.message,
    this.expiresIn,
  });

  factory VerificationCodeResponseModel.fromJson(Map<String, dynamic> json) {
    return VerificationCodeResponseModel(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? '',
      expiresIn: json['expires_in'] as int?,
    );
  }
}
