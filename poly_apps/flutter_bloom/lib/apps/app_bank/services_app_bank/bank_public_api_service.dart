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
import '../../../common/network/services/enhanced_base_service.dart';
import '../../../common/network/models/api_response.dart';
import '../../../common/network/security/device_security_manager.dart';
import '../config_app_bank/api_config_app_bank.dart';

class BankPublicApiService extends EnhancedBaseService {
  static BankPublicApiService? _instance;
  static BankPublicApiService get instance => _instance ??= BankPublicApiService._();
  
  BankPublicApiService._() : super(config: ApiConfigAppBank.publicApiConfig);

  // Device registration and security
  Future<ApiResponse<Map<String, dynamic>>> registerDevice() async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      final requestBody = ApiDataModelsAppBank.deviceRegisterRequest(
        deviceId: deviceId,
        appSignature: appSignature,
        deviceName: await _getDeviceName(),
        platform: _getPlatformName(),
        appVersion: '1.0.0',
      );

      return await post<Map<String, dynamic>>(
        ApiEndpointsAppBank.deviceRegister,
        body: requestBody,
        fromJson: (json) => json,
        requiresAuth: false,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Device registration error: $e');
      }
      return ApiResponse<Map<String, dynamic>>.error(
        error: 'Device registration failed: $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> checkDeviceStatus() async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      
      return await get<Map<String, dynamic>>(
        '${ApiEndpointsAppBank.deviceStatus}?device_id=$deviceId',
        fromJson: (json) => json,
        useCache: true,
        cacheDuration: const Duration(minutes: 5),
      );
    } catch (e) {
      if (kDebugMode) {
        print('Device status check error: $e');
      }
      return ApiResponse<Map<String, dynamic>>.error(
        error: 'Device status check failed: $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> performSecurityCheck() async {
    try {
      final deviceId = await DeviceSecurityManager.instance.getDeviceId();
      final appSignature = await DeviceSecurityManager.instance.getAppSignature();
      
      final requestBody = {
        'device_id': deviceId,
        'app_signature': appSignature,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
        'check_type': 'routine_security_check',
      };

      return await post<Map<String, dynamic>>(
        ApiEndpointsAppBank.securityCheck,
        body: requestBody,
        fromJson: (json) => json,
        requiresAuth: false,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Security check error: $e');
      }
      return ApiResponse<Map<String, dynamic>>.error(
        error: 'Security check failed: $e',
        statusCode: 500,
      );
    }
  }

  // Account information (public endpoints)
  Future<ApiResponse<Map<String, dynamic>>> getAccountBalance({
    required String accountId,
  }) async {
    try {
      return await get<Map<String, dynamic>>(
        '${ApiEndpointsAppBank.accountBalance}?account_id=$accountId',
        fromJson: (json) => json,
        useCache: true,
        cacheDuration: const Duration(minutes: 2),
      );
    } catch (e) {
      if (kDebugMode) {
        print('Get account balance error: $e');
      }
      return ApiResponse<Map<String, dynamic>>.error(
        error: 'Failed to get account balance: $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse<List<Map<String, dynamic>>>> getAccountHistory({
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

      return await get<List<Map<String, dynamic>>>(
        ApiEndpointsAppBank.accountHistory,
        queryParameters: queryParams,
        fromJson: (json) => List<Map<String, dynamic>>.from(json),
        useCache: true,
        cacheDuration: const Duration(minutes: 1),
      );
    } catch (e) {
      if (kDebugMode) {
        print('Get account history error: $e');
      }
      return ApiResponse<List<Map<String, dynamic>>>.error(
        error: 'Failed to get account history: $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> getAccountDetails({
    required String accountId,
  }) async {
    try {
      return await get<Map<String, dynamic>>(
        '${ApiEndpointsAppBank.accountDetails}?account_id=$accountId',
        fromJson: (json) => json,
        useCache: true,
        cacheDuration: const Duration(minutes: 5),
      );
    } catch (e) {
      if (kDebugMode) {
        print('Get account details error: $e');
      }
      return ApiResponse<Map<String, dynamic>>.error(
        error: 'Failed to get account details: $e',
        statusCode: 500,
      );
    }
  }

  // Transaction operations
  Future<ApiResponse<List<Map<String, dynamic>>>> getTransactions({
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

      return await get<List<Map<String, dynamic>>>(
        ApiEndpointsAppBank.transactions,
        queryParameters: queryParams,
        fromJson: (json) => List<Map<String, dynamic>>.from(json),
        useCache: true,
        cacheDuration: const Duration(minutes: 1),
      );
    } catch (e) {
      if (kDebugMode) {
        print('Get transactions error: $e');
      }
      return ApiResponse<List<Map<String, dynamic>>>.error(
        error: 'Failed to get transactions: $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> createTransfer({
    required String toAccount,
    required double amount,
    String? description,
    String? transferType,
  }) async {
    try {
      final requestBody = ApiDataModelsAppBank.transferRequest(
        toAccount: toAccount,
        amount: amount,
        description: description,
        transferType: transferType,
      );

      return await post<Map<String, dynamic>>(
        ApiEndpointsAppBank.transfer,
        body: requestBody,
        fromJson: (json) => json,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Create transfer error: $e');
      }
      return ApiResponse<Map<String, dynamic>>.error(
        error: 'Transfer failed: $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> createPayment({
    required String payeeId,
    required double amount,
    required String paymentMethod,
    String? description,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final requestBody = ApiDataModelsAppBank.paymentRequest(
        payeeId: payeeId,
        amount: amount,
        paymentMethod: paymentMethod,
        description: description,
        metadata: metadata,
      );

      return await post<Map<String, dynamic>>(
        ApiEndpointsAppBank.payment,
        body: requestBody,
        fromJson: (json) => json,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Create payment error: $e');
      }
      return ApiResponse<Map<String, dynamic>>.error(
        error: 'Payment failed: $e',
        statusCode: 500,
      );
    }
  }

  // Utility methods
  Future<String> _getDeviceName() async {
    try {
      // This would typically use device_info_plus package
      if (kIsWeb) return 'Web Browser';
      if (defaultTargetPlatform == TargetPlatform.android) return 'Android Device';
      if (defaultTargetPlatform == TargetPlatform.iOS) return 'iOS Device';
      if (defaultTargetPlatform == TargetPlatform.windows) return 'Windows Device';
      if (defaultTargetPlatform == TargetPlatform.macOS) return 'macOS Device';
      if (defaultTargetPlatform == TargetPlatform.linux) return 'Linux Device';
      return 'Unknown Device';
    } catch (e) {
      return 'Unknown Device';
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

  // Batch operations for efficiency
  Future<List<ApiResponse<Map<String, dynamic>>>> batchRequest(
    List<Map<String, dynamic>> requests,
  ) async {
    final results = <ApiResponse<Map<String, dynamic>>>[];
    
    for (final request in requests) {
      try {
        final method = request['method'] as String;
        final endpoint = request['endpoint'] as String;
        final body = request['body'] as Map<String, dynamic>?;
        final headers = request['headers'] as Map<String, String>?;
        
        ApiResponse<Map<String, dynamic>> response;
        
        switch (method.toUpperCase()) {
          case 'GET':
            response = await get<Map<String, dynamic>>(
              endpoint,
              headers: headers,
              fromJson: (json) => json,
            );
            break;
          case 'POST':
            response = await post<Map<String, dynamic>>(
              endpoint,
              body: body,
              headers: headers,
              fromJson: (json) => json,
            );
            break;
          case 'PUT':
            response = await put<Map<String, dynamic>>(
              endpoint,
              body: body,
              headers: headers,
              fromJson: (json) => json,
            );
            break;
          case 'DELETE':
            response = await delete<Map<String, dynamic>>(
              endpoint,
              headers: headers,
              fromJson: (json) => json,
            );
            break;
          default:
            response = ApiResponse<Map<String, dynamic>>.error(
              error: 'Unsupported HTTP method: $method',
              statusCode: 400,
            );
        }
        
        results.add(response);
      } catch (e) {
        results.add(ApiResponse<Map<String, dynamic>>.error(
          error: 'Batch request failed: $e',
          statusCode: 500,
        ));
      }
    }
    
    return results;
  }
}
