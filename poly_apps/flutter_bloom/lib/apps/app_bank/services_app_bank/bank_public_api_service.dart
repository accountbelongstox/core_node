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

import 'package:flutter/foundation.dart';
import 'dart:io';
// REFACTOR: Use new unified network client architecture instead of EnhancedBaseService
import '../../../common/network/network_framework.dart';
import '../../../common/network/security/device_security_manager.dart';
import '../config_app_bank/api_config_app_bank.dart';

/// Bank Public API Service
/// REFACTOR: Now uses UnifiedNetworkClient instead of EnhancedBaseService
/// Handles all public (non-authenticated) API calls for the Bank app
class BankPublicApiService {
  static BankPublicApiService? _instance;
  static BankPublicApiService get instance => _instance ??= BankPublicApiService._();
  
  late final UnifiedNetworkClient _client;
  bool _isInitialized = false;

  BankPublicApiService._() {
    _client = UnifiedNetworkClient.create(
      config: ApiConfigAppBank.publicApiConfig,
      instanceKey: 'bank_public_api',
    );
  }

  /// Initialize the service
  Future<void> initialize() async {
    if (_isInitialized) return;
    _isInitialized = true;
    debugPrint('✅ BankPublicApiService initialized');
  }

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

  /// Device registration and security
  Future<NetworkResponse<Map<String, dynamic>>> registerDevice() async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.deviceRegister,
        method: RequestMethod.post,
        body: ApiDataModelsAppBank.deviceRegisterRequest(
          deviceId: deviceId,
          appSignature: appSignature,
          deviceName: await _getDeviceName(),
          platform: _getPlatformName(),
          appVersion: '1.0.0',
        ),
      );

      return await _client.request<Map<String, dynamic>>(request);
    } catch (e) {
      debugPrint('Device registration error: $e');
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 500,
        error: 'Device registration failed: $e',
        message: 'Device registration failed',
        timestamp: DateTime.now(),
      );
    }
  }

  Future<NetworkResponse<Map<String, dynamic>>> checkDeviceStatus() async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      
      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.deviceStatus,
        method: RequestMethod.get,
        queryParameters: {'device_id': deviceId},
      );

      return await _client.request<Map<String, dynamic>>(request);
    } catch (e) {
      debugPrint('Device status check error: $e');
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 500,
        error: 'Device status check failed: $e',
        message: 'Device status check failed',
        timestamp: DateTime.now(),
      );
    }
  }

  Future<NetworkResponse<Map<String, dynamic>>> performSecurityCheck() async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.securityCheck,
        method: RequestMethod.post,
        body: {
          'device_id': deviceId,
          'app_signature': appSignature,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
          'check_type': 'routine_security_check',
        },
      );

      return await _client.request<Map<String, dynamic>>(request);
    } catch (e) {
      debugPrint('Security check error: $e');
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 500,
        error: 'Security check failed: $e',
        message: 'Security check failed',
        timestamp: DateTime.now(),
      );
    }
  }

  /// Account information (public endpoints)
  Future<NetworkResponse<Map<String, dynamic>>> getAccountBalance({
    required String accountId,
  }) async {
    try {
      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.accountBalance,
        method: RequestMethod.get,
        queryParameters: {'account_id': accountId},
      );

      return await _client.request<Map<String, dynamic>>(request);
    } catch (e) {
      debugPrint('Get account balance error: $e');
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 500,
        error: 'Failed to get account balance: $e',
        message: 'Failed to get account balance',
        timestamp: DateTime.now(),
      );
    }
  }

  Future<NetworkResponse<List<Map<String, dynamic>>>> getAccountHistory({
    required String accountId,
    int page = 1,
    int limit = 20,
    String? startDate,
    String? endDate,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'account_id': accountId,
        'page': page,
        'limit': limit,
      };
      
      if (startDate != null) queryParams['start_date'] = startDate;
      if (endDate != null) queryParams['end_date'] = endDate;

      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.accountHistory,
        method: RequestMethod.get,
        queryParameters: queryParams,
      );

      final response = await _client.request<Map<String, dynamic>>(request);
      
      // Convert response to list format
      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> items = response.data!['items'] ?? [];
        return NetworkResponse<List<Map<String, dynamic>>>(
          statusCode: response.statusCode,
          data: items.map((e) => e as Map<String, dynamic>).toList(),
          message: response.message,
          timestamp: response.timestamp,
        );
      }

      return NetworkResponse<List<Map<String, dynamic>>>(
        statusCode: response.statusCode,
        error: response.error,
        message: response.message,
        timestamp: response.timestamp,
      );
    } catch (e) {
      debugPrint('Get account history error: $e');
      return NetworkResponse<List<Map<String, dynamic>>>(
        statusCode: 500,
        error: 'Failed to get account history: $e',
        message: 'Failed to get account history',
        timestamp: DateTime.now(),
      );
    }
  }

  Future<NetworkResponse<Map<String, dynamic>>> getAccountDetails({
    required String accountId,
  }) async {
    try {
      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.accountDetails,
        method: RequestMethod.get,
        queryParameters: {'account_id': accountId},
      );

      return await _client.request<Map<String, dynamic>>(request);
    } catch (e) {
      debugPrint('Get account details error: $e');
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 500,
        error: 'Failed to get account details: $e',
        message: 'Failed to get account details',
        timestamp: DateTime.now(),
      );
    }
  }

  /// Transaction operations
  Future<NetworkResponse<List<Map<String, dynamic>>>> getTransactions({
    int page = 1,
    int limit = 20,
    String? type,
    String? status,
    String? startDate,
    String? endDate,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      
      if (type != null) queryParams['type'] = type;
      if (status != null) queryParams['status'] = status;
      if (startDate != null) queryParams['start_date'] = startDate;
      if (endDate != null) queryParams['end_date'] = endDate;

      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.transactions,
        method: RequestMethod.get,
        queryParameters: queryParams,
      );

      final response = await _client.request<Map<String, dynamic>>(request);
      
      // Convert response to list format
      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> transactions = response.data!['transactions'] ?? [];
        return NetworkResponse<List<Map<String, dynamic>>>(
          statusCode: response.statusCode,
          data: transactions.map((e) => e as Map<String, dynamic>).toList(),
          message: response.message,
          timestamp: response.timestamp,
        );
      }

      return NetworkResponse<List<Map<String, dynamic>>>(
        statusCode: response.statusCode,
        error: response.error,
        message: response.message,
        timestamp: response.timestamp,
      );
    } catch (e) {
      debugPrint('Get transactions error: $e');
      return NetworkResponse<List<Map<String, dynamic>>>(
        statusCode: 500,
        error: 'Failed to get transactions: $e',
        message: 'Failed to get transactions',
        timestamp: DateTime.now(),
      );
    }
  }

  /// Transfer operations
  Future<NetworkResponse<Map<String, dynamic>>> transfer({
    required String toAccount,
    required double amount,
    String? description,
    String? transferType,
  }) async {
    try {
      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.transfer,
        method: RequestMethod.post,
        body: ApiDataModelsAppBank.transferRequest(
          toAccount: toAccount,
          amount: amount,
          description: description,
          transferType: transferType,
        ),
      );

      return await _client.request<Map<String, dynamic>>(request);
    } catch (e) {
      debugPrint('Transfer error: $e');
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 500,
        error: 'Transfer failed: $e',
        message: 'Transfer failed',
        timestamp: DateTime.now(),
      );
    }
  }

  Future<NetworkResponse<Map<String, dynamic>>> payment({
    required String payeeId,
    required double amount,
    required String paymentMethod,
    String? description,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final request = _buildRequest(
        endpoint: ApiEndpointsAppBank.payment,
        method: RequestMethod.post,
        body: ApiDataModelsAppBank.paymentRequest(
          payeeId: payeeId,
          amount: amount,
          paymentMethod: paymentMethod,
          description: description,
          metadata: metadata,
        ),
      );

      return await _client.request<Map<String, dynamic>>(request);
    } catch (e) {
      debugPrint('Payment error: $e');
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 500,
        error: 'Payment failed: $e',
        message: 'Payment failed',
        timestamp: DateTime.now(),
      );
    }
  }

  /// Helper: Get device name
  Future<String> _getDeviceName() async {
    try {
      if (Platform.isAndroid) {
        return 'Android Device';
      } else if (Platform.isIOS) {
        return 'iOS Device';
      } else if (Platform.isWindows) {
        return 'Windows Device';
      } else if (Platform.isMacOS) {
        return 'MacOS Device';
      } else if (Platform.isLinux) {
        return 'Linux Device';
      }
      return 'Unknown Device';
    } catch (e) {
      return 'Unknown Device';
    }
  }

  /// Helper: Get platform name
  String _getPlatformName() {
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    if (Platform.isWindows) return 'windows';
    if (Platform.isMacOS) return 'macos';
    if (Platform.isLinux) return 'linux';
    return 'unknown';
  }
}
