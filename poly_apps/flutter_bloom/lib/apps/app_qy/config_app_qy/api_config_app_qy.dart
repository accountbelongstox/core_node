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

import 'package:qyflutter/common/network/models/api_config.dart';
import 'api_endpoints_app_qy.dart';
import 'api_data_models_app_qy.dart';

/// API configuration for app_qy
/// This defines the API settings and user data structure for the qy app
class ApiConfigAppQy {
  /// Main API configuration for authenticated requests
  static ApiConfig get mainApi => ApiConfig.jwtAuth(
    baseUrl: 'https://api.example.com/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer',
    cacheTimeout: const Duration(minutes: 30),
    defaultHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Version': '1.0.0',
      'X-Platform': 'flutter',
    },
    timeoutSeconds: 30,
    enableLogging: true,
    responseValidation: ResponseValidationConfig.custom(
      successStatusCodes: [200, 201, 202],
      authFailureStatusCodes: [401, 403],
      successField: 'success',
      errorField: 'error',
      messageField: 'message',
    ),
  );

  /// Public API configuration for non-authenticated requests
  static ApiConfig get publicApi => ApiConfig.noAuth(
    baseUrl: 'https://public.example.com/v1',
    cacheTimeout: const Duration(hours: 2), // Longer cache for public content
    defaultHeaders: {
      'Accept': 'application/json',
      'X-App-Version': '1.0.0',
      'X-Platform': 'flutter',
    },
    timeoutSeconds: 15,
    enableLogging: true,
    responseValidation: ResponseValidationConfig.defaultConfig(),
  );

  /// CDN API configuration for static assets
  static ApiConfig get cdnApi => ApiConfig.noAuth(
    baseUrl: 'https://cdn.example.com',
    cacheTimeout: const Duration(hours: 24), // Very long cache for static assets
    defaultHeaders: {
      'Accept': '*/*',
    },
    timeoutSeconds: 60, // Longer timeout for large files
    enableLogging: false, // Disable logging for CDN requests
    responseValidation: ResponseValidationConfig.defaultConfig(),
  );

  /// Development API configuration (for testing)
  static ApiConfig get devApi => ApiConfig.jwtAuth(
    baseUrl: 'http://localhost:8000/api/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer',
    cacheTimeout: const Duration(minutes: 1), // Short cache for development
    defaultHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Version': '1.0.0-dev',
      'X-Platform': 'flutter',
      'X-Debug': 'true',
    },
    timeoutSeconds: 60, // Longer timeout for development
    enableLogging: true,
    responseValidation: ResponseValidationConfig.laravelConfig(),
  );

  /// Authentication endpoints configuration
  static const Map<String, String> authEndpoints = {
    'login': '/auth/login',
    'register': '/auth/register',
    'logout': '/auth/logout',
    'refresh': '/auth/refresh',
    'forgotPassword': '/auth/forgot-password',
    'resetPassword': '/auth/reset-password',
  };

  /// User data structure definition for this app
  static Map<String, dynamic> parseUserFromResponse(Map<String, dynamic> response) {
    // Extract user data from API response based on app-specific format
    final userData = response['user'] ?? response['data'];
    
    if (userData is Map<String, dynamic>) {
      return {
        'id': userData['id']?.toString() ?? '',
        'username': userData['username'] ?? '',
        'email': userData['email'] ?? '',
        'firstName': userData['first_name'],
        'lastName': userData['last_name'],
        'avatar': userData['avatar'],
        'phone': userData['phone'],
        'role': userData['role'] ?? 'user',
        'status': userData['status'] ?? 'active',
        'createdAt': userData['created_at'],
        'updatedAt': userData['updated_at'],
        'preferences': userData['preferences'],
        // App-specific fields
        'appSpecificData': userData['app_specific_data'],
      };
    }
    
    return {};
  }

  /// Extract token from response
  static String? extractTokenFromResponse(Map<String, dynamic> response) {
    return response['token'] ?? response['access_token'] ?? response['auth_token'];
  }

  /// Extract token type from response
  static String? extractTokenTypeFromResponse(Map<String, dynamic> response) {
    return response['token_type'] ?? 'Bearer';
  }

  /// Extract expiration from response
  static String? extractExpirationFromResponse(Map<String, dynamic> response) {
    return response['expiration']?.toString() ?? response['expires_at']?.toString();
  }

  /// Extract message from response
  static String? extractMessageFromResponse(Map<String, dynamic> response) {
    return response['message']?.toString();
  }

  /// Extract error message from response
  static String? extractErrorFromResponse(Map<String, dynamic> response) {
    return response['error']?.toString() ?? response['message']?.toString();
  }

  /// Get API config based on environment
  static ApiConfig getApiConfig({bool isDevelopment = false}) {
    return isDevelopment ? devApi : mainApi;
  }

  /// Get public API config based on environment
  static ApiConfig getPublicApiConfig({bool isDevelopment = false}) {
    if (isDevelopment) {
      return publicApi.copyWith(
        baseUrl: 'http://localhost:8000/public/v1',
        enableLogging: true,
      );
    }
    return publicApi;
  }

  /// Get CDN API config based on environment
  static ApiConfig getCdnApiConfig({bool isDevelopment = false}) {
    if (isDevelopment) {
      return cdnApi.copyWith(
        baseUrl: 'http://localhost:8000/cdn',
        enableLogging: true,
        cacheTimeout: const Duration(minutes: 1),
      );
    }
    return cdnApi;
  }
}

/// Environment-specific configuration
class AppEnvironmentConfig {
  static bool get isDevelopment {
    // You can implement environment detection logic here
    // For example, check for debug mode or environment variables
    return const bool.fromEnvironment('DEVELOPMENT', defaultValue: false);
  }

  static bool get isProduction => !isDevelopment;

  static String get environment => isDevelopment ? 'development' : 'production';

  /// Get the appropriate API config for current environment
  static ApiConfig get currentApiConfig => 
      ApiConfigAppQy.getApiConfig(isDevelopment: isDevelopment);

  static ApiConfig get currentPublicApiConfig => 
      ApiConfigAppQy.getPublicApiConfig(isDevelopment: isDevelopment);

  static ApiConfig get currentCdnApiConfig => 
      ApiConfigAppQy.getCdnApiConfig(isDevelopment: isDevelopment);
}
