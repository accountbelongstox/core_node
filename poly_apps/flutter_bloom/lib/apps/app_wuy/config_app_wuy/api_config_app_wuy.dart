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
import 'app_config_app_wuy.dart';
import 'api_endpoints_app_wuy.dart';

/// API Configuration for Wuy App
/// Provides API configuration and data parsing methods
class ApiConfigAppWuy {
  
  
  /// Development API configuration
  static ApiConfig get devApiConfig => ApiConfig.jwtAuth(
    baseUrl: AppConfigAppWuy.enableNewApiIntegration && !AppConfigAppWuy.forceLegacyApi
        ? AppConfigAppWuy.apiBaseUrlDev
        : AppConfigAppWuy.legacyApiBaseUrlDev,
    timeoutSeconds: AppConfigAppWuy.apiTimeoutSeconds,
    enableLogging: AppConfigAppWuy.enableLogging,
    defaultHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-App-Version': AppConfigAppWuy.appVersion,
      'X-App-ID': AppConfigAppWuy.appId,
    },
  );
  
  /// Production API configuration
  static ApiConfig get prodApiConfig => ApiConfig.jwtAuth(
    baseUrl: AppConfigAppWuy.enableNewApiIntegration && !AppConfigAppWuy.forceLegacyApi
        ? AppConfigAppWuy.apiBaseUrlProd
        : AppConfigAppWuy.legacyApiBaseUrlProd,
    timeoutSeconds: AppConfigAppWuy.apiTimeoutSeconds,
    enableLogging: false, // Disable logging in production
    defaultHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-App-Version': AppConfigAppWuy.appVersion,
      'X-App-ID': AppConfigAppWuy.appId,
    },
  );
  
  /// Current API configuration (based on environment)
  static ApiConfig get currentApiConfig {
    // In production, you might check build configuration
    return devApiConfig;
  }
  
  
  /// Authentication endpoints configuration
  static Map<String, String> get authEndpoints => {
    'login': ApiEndpointsAppWuy.authLogin,
    'register': ApiEndpointsAppWuy.authRegister,
    'logout': ApiEndpointsAppWuy.authLogout,
    'refresh': ApiEndpointsAppWuy.authRefresh,
    'profile': ApiEndpointsAppWuy.userProfile,
  };
  
  
  /// Parse user data from API response
  static Map<String, dynamic>? parseUserFromResponse(Map<String, dynamic> response) {
    try {
      // Handle different response structures
      if (response.containsKey('user')) {
        return response['user'] as Map<String, dynamic>?;
      } else if (response.containsKey('data') && response['data'] is Map) {
        final data = response['data'] as Map<String, dynamic>;
        if (data.containsKey('user')) {
          return data['user'] as Map<String, dynamic>?;
        }
        return data;
      }
      return response;
    } catch (e) {
      return null;
    }
  }
  
  /// Extract token from API response
  static String? extractTokenFromResponse(Map<String, dynamic> response) {
    try {
      // Try different possible token locations
      if (response.containsKey('token')) {
        return response['token'] as String?;
      } else if (response.containsKey('access_token')) {
        return response['access_token'] as String?;
      } else if (response.containsKey('data')) {
        final data = response['data'] as Map<String, dynamic>?;
        if (data != null) {
          return data['token'] as String? ?? data['access_token'] as String?;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  
  /// Extract token type from API response
  static String? extractTokenTypeFromResponse(Map<String, dynamic> response) {
    try {
      if (response.containsKey('token_type')) {
        return response['token_type'] as String?;
      } else if (response.containsKey('data')) {
        final data = response['data'] as Map<String, dynamic>?;
        return data?['token_type'] as String?;
      }
      return 'Bearer'; // Default token type
    } catch (e) {
      return 'Bearer';
    }
  }
  
  /// Extract token expiration from API response
  static DateTime? extractExpirationFromResponse(Map<String, dynamic> response) {
    try {
      String? expiresIn;
      String? expiresAt;
      
      if (response.containsKey('expires_in')) {
        expiresIn = response['expires_in']?.toString();
      } else if (response.containsKey('expires_at')) {
        expiresAt = response['expires_at']?.toString();
      } else if (response.containsKey('data')) {
        final data = response['data'] as Map<String, dynamic>?;
        if (data != null) {
          expiresIn = data['expires_in']?.toString();
          expiresAt = data['expires_at']?.toString();
        }
      }
      
      if (expiresAt != null) {
        return DateTime.tryParse(expiresAt);
      } else if (expiresIn != null) {
        final seconds = int.tryParse(expiresIn);
        if (seconds != null) {
          return DateTime.now().add(Duration(seconds: seconds));
        }
      }
      
      // Default expiration: 1 hour from now
      return DateTime.now().add(Duration(hours: 1));
    } catch (e) {
      return DateTime.now().add(Duration(hours: 1));
    }
  }
  
  /// Extract message from API response
  static String? extractMessageFromResponse(Map<String, dynamic> response) {
    try {
      if (response.containsKey('message')) {
        return response['message'] as String?;
      } else if (response.containsKey('msg')) {
        return response['msg'] as String?;
      } else if (response.containsKey('data')) {
        final data = response['data'] as Map<String, dynamic>?;
        return data?['message'] as String? ?? data?['msg'] as String?;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  
  /// Extract error from API response
  static String? extractErrorFromResponse(Map<String, dynamic> response) {
    try {
      if (response.containsKey('error')) {
        final error = response['error'];
        if (error is String) {
          return error;
        } else if (error is Map) {
          return (error as Map<String, dynamic>)['message'] as String?;
        }
      } else if (response.containsKey('errors')) {
        final errors = response['errors'];
        if (errors is List && errors.isNotEmpty) {
          return errors.first.toString();
        } else if (errors is Map) {
          final errorMap = errors as Map<String, dynamic>;
          return errorMap.values.first.toString();
        }
      } else if (response.containsKey('message')) {
        return response['message'] as String?;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  
  
  /// Validate API response structure
  static bool isValidResponse(Map<String, dynamic> response) {
    return response.containsKey('success') || 
           response.containsKey('data') || 
           response.containsKey('error');
  }
  
  /// Check if response indicates success
  static bool isSuccessResponse(Map<String, dynamic> response) {
    if (response.containsKey('success')) {
      return response['success'] == true;
    }
    // If no success field, assume success if no error
    return !response.containsKey('error');
  }
}