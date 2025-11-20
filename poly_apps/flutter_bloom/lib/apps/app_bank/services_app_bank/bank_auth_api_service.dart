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
// REFACTOR: Use new unified network client architecture instead of EnhancedBaseService
import '../../../common/network/network_framework.dart';
import '../../../common/network/security/device_security_manager.dart';
import '../config_app_bank/api_config_app_bank.dart';
// Fix: BankUser is the correct class name in user_model_app_bank.dart
import '../models_app_bank/user_model_app_bank.dart';

/// Bank Authentication API Service
/// REFACTOR: Now uses UnifiedNetworkClient instead of EnhancedBaseService
/// Handles all authentication-related API calls for the Bank app
class BankAuthApiService {
  static BankAuthApiService? _instance;
  static BankAuthApiService get instance => _instance ??= BankAuthApiService._();
  
  late final UnifiedNetworkClient _client;
  Timer? _heartbeatTimer;
  DateTime? _sessionStartTime;
  bool _isLoggedIn = false;
  bool _isInitialized = false;
  BankUser? _currentUser;

  BankAuthApiService._() {
    _client = UnifiedNetworkClient.create(
      config: ApiConfigAppBank.authApiConfig,
      instanceKey: 'bank_auth_api',
    );
  }

  /// Initialize the service
  Future<void> initialize() async {
    if (_isInitialized) return;
    _isInitialized = true;
    debugPrint('✅ BankAuthApiService initialized');
  }

  /// Get current user
  /// Fix: Return BankUser? instead of UserModelAppBank?
  BankUser? get currentUser => _currentUser;

  bool get isLoggedIn => _isLoggedIn;

  /// Helper: Build NetworkRequest for common operations
  NetworkRequest _buildRequest({
    required String endpoint,
    required RequestMethod method,
    Map<String, dynamic>? body,
    Map<String, dynamic>? queryParameters,
  }) {
    return NetworkRequest(
      endpoint: endpoint,
      method: method,
      body: body,
      parameters: queryParameters,
      priority: RequestPriority.normal,
    );
  }

  /// Login
  Future<NetworkResponse<LoginResponseAppBank>> login({
    required String username,
    required String password,
  }) async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.login,
        method: RequestMethod.post,
        body: ApiDataModelsAppBank.loginRequest(
          username: username,
          password: password,
          deviceId: deviceId,
          appSignature: appSignature,
        ),
      );

      final response = await _client.request<Map<String, dynamic>>(request);

      if (response.statusCode == 200 && response.data != null) {
        final loginResponse = LoginResponseAppBank.fromJson(response.data!);
        // FIX: Unified user model - LoginResponseAppBank.user is already BankUser
        _currentUser = loginResponse.user;
        _isLoggedIn = true;
        _sessionStartTime = DateTime.now();
        
        // Start heartbeat
        _startHeartbeat();
        
        return NetworkResponse<LoginResponseAppBank>(
          statusCode: response.statusCode,
          data: loginResponse,
          message: response.message ?? 'Login successful',
          timestamp: response.timestamp,
        );
      }

      return NetworkResponse<LoginResponseAppBank>(
        statusCode: response.statusCode,
        error: response.error,
        message: response.message ?? 'Login failed',
        timestamp: response.timestamp,
      );
    } catch (e) {
      debugPrint('Login error: $e');
      return NetworkResponse<LoginResponseAppBank>(
        statusCode: 500,
        error: 'Login failed: $e',
        message: 'Login failed',
        timestamp: DateTime.now(),
      );
    }
  }

  /// Register
  Future<NetworkResponse<LoginResponseAppBank>> register({
    required String username,
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.register,
        method: RequestMethod.post,
        body: ApiDataModelsAppBank.registerRequest(
          username: username,
          email: email,
          password: password,
          fullName: fullName,
          phone: phone,
          deviceId: deviceId,
          appSignature: appSignature,
        ),
      );

      final response = await _client.request<Map<String, dynamic>>(request);

      if (response.statusCode == 200 && response.data != null) {
        final loginResponse = LoginResponseAppBank.fromJson(response.data!);
        return NetworkResponse<LoginResponseAppBank>(
          statusCode: response.statusCode,
          data: loginResponse,
          message: response.message ?? 'Registration successful',
          timestamp: response.timestamp,
        );
      }

      return NetworkResponse<LoginResponseAppBank>(
        statusCode: response.statusCode,
        error: response.error,
        message: response.message ?? 'Registration failed',
        timestamp: response.timestamp,
      );
    } catch (e) {
      debugPrint('Register error: $e');
      return NetworkResponse<LoginResponseAppBank>(
        statusCode: 500,
        error: 'Registration failed: $e',
        message: 'Registration failed',
        timestamp: DateTime.now(),
      );
    }
  }

  /// Logout
  Future<void> logout() async {
    try {
      if (_isLoggedIn) {
        final request = _buildRequest(
          endpoint: ApiEndpointsAppBank.logout,
          method: RequestMethod.post,
        );
        
        await _client.request<Map<String, dynamic>>(request);
      }
    } catch (e) {
      debugPrint('Logout error: $e');
    } finally {
      _stopHeartbeat();
      _isLoggedIn = false;
      _currentUser = null;
      _sessionStartTime = null;
    }
  }

  /// Verify Token
  Future<NetworkResponse<Map<String, dynamic>>> verifyToken() async {
    final request = _buildRequest(
      endpoint: ApiEndpointsAppBank.verifyToken,
      method: RequestMethod.post,
    );
    
    return await _client.request<Map<String, dynamic>>(request);
  }

  /// Refresh Token
  Future<NetworkResponse<Map<String, dynamic>>> refreshToken() async {
    final request = _buildRequest(
      endpoint: ApiEndpointsAppBank.refreshToken,
      method: RequestMethod.post,
    );
    
    return await _client.request<Map<String, dynamic>>(request);
  }

  /// Get User Profile
  /// FIX: Unified user model - returns BankUser directly
  Future<NetworkResponse<BankUser>> getUserProfile() async {
    final request = _buildRequest(
      endpoint: ApiEndpointsAppBank.userProfile,
      method: RequestMethod.get,
    );
    
    final response = await _client.request<Map<String, dynamic>>(request);

    if (response.statusCode == 200 && response.data != null) {
      final userData = BankUser.fromApiResponse(response.data!);
      _currentUser = userData;
      
      return NetworkResponse<BankUser>(
        statusCode: response.statusCode,
        data: userData,
        message: response.message,
        timestamp: response.timestamp,
      );
    }

    return NetworkResponse<BankUser>(
      statusCode: response.statusCode,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// Update Profile
  /// FIX: Unified user model - returns BankUser directly
  Future<NetworkResponse<BankUser>> updateProfile({
    String? fullName,
    String? email,
    String? phone,
    String? dateOfBirth,
    String? gender,
  }) async {
    final request = _buildRequest(
      endpoint: ApiEndpointsAppBank.updateProfile,
      method: RequestMethod.put,
      body: ApiDataModelsAppBank.updateProfileRequest(
        fullName: fullName,
        email: email,
        phone: phone,
        dateOfBirth: dateOfBirth,
        gender: gender,
      ),
    );
    
    final response = await _client.request<Map<String, dynamic>>(request);

    if (response.statusCode == 200 && response.data != null) {
      final userData = BankUser.fromApiResponse(response.data!);
      _currentUser = userData;
      
      return NetworkResponse<BankUser>(
        statusCode: response.statusCode,
        data: userData,
        message: response.message,
        timestamp: response.timestamp,
      );
    }

    return NetworkResponse<BankUser>(
      statusCode: response.statusCode,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// Start heartbeat timer
  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(minutes: 5), (_) async {
      if (_isLoggedIn) {
        try {
          final request = _buildRequest(
            endpoint: ApiEndpointsAppBank.appHeartbeat,
            method: RequestMethod.post,
          );
          
          await _client.request<Map<String, dynamic>>(request);
        } catch (e) {
          debugPrint('Heartbeat error: $e');
        }
      }
    });
  }

  /// Stop heartbeat timer
  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  /// Dispose resources
  void dispose() {
    _stopHeartbeat();
  }
}
