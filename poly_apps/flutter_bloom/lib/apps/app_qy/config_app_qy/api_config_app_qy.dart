import 'package:qyflutter/common/network/models/api_config.dart';
import 'package:qyflutter/common/network/core/multi_endpoint_discovery.dart';

class ApiConfigAppQy {
  static const String defaultBaseUrl = 'http://192.168.50.2:9000/api/app_qy_v1';
  static const String _prodBaseUrl = defaultBaseUrl;
  static const String _devBaseUrl = defaultBaseUrl;

  /// Multi-endpoint configuration for app_qy
  /// Hardcoded in app configuration area as per architecture requirements
  static List<EndpointConfig> get endpointConfigs => const [
        EndpointConfig(
          id: 'primary',
          url: 'api.si.12gm.com',
          protocol: 'https',
          priority: 1,
          description: 'Primary API Server',
          isLocal: false,
        ),
        EndpointConfig(
          id: 'secondary',
          url: 'api.si.15gm.com',
          protocol: 'https',
          priority: 2,
          description: 'Secondary API Server',
          isLocal: false,
        ),
        EndpointConfig(
          id: 'local',
          url: '192.168.50.2',
          protocol: 'http',
          port: 9000,
          priority: 3,
          description: 'Local Development Server',
          isLocal: true,
        ),
      ];

  /// Get main API config with discovered base URL
  /// Falls back to default if discovery hasn't completed
  static ApiConfig get mainApi {
    final discovery = MultiEndpointDiscovery();
    final baseUrl =
        discovery.getAvailableBaseUrl(path: 'api/app_qy_v1') ?? _prodBaseUrl;

    return ApiConfig.jwtAuth(
      baseUrl: baseUrl,
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
  }

  /// Get public API config with discovered base URL
  static ApiConfig get publicApi {
    final discovery = MultiEndpointDiscovery();
    final baseUrl =
        discovery.getAvailableBaseUrl(path: 'api/app_qy_v1') ?? _prodBaseUrl;

    return ApiConfig.noAuth(
      baseUrl: baseUrl,
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
  }

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

  static Map<String, dynamic> parseUserFromResponse(
      Map<String, dynamic> response) {
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
    return response['token'] ??
        response['access_token'] ??
        response['auth_token'];
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
