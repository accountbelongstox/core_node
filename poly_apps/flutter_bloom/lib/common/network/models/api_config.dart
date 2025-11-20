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

/// API configuration model for different apps
/// This defines the API settings for each app including authentication methods
class ApiConfig {
  final String baseUrl;
  final AuthenticationType authenticationType;
  final Duration cacheTimeout;
  final Map<String, String> defaultHeaders;
  final String? headerKey;
  final String? headerPrefix;
  final int timeoutSeconds;
  final bool enableLogging;
  final ResponseValidationConfig responseValidation;

  const ApiConfig({
    required this.baseUrl,
    required this.authenticationType,
    this.cacheTimeout = const Duration(minutes: 30),
    this.defaultHeaders = const {},
    this.headerKey,
    this.headerPrefix,
    this.timeoutSeconds = 30,
    this.enableLogging = true,
    required this.responseValidation,
  });

  /// Create API config for header-based authentication
  factory ApiConfig.headerAuth({
    required String baseUrl,
    required String headerKey,
    String headerPrefix = 'Bearer',
    Duration cacheTimeout = const Duration(minutes: 30),
    Map<String, String> defaultHeaders = const {},
    int timeoutSeconds = 30,
    bool enableLogging = true,
    ResponseValidationConfig? responseValidation,
  }) {
    return ApiConfig(
      baseUrl: baseUrl,
      authenticationType: AuthenticationType.headerKey,
      headerKey: headerKey,
      headerPrefix: headerPrefix,
      cacheTimeout: cacheTimeout,
      defaultHeaders: defaultHeaders,
      timeoutSeconds: timeoutSeconds,
      enableLogging: enableLogging,
      responseValidation: responseValidation ?? ResponseValidationConfig.defaultConfig(),
    );
  }

  /// Create API config for JWT authentication
  factory ApiConfig.jwtAuth({
    required String baseUrl,
    String headerKey = 'Authorization',
    String headerPrefix = 'Bearer',
    Duration cacheTimeout = const Duration(minutes: 30),
    Map<String, String> defaultHeaders = const {},
    int timeoutSeconds = 30,
    bool enableLogging = true,
    ResponseValidationConfig? responseValidation,
  }) {
    return ApiConfig(
      baseUrl: baseUrl,
      authenticationType: AuthenticationType.jwt,
      headerKey: headerKey,
      headerPrefix: headerPrefix,
      cacheTimeout: cacheTimeout,
      defaultHeaders: defaultHeaders,
      timeoutSeconds: timeoutSeconds,
      enableLogging: enableLogging,
      responseValidation: responseValidation ?? ResponseValidationConfig.defaultConfig(),
    );
  }

  /// Create API config for no authentication
  factory ApiConfig.noAuth({
    required String baseUrl,
    Duration cacheTimeout = const Duration(minutes: 30),
    Map<String, String> defaultHeaders = const {},
    int timeoutSeconds = 30,
    bool enableLogging = true,
    ResponseValidationConfig? responseValidation,
  }) {
    return ApiConfig(
      baseUrl: baseUrl,
      authenticationType: AuthenticationType.none,
      cacheTimeout: cacheTimeout,
      defaultHeaders: defaultHeaders,
      timeoutSeconds: timeoutSeconds,
      enableLogging: enableLogging,
      responseValidation: responseValidation ?? ResponseValidationConfig.defaultConfig(),
    );
  }

  /// Copy with new values
  ApiConfig copyWith({
    String? baseUrl,
    AuthenticationType? authenticationType,
    Duration? cacheTimeout,
    Map<String, String>? defaultHeaders,
    String? headerKey,
    String? headerPrefix,
    int? timeoutSeconds,
    bool? enableLogging,
    ResponseValidationConfig? responseValidation,
  }) {
    return ApiConfig(
      baseUrl: baseUrl ?? this.baseUrl,
      authenticationType: authenticationType ?? this.authenticationType,
      cacheTimeout: cacheTimeout ?? this.cacheTimeout,
      defaultHeaders: defaultHeaders ?? this.defaultHeaders,
      headerKey: headerKey ?? this.headerKey,
      headerPrefix: headerPrefix ?? this.headerPrefix,
      timeoutSeconds: timeoutSeconds ?? this.timeoutSeconds,
      enableLogging: enableLogging ?? this.enableLogging,
      responseValidation: responseValidation ?? this.responseValidation,
    );
  }

  @override
  String toString() {
    return 'ApiConfig(baseUrl: $baseUrl, authType: $authenticationType, timeout: ${timeoutSeconds}s)';
  }
}

/// Authentication types supported by the API client
enum AuthenticationType {
  none,       // No authentication required
  headerKey,  // Custom header key authentication
  jwt,        // JWT token authentication
  oauth,      // OAuth authentication (future extension)
  apiKey,     // API key authentication (future extension)
}

/// Response validation configuration
class ResponseValidationConfig {
  final List<int> successStatusCodes;
  final List<int> authFailureStatusCodes;
  final Map<String, dynamic>? successConditions;
  final Map<String, dynamic>? failureConditions;
  final String? successField;
  final String? errorField;
  final String? messageField;

  const ResponseValidationConfig({
    this.successStatusCodes = const [200, 201, 202],
    this.authFailureStatusCodes = const [401, 403],
    this.successConditions,
    this.failureConditions,
    this.successField,
    this.errorField,
    this.messageField,
  });

  /// Default configuration for most REST APIs
  factory ResponseValidationConfig.defaultConfig() {
    return const ResponseValidationConfig(
      successStatusCodes: [200, 201, 202],
      authFailureStatusCodes: [401, 403],
      successField: 'success',
      errorField: 'error',
      messageField: 'message',
    );
  }

  /// Laravel API configuration
  factory ResponseValidationConfig.laravelConfig() {
    return const ResponseValidationConfig(
      successStatusCodes: [200, 201, 202],
      authFailureStatusCodes: [401, 403],
      successField: 'status',
      errorField: 'error',
      messageField: 'message',
    );
  }

  /// Custom validation configuration
  factory ResponseValidationConfig.custom({
    List<int>? successStatusCodes,
    List<int>? authFailureStatusCodes,
    Map<String, dynamic>? successConditions,
    Map<String, dynamic>? failureConditions,
    String? successField,
    String? errorField,
    String? messageField,
  }) {
    return ResponseValidationConfig(
      successStatusCodes: successStatusCodes ?? [200, 201, 202],
      authFailureStatusCodes: authFailureStatusCodes ?? [401, 403],
      successConditions: successConditions,
      failureConditions: failureConditions,
      successField: successField,
      errorField: errorField,
      messageField: messageField,
    );
  }

  /// Check if response indicates success
  bool isSuccess(int statusCode, Map<String, dynamic>? responseBody) {
    // Check status code first
    if (!successStatusCodes.contains(statusCode)) {
      return false;
    }

    // Check response body conditions if specified
    if (responseBody != null) {
      // Check success field
      if (successField != null && responseBody.containsKey(successField)) {
        final successValue = responseBody[successField];
        if (successValue is bool && !successValue) return false;
        if (successValue is String && successValue.toLowerCase() != 'success') return false;
      }

      // Check custom success conditions
      if (successConditions != null) {
        for (final entry in successConditions!.entries) {
          if (responseBody[entry.key] != entry.value) {
            return false;
          }
        }
      }

      // Check failure conditions
      if (failureConditions != null) {
        for (final entry in failureConditions!.entries) {
          if (responseBody[entry.key] == entry.value) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /// Check if response indicates authentication failure
  bool isAuthFailure(int statusCode, Map<String, dynamic>? responseBody) {
    return authFailureStatusCodes.contains(statusCode);
  }

  /// Extract error message from response
  String? getErrorMessage(Map<String, dynamic>? responseBody) {
    if (responseBody == null) return null;
    
    if (messageField != null && responseBody.containsKey(messageField)) {
      return responseBody[messageField]?.toString();
    }
    
    if (errorField != null && responseBody.containsKey(errorField)) {
      final error = responseBody[errorField];
      if (error is String) return error;
      if (error is Map && error.containsKey('message')) {
        return error['message']?.toString();
      }
    }
    
    return null;
  }
}
