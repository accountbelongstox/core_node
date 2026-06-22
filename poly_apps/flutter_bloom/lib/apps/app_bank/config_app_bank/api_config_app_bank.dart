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

import '../../../common/network/models/api_config.dart';
// FIX: Import unified user model for LoginResponseAppBank
import '../models_app_bank/user_model_app_bank.dart';

class ApiConfigAppBank {
  static const String baseUrl = 'https://api.si.12gm.com';
  
  static ApiConfig get authApiConfig => ApiConfig.jwtAuth(
    baseUrl: baseUrl,
    headerKey: 'Authorization',
    headerPrefix: 'Bearer',
    timeoutSeconds: 30,
    enableLogging: true,
    responseValidation: ResponseValidationConfig.laravelConfig(),
  );
  
  static ApiConfig get publicApiConfig => ApiConfig.noAuth(
    baseUrl: baseUrl,
    timeoutSeconds: 30,
    enableLogging: true,
    responseValidation: ResponseValidationConfig.laravelConfig(),
  );
}

class ApiEndpointsAppBank {
  // Authentication endpoints
  static const String login = '/api/bank/auth/login';
  static const String register = '/api/bank/auth/register';
  static const String logout = '/api/bank/auth/logout';
  static const String refreshToken = '/api/bank/auth/refresh';
  static const String verifyToken = '/api/bank/auth/verify';
  
  // App lifecycle endpoints
  static const String appOpen = '/api/bank/app/open';
  static const String appClose = '/api/bank/app/close';
  static const String appHeartbeat = '/api/bank/app/heartbeat';
  
  // User management endpoints
  static const String userProfile = '/api/bank/user/profile';
  static const String updateProfile = '/api/bank/user/profile/update';
  static const String updateBalance = '/api/bank/user/balance/update';
  static const String updateAddress = '/api/bank/user/address/update';
  static const String registerWithCode = '/api/bank/user/register-code';
  
  // Security endpoints
  static const String deviceRegister = '/api/bank/security/device/register';
  static const String deviceStatus = '/api/bank/security/device/status';
  static const String securityCheck = '/api/bank/security/check';
  
  // Account endpoints
  static const String accountBalance = '/api/bank/account/balance';
  static const String accountHistory = '/api/bank/account/history';
  static const String accountDetails = '/api/bank/account/details';
  
  // Transaction endpoints
  static const String transactions = '/api/bank/transactions';
  static const String transfer = '/api/bank/transactions/transfer';
  static const String payment = '/api/bank/transactions/payment';
}

class ApiDataModelsAppBank {
  // Authentication models
  static Map<String, dynamic> loginRequest({
    required String username,
    required String password,
    String? deviceId,
    String? appSignature,
  }) => {
    'username': username,
    'password': password,
    if (deviceId != null) 'device_id': deviceId,
    if (appSignature != null) 'app_signature': appSignature,
  };

  static Map<String, dynamic> registerRequest({
    required String username,
    required String email,
    required String password,
    required String fullName,
    String? phone,
    String? deviceId,
    String? appSignature,
  }) => {
    'username': username,
    'email': email,
    'password': password,
    'full_name': fullName,
    if (phone != null) 'phone': phone,
    if (deviceId != null) 'device_id': deviceId,
    if (appSignature != null) 'app_signature': appSignature,
  };

  // App lifecycle models
  static Map<String, dynamic> appOpenRequest({
    required String deviceId,
    required String appSignature,
    String? appVersion,
    String? platform,
  }) => {
    'device_id': deviceId,
    'app_signature': appSignature,
    'timestamp': DateTime.now().millisecondsSinceEpoch,
    'event_type': 'app_open',
    if (appVersion != null) 'app_version': appVersion,
    if (platform != null) 'platform': platform,
  };

  static Map<String, dynamic> appCloseRequest({
    required String deviceId,
    required String appSignature,
    int? sessionDuration,
  }) => {
    'device_id': deviceId,
    'app_signature': appSignature,
    'timestamp': DateTime.now().millisecondsSinceEpoch,
    'event_type': 'app_close',
    if (sessionDuration != null) 'session_duration': sessionDuration,
  };

  // User update models
  static Map<String, dynamic> updateProfileRequest({
    String? fullName,
    String? email,
    String? phone,
    String? dateOfBirth,
    String? gender,
  }) => {
    if (fullName != null) 'full_name': fullName,
    if (email != null) 'email': email,
    if (phone != null) 'phone': phone,
    if (dateOfBirth != null) 'date_of_birth': dateOfBirth,
    if (gender != null) 'gender': gender,
    'updated_at': DateTime.now().toIso8601String(),
  };

  static Map<String, dynamic> updateBalanceRequest({
    required double newBalance,
    String? reason,
    String? transactionType,
  }) => {
    'new_balance': newBalance,
    'timestamp': DateTime.now().millisecondsSinceEpoch,
    if (reason != null) 'reason': reason,
    if (transactionType != null) 'transaction_type': transactionType,
  };

  static Map<String, dynamic> updateAddressRequest({
    String? street,
    String? city,
    String? state,
    String? zipCode,
    String? country,
  }) => {
    if (street != null) 'street': street,
    if (city != null) 'city': city,
    if (state != null) 'state': state,
    if (zipCode != null) 'zip_code': zipCode,
    if (country != null) 'country': country,
    'updated_at': DateTime.now().toIso8601String(),
  };

  static Map<String, dynamic> registerCodeRequest({
    required String registrationCode,
    String? referralSource,
  }) => {
    'registration_code': registrationCode,
    'timestamp': DateTime.now().millisecondsSinceEpoch,
    if (referralSource != null) 'referral_source': referralSource,
  };

  // Security models
  static Map<String, dynamic> deviceRegisterRequest({
    required String deviceId,
    required String appSignature,
    String? deviceName,
    String? platform,
    String? appVersion,
  }) => {
    'device_id': deviceId,
    'app_signature': appSignature,
    'registration_timestamp': DateTime.now().millisecondsSinceEpoch,
    if (deviceName != null) 'device_name': deviceName,
    if (platform != null) 'platform': platform,
    if (appVersion != null) 'app_version': appVersion,
  };

  // Transaction models
  static Map<String, dynamic> transferRequest({
    required String toAccount,
    required double amount,
    String? description,
    String? transferType,
  }) => {
    'to_account': toAccount,
    'amount': amount,
    'timestamp': DateTime.now().millisecondsSinceEpoch,
    if (description != null) 'description': description,
    if (transferType != null) 'transfer_type': transferType,
  };

  static Map<String, dynamic> paymentRequest({
    required String payeeId,
    required double amount,
    required String paymentMethod,
    String? description,
    Map<String, dynamic>? metadata,
  }) => {
    'payee_id': payeeId,
    'amount': amount,
    'payment_method': paymentMethod,
    'timestamp': DateTime.now().millisecondsSinceEpoch,
    if (description != null) 'description': description,
    if (metadata != null) 'metadata': metadata,
  };
}

// Response models for type-safe parsing
// REMOVED: UserDataAppBank class - unified to use BankUser from user_model_app_bank.dart

class LoginResponseAppBank {
  final String token;
  final String refreshToken;
  final BankUser user; // FIX: Unified to use BankUser
  final int expiresIn;
  final DateTime? expiresAt;

  LoginResponseAppBank({
    required this.token,
    required this.refreshToken,
    required this.user,
    required this.expiresIn,
    this.expiresAt,
  });

  factory LoginResponseAppBank.fromJson(Map<String, dynamic> json) {
    return LoginResponseAppBank(
      token: json['token'] ?? '',
      refreshToken: json['refresh_token'] ?? '',
      user: BankUser.fromApiResponse(json['user'] ?? {}), // FIX: Use unified model
      expiresIn: json['expires_in'] ?? 3600,
      expiresAt: json['expires_at'] != null 
        ? DateTime.tryParse(json['expires_at']) 
        : DateTime.now().add(Duration(seconds: json['expires_in'] ?? 3600)),
    );
  }
}

class AppOpenResponseAppBank {
  final bool success;
  final String sessionId;
  final Map<String, dynamic>? serverConfig;
  final bool deviceLocked;
  final String? lockReason;

  AppOpenResponseAppBank({
    required this.success,
    required this.sessionId,
    this.serverConfig,
    required this.deviceLocked,
    this.lockReason,
  });

  factory AppOpenResponseAppBank.fromJson(Map<String, dynamic> json) {
    return AppOpenResponseAppBank(
      success: json['success'] ?? false,
      sessionId: json['session_id'] ?? '',
      serverConfig: json['server_config'],
      deviceLocked: json['device_locked'] ?? false,
      lockReason: json['lock_reason'],
    );
  }
}
