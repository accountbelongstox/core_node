import 'package:qyflutter/common/network/models/api_config.dart';

class ApiConfigAppQy {
  static const String _prodBaseUrl = 'http://192.168.50.2:9000/api/app_qy_v1';
  static const String _devBaseUrl = 'http://192.168.50.2:9000/api/app_qy_v1';
  
  static ApiConfig get mainApi => ApiConfig.jwtAuth(
    baseUrl: _prodBaseUrl,
    headerKey: 'Authorization',
    headerPrefix: 'Bearer',
    cacheTimeout: const Duration(minutes: 30),
    defaultHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Version': '1.0.0',
      'X-Platform': 'flutter',
      'X-App-Id': 'app_qy',
    },
    timeoutSeconds: 30,
    enableLogging: true,
    responseValidation: ResponseValidationConfig.laravelConfig(),
  );

  static ApiConfig get publicApi => ApiConfig.noAuth(
    baseUrl: _prodBaseUrl,
    cacheTimeout: const Duration(hours: 2),
    defaultHeaders: {
      'Accept': 'application/json',
      'X-App-Version': '1.0.0',
      'X-Platform': 'flutter',
      'X-App-Id': 'app_qy',
    },
    timeoutSeconds: 15,
    enableLogging: true,
    responseValidation: ResponseValidationConfig.laravelConfig(),
  );

  static ApiConfig get devApi => ApiConfig.jwtAuth(
    baseUrl: _devBaseUrl,
    headerKey: 'Authorization',
    headerPrefix: 'Bearer',
    cacheTimeout: const Duration(minutes: 1),
    defaultHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Version': '1.0.0-dev',
      'X-Platform': 'flutter',
      'X-App-Id': 'app_qy',
      'X-Debug': 'true',
    },
    timeoutSeconds: 60,
    enableLogging: true,
    responseValidation: ResponseValidationConfig.laravelConfig(),
  );

  static ApiConfig get ttsApi => ApiConfig.noAuth(
    baseUrl: 'http://192.168.50.2:9000/api/app_qy_v1/ai_tools/tts',
    cacheTimeout: const Duration(hours: 24),
    defaultHeaders: {
      'Accept': '*/*',
      'X-App-Id': 'app_qy',
    },
    timeoutSeconds: 60,
    enableLogging: false,
    responseValidation: ResponseValidationConfig.defaultConfig(),
  );

  static Map<String, dynamic> parseUserFromResponse(Map<String, dynamic> response) {
    final userData = response['user'] ?? response['data'];
    
    if (userData is Map<String, dynamic>) {
      return {
        'id': userData['id']?.toString() ?? '',
        'username': userData['username'] ?? '',
        'email': userData['email'] ?? '',
        'phone': userData['phone'],
        'avatar': userData['avatar'],
        'learningLanguages': userData['learning_languages'] ?? ['en'],
        'nativeLanguage': userData['native_language'] ?? 'zh',
        'createdAt': userData['created_at'],
        'updatedAt': userData['updated_at'],
        'preferences': userData['preferences'],
      };
    }
    
    return {};
  }

  static String? extractTokenFromResponse(Map<String, dynamic> response) {
    return response['token'] ?? response['access_token'] ?? response['auth_token'];
  }

  static String? extractTokenTypeFromResponse(Map<String, dynamic> response) {
    return response['token_type'] ?? 'Bearer';
  }

  static String? extractMessageFromResponse(Map<String, dynamic> response) {
    return response['message']?.toString();
  }

  static String? extractErrorFromResponse(Map<String, dynamic> response) {
    return response['error']?.toString() ?? response['message']?.toString();
  }

  static ApiConfig getApiConfig({bool isDevelopment = false}) {
    return isDevelopment ? devApi : mainApi;
  }
}

class AppEnvironmentConfig {
  static bool get isDevelopment {
    return const bool.fromEnvironment('DEVELOPMENT', defaultValue: true);
  }

  static bool get isProduction => !isDevelopment;

  static String get environment => isDevelopment ? 'development' : 'production';

  static ApiConfig get currentApiConfig => 
      ApiConfigAppQy.getApiConfig(isDevelopment: isDevelopment);
}
