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

import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../common/network/services/enhanced_base_service.dart';
import '../../../common/network/models/api_response.dart';
import '../../../common/network/security/device_security_manager.dart';
import '../config_app_bank/api_config_app_bank.dart';
import '../models_app_bank/user_model_app_bank.dart';

class BankAuthApiService extends EnhancedBaseService {
  static BankAuthApiService? _instance;
  static BankAuthApiService get instance => _instance ??= BankAuthApiService._();
  
  BankAuthApiService._() : super(config: ApiConfigAppBank.authApiConfig);

  Timer? _heartbeatTimer;
  DateTime? _sessionStartTime;
  bool _isLoggedIn = false;
  UserModelAppBank? _currentUser;

  // Authentication methods
  Future<ApiResponse<LoginResponseAppBank>> login({
    required String username,
    required String password,
  }) async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      final requestBody = ApiDataModelsAppBank.loginRequest(
        username: username,
        password: password,
        deviceId: deviceId,
        appSignature: appSignature,
      );

      final response = await super.login<Map<String, dynamic>>(
        ApiEndpointsAppBank.login,
        requestBody,
        fromJson: (json) => json,
      );

      if (response.success && response.data != null) {
        final loginResponse = LoginResponseAppBank.fromJson(response.data!);
        _currentUser = UserModelAppBank.fromUserData(loginResponse.user);
        _isLoggedIn = true;
        _sessionStartTime = DateTime.now();
        
        // Start heartbeat
        _startHeartbeat();
        
        return ApiResponse<LoginResponseAppBank>.success(
          data: loginResponse,
          statusCode: response.statusCode,
          message: response.message,
        );
      }

      return ApiResponse<LoginResponseAppBank>.error(
        error: response.error ?? 'Login failed',
        statusCode: response.statusCode,
        message: response.message,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Login error: $e');
      }
      return ApiResponse<LoginResponseAppBank>.error(
        error: 'Login failed: $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> register({
    required String username,
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      final requestBody = ApiDataModelsAppBank.registerRequest(
        username: username,
        email: email,
        password: password,
        fullName: fullName,
        phone: phone,
        deviceId: deviceId,
        appSignature: appSignature,
      );

      return await post<Map<String, dynamic>>(
        ApiEndpointsAppBank.register,
        body: requestBody,
        fromJson: (json) => json,
        requiresAuth: false,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Register error: $e');
      }
      return ApiResponse<Map<String, dynamic>>.error(
        error: 'Registration failed: $e',
        statusCode: 500,
      );
    }
  }

  @override
  Future<void> logout() async {
    try {
      if (_isLoggedIn) {
        await post<Map<String, dynamic>>(
          ApiEndpointsAppBank.logout,
          body: {},
          fromJson: (json) => json,
        );
      }
    } catch (e) {
      if (kDebugMode) {
        print('Logout error: $e');
      }
    } finally {
      _stopHeartbeat();
      _isLoggedIn = false;
      _currentUser = null;
      _sessionStartTime = null;
      await super.logout();
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> verifyToken() async {
    return await get<Map<String, dynamic>>(
      ApiEndpointsAppBank.verifyToken,
      fromJson: (json) => json,
    );
  }

  // App lifecycle methods
  Future<ApiResponse<AppOpenResponseAppBank>> reportAppOpen() async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      final requestBody = ApiDataModelsAppBank.appOpenRequest(
        deviceId: deviceId,
        appSignature: appSignature,
        appVersion: '1.0.0', // This should come from package info
        platform: _getPlatformName(),
      );

      final response = await post<Map<String, dynamic>>(
        ApiEndpointsAppBank.appOpen,
        body: requestBody,
        fromJson: (json) => json,
        requiresAuth: false,
      );

      if (response.success && response.data != null) {
        final appOpenResponse = AppOpenResponseAppBank.fromJson(response.data!);
        
        // Handle device lock from server
        if (appOpenResponse.deviceLocked) {
          await DeviceSecurityManager.instance.lockDevice(
            appOpenResponse.lockReason ?? 'Server security lock',
          );
        }
        
        return ApiResponse<AppOpenResponseAppBank>.success(
          data: appOpenResponse,
          statusCode: response.statusCode,
          message: response.message,
        );
      }

      return ApiResponse<AppOpenResponseAppBank>.error(
        error: response.error ?? 'App open report failed',
        statusCode: response.statusCode,
        message: response.message,
      );
    } catch (e) {
      if (kDebugMode) {
        print('App open report error: $e');
      }
      return ApiResponse<AppOpenResponseAppBank>.error(
        error: 'App open report failed: $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> reportAppClose() async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      int? sessionDuration;
      if (_sessionStartTime != null) {
        sessionDuration = DateTime.now().difference(_sessionStartTime!).inSeconds;
      }
      
      final requestBody = ApiDataModelsAppBank.appCloseRequest(
        deviceId: deviceId,
        appSignature: appSignature,
        sessionDuration: sessionDuration,
      );

      return await post<Map<String, dynamic>>(
        ApiEndpointsAppBank.appClose,
        body: requestBody,
        fromJson: (json) => json,
        requiresAuth: false,
      );
    } catch (e) {
      if (kDebugMode) {
        print('App close report error: $e');
      }
      return ApiResponse<Map<String, dynamic>>.error(
        error: 'App close report failed: $e',
        statusCode: 500,
      );
    }
  }

  // User profile methods
  Future<ApiResponse<UserDataAppBank>> getUserProfile() async {
    final response = await get<Map<String, dynamic>>(
      ApiEndpointsAppBank.userProfile,
      fromJson: (json) => json,
    );

    if (response.success && response.data != null) {
      final userData = UserDataAppBank.fromJson(response.data!);
      _currentUser = UserModelAppBank.fromUserData(userData);
      
      return ApiResponse<UserDataAppBank>.success(
        data: userData,
        statusCode: response.statusCode,
        message: response.message,
      );
    }

    return ApiResponse<UserDataAppBank>.error(
      error: response.error ?? 'Failed to get user profile',
      statusCode: response.statusCode,
      message: response.message,
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> updateProfile({
    String? fullName,
    String? email,
    String? phone,
    String? dateOfBirth,
    String? gender,
  }) async {
    final requestBody = ApiDataModelsAppBank.updateProfileRequest(
      fullName: fullName,
      email: email,
      phone: phone,
      dateOfBirth: dateOfBirth,
      gender: gender,
    );

    return await put<Map<String, dynamic>>(
      ApiEndpointsAppBank.updateProfile,
      body: requestBody,
      fromJson: (json) => json,
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> updateBalance({
    required double newBalance,
    String? reason,
    String? transactionType,
  }) async {
    final requestBody = ApiDataModelsAppBank.updateBalanceRequest(
      newBalance: newBalance,
      reason: reason,
      transactionType: transactionType,
    );

    return await put<Map<String, dynamic>>(
      ApiEndpointsAppBank.updateBalance,
      body: requestBody,
      fromJson: (json) => json,
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> updateAddress({
    String? street,
    String? city,
    String? state,
    String? zipCode,
    String? country,
  }) async {
    final requestBody = ApiDataModelsAppBank.updateAddressRequest(
      street: street,
      city: city,
      state: state,
      zipCode: zipCode,
      country: country,
    );

    return await put<Map<String, dynamic>>(
      ApiEndpointsAppBank.updateAddress,
      body: requestBody,
      fromJson: (json) => json,
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> registerWithCode({
    required String registrationCode,
    String? referralSource,
  }) async {
    final requestBody = ApiDataModelsAppBank.registerCodeRequest(
      registrationCode: registrationCode,
      referralSource: referralSource,
    );

    return await post<Map<String, dynamic>>(
      ApiEndpointsAppBank.registerWithCode,
      body: requestBody,
      fromJson: (json) => json,
    );
  }

  // Getters
  bool get isLoggedIn => _isLoggedIn;
  UserModelAppBank? get currentUser => _currentUser;
  DateTime? get sessionStartTime => _sessionStartTime;

  // Private methods
  void _startHeartbeat() {
    _stopHeartbeat();
    _heartbeatTimer = Timer.periodic(
      const Duration(minutes: 5),
      (timer) => _sendHeartbeat(),
    );
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  Future<void> _sendHeartbeat() async {
    try {
      await post<Map<String, dynamic>>(
        ApiEndpointsAppBank.appHeartbeat,
        body: {
          'timestamp': DateTime.now().millisecondsSinceEpoch,
          'session_duration': _sessionStartTime != null 
              ? DateTime.now().difference(_sessionStartTime!).inSeconds 
              : 0,
        },
        fromJson: (json) => json,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Heartbeat error: $e');
      }
    }
  }

  String _getPlatformName() {
    if (kIsWeb) return 'web';
    if (defaultTargetPlatform == TargetPlatform.android) return 'android';
    if (defaultTargetPlatform == TargetPlatform.iOS) return 'ios';
    if (defaultTargetPlatform == TargetPlatform.windows) return 'windows';
    if (defaultTargetPlatform == TargetPlatform.macOS) return 'macos';
    if (defaultTargetPlatform == TargetPlatform.linux) return 'linux';
    return 'unknown';
  }

  void dispose() {
    _stopHeartbeat();
  }
}
