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
import '../../../common/network/network_framework.dart';
import '../config_app_bank/api_config_app_bank.dart';
import '../config_app_bank/bank_endpoint_config.dart';
import '../providers_app_bank/bank_user_provider.dart';
// FIX: Import unified user model for BankUser type only
import '../models_app_bank/user_model_app_bank.dart' show BankUser;

class BankNetworkService extends AdvancedNetworkService {
  static BankNetworkService? _instance;
  static BankNetworkService get instance => _instance ??= BankNetworkService._();
  BankNetworkService._();

  BankUserProvider? _userProvider;
  bool _isIntegrationInitialized = false;
  final GlobalLoadingSystem _loadingManager = GlobalLoadingSystem.instance;

  @override
  String get serviceName => 'BankNetworkService';

  @override
  EndpointConfig get endpointConfig => BankEndpointConfig();

  // Fix: Implement missing abstract getter apiConfig
  // Use authApiConfig as the primary config for authenticated endpoints
  @override
  ApiConfig get apiConfig => ApiConfigAppBank.authApiConfig;

  /// Initialize with user provider
  Future<void> initializeWithUserProvider(BankUserProvider userProvider) async {
    if (_isIntegrationInitialized) return;

    _userProvider = userProvider;

    // Initialize network-user integration
    await NetworkUserIntegration.instance.initialize(userProvider);

    _isIntegrationInitialized = true;
    debugPrint('BankNetworkService initialized with user provider');
  }

  /// Check if user is authenticated before making authenticated requests
  bool _checkAuthentication({String? permission}) {
    if (_userProvider == null) return false;

    if (!_userProvider!.isAuthenticated) {
      debugPrint('User not authenticated');
      return false;
    }

    if (permission != null && !_userProvider!.hasPermission(permission)) {
      debugPrint('User lacks permission: $permission');
      return false;
    }

    return true;
  }


  // Authentication methods
  Future<NetworkResponse<LoginResponseAppBank>> login({
    required String username,
    required String password,
    String? deviceId,
    String? appSignature,
  }) async {
    final data = ApiDataModelsAppBank.loginRequest(
      username: username,
      password: password,
      deviceId: deviceId,
      appSignature: appSignature,
    );

    final response = await post<Map<String, dynamic>>('login', data: data);

    if (response.isSuccess && response.data != null) {
      final loginResponse = LoginResponseAppBank.fromJson(response.data!);

      // Update user provider with authentication data
      if (_userProvider != null && loginResponse.token != null) {
        await NetworkUserIntegration.instance.setJwtAuth(
          token: loginResponse.token!,
          refreshToken: loginResponse.refreshToken,
          expiresAt: loginResponse.expiresAt,
        );

        // Update user data if available
        if (loginResponse.user != null) {
          debugPrint('User logged in successfully: ${loginResponse.user!.username}');
        }
      }

      return NetworkResponse<LoginResponseAppBank>(
        data: loginResponse,
        statusCode: response.statusCode,
        message: response.message,
        error: response.error,
        timestamp: response.timestamp,
      );
    }

    return NetworkResponse<LoginResponseAppBank>(
      statusCode: response.statusCode ?? 500,
      error: response.error ?? 'Login failed',
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<LoginResponseAppBank>> register({
    required String username,
    required String email,
    required String password,
    required String fullName,
    String? phone,
    String? deviceId,
    String? appSignature,
  }) async {
    final data = ApiDataModelsAppBank.registerRequest(
      username: username,
      email: email,
      password: password,
      fullName: fullName,
      phone: phone,
      deviceId: deviceId,
      appSignature: appSignature,
    );

    final response = await post<Map<String, dynamic>>('register', data: data);
    
    if (response.isSuccess && response.data != null) {
      final loginResponse = LoginResponseAppBank.fromJson(response.data!);
      return NetworkResponse<LoginResponseAppBank>(
        data: loginResponse,
        statusCode: response.statusCode,
        message: response.message,
        error: response.error,
        timestamp: response.timestamp,
      );
    }
    
    return NetworkResponse<LoginResponseAppBank>(
      statusCode: response.statusCode ?? 500,
      error: response.error ?? 'Registration failed',
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<Map<String, dynamic>>> logout() async {
    final response = await post<Map<String, dynamic>>('logout');

    // Clear authentication on successful logout
    if (response.isSuccess) {
      await NetworkUserIntegration.instance.clearAuth();
      debugPrint('User logged out successfully');
    }

    return response;
  }

  Future<NetworkResponse<Map<String, dynamic>>> refreshToken() async {
    return await post<Map<String, dynamic>>('refreshToken');
  }

  Future<NetworkResponse<Map<String, dynamic>>> verifyToken() async {
    return await post<Map<String, dynamic>>('verifyToken');
  }

  // App lifecycle methods
  Future<NetworkResponse<AppOpenResponseAppBank>> appOpen({
    required String deviceId,
    required String appSignature,
    String? appVersion,
    String? platform,
  }) async {
    final data = ApiDataModelsAppBank.appOpenRequest(
      deviceId: deviceId,
      appSignature: appSignature,
      appVersion: appVersion,
      platform: platform,
    );

    final response = await post<Map<String, dynamic>>('appOpen', data: data);
    
    if (response.isSuccess && response.data != null) {
      final appOpenResponse = AppOpenResponseAppBank.fromJson(response.data!);
      return NetworkResponse<AppOpenResponseAppBank>(
        data: appOpenResponse,
        statusCode: response.statusCode,
        message: response.message,
        error: response.error,
        timestamp: response.timestamp,
      );
    }
    
    return NetworkResponse<AppOpenResponseAppBank>(
      statusCode: response.statusCode ?? 500,
      error: response.error ?? 'App open failed',
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<Map<String, dynamic>>> appClose({
    required String deviceId,
    required String appSignature,
    int? sessionDuration,
  }) async {
    final data = ApiDataModelsAppBank.appCloseRequest(
      deviceId: deviceId,
      appSignature: appSignature,
      sessionDuration: sessionDuration,
    );

    return await post<Map<String, dynamic>>('appClose', data: data);
  }

  Future<NetworkResponse<Map<String, dynamic>>> appHeartbeat() async {
    return await post<Map<String, dynamic>>('appHeartbeat');
  }

  // User management methods
  /// FIX: Unified user model - returns BankUser directly
  Future<NetworkResponse<BankUser>> getUserProfile() async {
    if (!_checkAuthentication(permission: 'view_profile')) {
      return NetworkResponse<BankUser>(
        statusCode: 401,
        error: 'Authentication required to view profile',
        timestamp: DateTime.now(),
      );
    }

    final response = await get<Map<String, dynamic>>('userProfile');

    if (response.isSuccess && response.data != null) {
      final userData = BankUser.fromApiResponse(response.data!);
      return NetworkResponse<BankUser>(
        data: userData,
        statusCode: response.statusCode,
        message: response.message,
        error: response.error,
        timestamp: response.timestamp,
      );
    }

    return NetworkResponse<BankUser>(
      statusCode: response.statusCode ?? 500,
      error: response.error ?? 'Failed to get user profile',
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// FIX: Unified user model - returns BankUser directly
  Future<NetworkResponse<BankUser>> updateProfile({
    String? fullName,
    String? email,
    String? phone,
    String? dateOfBirth,
    String? gender,
  }) async {
    final data = ApiDataModelsAppBank.updateProfileRequest(
      fullName: fullName,
      email: email,
      phone: phone,
      dateOfBirth: dateOfBirth,
      gender: gender,
    );

    final response = await put<Map<String, dynamic>>('updateProfile', data: data);
    
    if (response.isSuccess && response.data != null) {
      final userData = BankUser.fromApiResponse(response.data!);
      return NetworkResponse<BankUser>(
        data: userData,
        statusCode: response.statusCode,
        message: response.message,
        error: response.error,
        timestamp: response.timestamp,
      );
    }
    
    return NetworkResponse<BankUser>(
      statusCode: response.statusCode ?? 500,
      error: response.error ?? 'Failed to update profile',
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<Map<String, dynamic>>> updateBalance({
    required double newBalance,
    String? reason,
    String? transactionType,
  }) async {
    if (!_checkAuthentication(permission: 'update_balance')) {
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 403,
        error: 'Insufficient permissions to update balance',
        timestamp: DateTime.now(),
      );
    }

    final data = ApiDataModelsAppBank.updateBalanceRequest(
      newBalance: newBalance,
      reason: reason,
      transactionType: transactionType,
    );

    final response = await put<Map<String, dynamic>>('updateBalance', data: data);

    // Update local user balance if successful
    if (response.isSuccess && _userProvider != null) {
      await _userProvider!.updateUser(balance: newBalance);
    }

    return response;
  }

  Future<NetworkResponse<Map<String, dynamic>>> updateAddress({
    String? street,
    String? city,
    String? state,
    String? zipCode,
    String? country,
  }) async {
    final data = ApiDataModelsAppBank.updateAddressRequest(
      street: street,
      city: city,
      state: state,
      zipCode: zipCode,
      country: country,
    );

    return await put<Map<String, dynamic>>('updateAddress', data: data);
  }

  Future<NetworkResponse<Map<String, dynamic>>> registerWithCode({
    required String registrationCode,
    String? referralSource,
  }) async {
    final data = ApiDataModelsAppBank.registerCodeRequest(
      registrationCode: registrationCode,
      referralSource: referralSource,
    );

    return await post<Map<String, dynamic>>('registerWithCode', data: data);
  }

  // Security methods
  Future<NetworkResponse<Map<String, dynamic>>> deviceRegister({
    required String deviceId,
    required String appSignature,
    String? deviceName,
    String? platform,
    String? appVersion,
  }) async {
    final data = ApiDataModelsAppBank.deviceRegisterRequest(
      deviceId: deviceId,
      appSignature: appSignature,
      deviceName: deviceName,
      platform: platform,
      appVersion: appVersion,
    );

    return await post<Map<String, dynamic>>('deviceRegister', data: data);
  }

  Future<NetworkResponse<Map<String, dynamic>>> deviceStatus() async {
    return await get<Map<String, dynamic>>('deviceStatus');
  }

  Future<NetworkResponse<Map<String, dynamic>>> securityCheck() async {
    return await post<Map<String, dynamic>>('securityCheck');
  }

  // Account methods
  Future<NetworkResponse<Map<String, dynamic>>> getAccountBalance() async {
    return await get<Map<String, dynamic>>('accountBalance');
  }

  Future<NetworkResponse<List<dynamic>>> getAccountHistory({
    Map<String, dynamic>? queryParameters,
  }) async {
    final response = await get<Map<String, dynamic>>(
      'accountHistory',
      queryParameters: queryParameters,
    );
    
    if (response.isSuccess && response.data != null) {
      final history = response.data!['history'] as List<dynamic>? ?? [];
      return NetworkResponse<List<dynamic>>(
        data: history,
        statusCode: response.statusCode,
        message: response.message,
        error: response.error,
        headers: response.headers,
        isFromCache: response.isFromCache,
        isStale: response.isStale,
        isOffline: response.isOffline,
        timestamp: response.timestamp,
        latency: response.latency,
        retryCount: response.retryCount,
        metadata: response.metadata,
      );
    }
    
    return NetworkResponse<List<dynamic>>(
      statusCode: response.statusCode,
      message: response.message,
      error: response.error,
      headers: response.headers,
      isFromCache: response.isFromCache,
      isStale: response.isStale,
      isOffline: response.isOffline,
      timestamp: response.timestamp,
      latency: response.latency,
      retryCount: response.retryCount,
      metadata: response.metadata,
    );
  }

  Future<NetworkResponse<Map<String, dynamic>>> getAccountDetails() async {
    return await get<Map<String, dynamic>>('accountDetails');
  }

  // Transaction methods
  Future<NetworkResponse<List<dynamic>>> getTransactions({
    Map<String, dynamic>? queryParameters,
  }) async {
    final response = await get<Map<String, dynamic>>(
      'transactions',
      queryParameters: queryParameters,
    );
    
    if (response.isSuccess && response.data != null) {
      final transactions = response.data!['transactions'] as List<dynamic>? ?? [];
      return NetworkResponse<List<dynamic>>(
        data: transactions,
        statusCode: response.statusCode,
        message: response.message,
        error: response.error,
        headers: response.headers,
        isFromCache: response.isFromCache,
        isStale: response.isStale,
        isOffline: response.isOffline,
        timestamp: response.timestamp,
        latency: response.latency,
        retryCount: response.retryCount,
        metadata: response.metadata,
      );
    }
    
    return NetworkResponse<List<dynamic>>(
      statusCode: response.statusCode,
      message: response.message,
      error: response.error,
      headers: response.headers,
      isFromCache: response.isFromCache,
      isStale: response.isStale,
      isOffline: response.isOffline,
      timestamp: response.timestamp,
      latency: response.latency,
      retryCount: response.retryCount,
      metadata: response.metadata,
    );
  }

  Future<NetworkResponse<Map<String, dynamic>>> transfer({
    required String toAccount,
    required double amount,
    String? description,
    String? transferType,
  }) async {
    if (!_checkAuthentication(permission: 'transfer')) {
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 403,
        error: 'Insufficient permissions to make transfers',
        timestamp: DateTime.now(),
      );
    }

    final data = ApiDataModelsAppBank.transferRequest(
      toAccount: toAccount,
      amount: amount,
      description: description,
      transferType: transferType,
    );

    return await post<Map<String, dynamic>>('transfer', data: data);
  }

  Future<NetworkResponse<Map<String, dynamic>>> payment({
    required String payeeId,
    required double amount,
    required String paymentMethod,
    String? description,
    Map<String, dynamic>? metadata,
  }) async {
    final data = ApiDataModelsAppBank.paymentRequest(
      payeeId: payeeId,
      amount: amount,
      paymentMethod: paymentMethod,
      description: description,
      metadata: metadata,
    );

    return await post<Map<String, dynamic>>('payment', data: data);
  }

  // Batch operations
  Future<List<NetworkResponse<dynamic>>> batchUserOperations({
    required List<String> operations,
    Map<String, dynamic>? commonData,
  }) async {
    final requests = operations.map((operation) => ParallelRequest(
      endpointName: operation,
      data: commonData,
    )).toList();

    return await parallel(requests);
  }

  // Convenience methods with loading states
  Future<NetworkResponse<LoginResponseAppBank>> loginWithLoading({
    required String username,
    required String password,
    String? deviceId,
    String? appSignature,
  }) async {
    // Show loading
    _loadingManager.show(message: 'Logging in...', type: LoadingType.request);
    
    try {
      final response = await login(
        username: username,
        password: password,
        deviceId: deviceId,
        appSignature: appSignature,
      );
      return response;
    } finally {
      _loadingManager.hide();
    }
  }

  Future<NetworkResponse<Map<String, dynamic>>> transferWithLoading({
    required String toAccount,
    required double amount,
    String? description,
    String? transferType,
  }) async {
    // Show loading
    _loadingManager.show(message: 'Processing transfer...', type: LoadingType.request);
    
    try {
      final response = await transfer(
        toAccount: toAccount,
        amount: amount,
        description: description,
        transferType: transferType,
      );
      return response;
    } finally {
      _loadingManager.hide();
    }
  }
}
