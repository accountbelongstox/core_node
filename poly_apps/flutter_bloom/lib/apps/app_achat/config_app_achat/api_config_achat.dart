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

/// API Configuration for AChat app connecting to BankV1 backend
/// Cross-app data consistency with Laravel BankV1 backend
class ApiConfigAChat {
  static const String baseUrl = 'https://api.si.12gm.com';
  static const String basePath = '/api/bank';
  
  /// Test app configuration - no authentication required
  static ApiConfig get testApiConfig => ApiConfig.noAuth(
    baseUrl: baseUrl,
    timeoutSeconds: 30,
    enableLogging: true,
    responseValidation: ResponseValidationConfig.laravelConfig(),
  );
  
  /// Device tracking configuration for app lifecycle
  static ApiConfig get deviceTrackingConfig => ApiConfig.custom(
    baseUrl: baseUrl,
    customHeaders: {
      'X-Device-ID': '', // Will be set dynamically
      'X-App-Signature': '', // Will be set dynamically
      'X-Platform': 'flutter',
      'X-App-Version': '1.0.0',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeoutSeconds: 30,
    enableLogging: true,
    responseValidation: ResponseValidationConfig.laravelConfig(),
  );
}

/// API Endpoints for AChat app - mapped to BankV1 backend
class ApiEndpointsAChat {
  // App lifecycle endpoints (no auth required for test app)
  static const String appOpen = '/api/bank/app/open';
  static const String appClose = '/api/bank/app/close';
  static const String appHeartbeat = '/api/bank/app/heartbeat';
  
  // User management endpoints (test app specific)
  static const String userProfile = '/api/bank/user/profile';
  static const String updateProfile = '/api/bank/user/profile/update';
  static const String updateBalance = '/api/bank/user/balance/update';
  
  // Security endpoints
  static const String deviceCheck = '/api/bank/security/device/check';
  static const String deviceRegister = '/api/bank/security/device/register';
  static const String deviceUpdate = '/api/bank/security/device/update';
  
  // Test app specific endpoints
  static const String generateTestData = '/api/bank/test/generate';
  static const String uploadTestInfo = '/api/bank/test/upload';
}

/// Request models for AChat API calls
class AChatApiModels {
  /// App open request model
  static Map<String, dynamic> appOpenRequest({
    required String deviceId,
    required String appSignature,
    required int timestamp,
    String? appVersion,
    String? platform,
  }) {
    return {
      'device_id': deviceId,
      'app_signature': appSignature,
      'timestamp': timestamp,
      'event_type': 'app_open',
      'app_version': appVersion ?? '1.0.0',
      'platform': platform ?? 'flutter',
    };
  }
  
  /// App close request model
  static Map<String, dynamic> appCloseRequest({
    required String deviceId,
    required String appSignature,
    required int timestamp,
    int? sessionDuration,
  }) {
    return {
      'device_id': deviceId,
      'app_signature': appSignature,
      'timestamp': timestamp,
      'event_type': 'app_close',
      'session_duration': sessionDuration,
    };
  }
  
  /// Heartbeat request model
  static Map<String, dynamic> heartbeatRequest({
    required int timestamp,
    int? sessionDuration,
  }) {
    return {
      'timestamp': timestamp,
      'session_duration': sessionDuration,
    };
  }
  
  /// Profile update request model
  static Map<String, dynamic> profileUpdateRequest({
    String? fullName,
    String? email,
    String? phone,
    String? dateOfBirth,
    String? gender,
    required String updatedAt,
  }) {
    final Map<String, dynamic> data = {
      'updated_at': updatedAt,
    };
    
    if (fullName != null) data['full_name'] = fullName;
    if (email != null) data['email'] = email;
    if (phone != null) data['phone'] = phone;
    if (dateOfBirth != null) data['date_of_birth'] = dateOfBirth;
    if (gender != null) data['gender'] = gender;
    
    return data;
  }
  
  /// Balance update request model
  static Map<String, dynamic> balanceUpdateRequest({
    required double newBalance,
    required String reason,
    required String updatedAt,
    String? transactionId,
  }) {
    return {
      'new_balance': newBalance,
      'reason': reason,
      'updated_at': updatedAt,
      'transaction_id': transactionId,
    };
  }
  
  /// Test data generation request model
  static Map<String, dynamic> generateTestDataRequest({
    required String dataType,
    int? count,
    Map<String, dynamic>? parameters,
  }) {
    return {
      'data_type': dataType,
      'count': count ?? 1,
      'parameters': parameters ?? {},
    };
  }
  
  /// Test info upload request model
  static Map<String, dynamic> uploadTestInfoRequest({
    required String infoType,
    required Map<String, dynamic> data,
    required String timestamp,
  }) {
    return {
      'info_type': infoType,
      'data': data,
      'timestamp': timestamp,
    };
  }
}

/// Response models for AChat API responses
class AChatApiResponses {
  /// Standard API response structure
  static bool isSuccessResponse(Map<String, dynamic> response) {
    return response['success'] == true;
  }
  
  /// Extract data from response
  static T? extractData<T>(Map<String, dynamic> response) {
    if (isSuccessResponse(response)) {
      return response['data'] as T?;
    }
    return null;
  }
  
  /// Extract error message from response
  static String extractErrorMessage(Map<String, dynamic> response) {
    return response['message'] as String? ?? 'Unknown error occurred';
  }
  
  /// Extract error code from response
  static String? extractErrorCode(Map<String, dynamic> response) {
    return response['error_code'] as String?;
  }
}

/// Device information helper
class AChatDeviceInfo {
  static String? _deviceId;
  static String? _appSignature;
  
  static String get deviceId => _deviceId ?? _generateDeviceId();
  static String get appSignature => _appSignature ?? _generateAppSignature();
  
  static void setDeviceId(String deviceId) {
    _deviceId = deviceId;
  }
  
  static void setAppSignature(String signature) {
    _appSignature = signature;
  }
  
  static String _generateDeviceId() {
    // Generate a unique device ID for test app
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return 'achat_test_${timestamp}_${timestamp.hashCode.abs()}';
  }
  
  static String _generateAppSignature() {
    // Generate app signature for security
    final deviceId = _deviceId ?? _generateDeviceId();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return 'achat_sig_${deviceId.hashCode.abs()}_$timestamp';
  }
  
  static int get currentTimestamp => DateTime.now().millisecondsSinceEpoch;
}
