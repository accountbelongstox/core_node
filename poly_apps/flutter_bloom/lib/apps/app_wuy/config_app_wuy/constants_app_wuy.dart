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

/// Constants for Wuy App
/// Contains app-specific constant values
class ConstantsAppWuy {
  
  
  /// Home route name
  static const String routeHome = '/wuy_home';
  
  /// Profile route name
  static const String routeProfile = '/wuy_profile';
  
  /// Settings route name
  static const String routeSettings = '/wuy_settings';
  
  /// Login route name
  static const String routeLogin = '/wuy_login';
  
  /// Register route name
  static const String routeRegister = '/wuy_register';
  
  
  /// User preferences storage key
  static const String storageKeyUserPrefs = 'wuy_user_preferences';
  
  /// App settings storage key
  static const String storageKeyAppSettings = 'wuy_app_settings';
  
  /// Cache data storage key
  static const String storageKeyCacheData = 'wuy_cache_data';
  
  /// User session storage key
  static const String storageKeyUserSession = 'wuy_user_session';
  
  
  /// User authentication endpoint
  static const String apiEndpointAuth = '/api/v1/auth';
  
  /// User profile endpoint
  static const String apiEndpointProfile = '/api/v1/profile';
  
  /// App data endpoint
  static const String apiEndpointData = '/api/v1/data';
  
  /// File upload endpoint
  static const String apiEndpointUpload = '/api/v1/upload';
  
  
  /// Default padding
  static const double paddingDefault = 16.0;
  
  /// Small padding
  static const double paddingSmall = 8.0;
  
  /// Large padding
  static const double paddingLarge = 24.0;
  
  /// Extra large padding
  static const double paddingExtraLarge = 32.0;
  
  /// Default border radius
  static const double borderRadiusDefault = 8.0;
  
  /// Small border radius
  static const double borderRadiusSmall = 4.0;
  
  /// Large border radius
  static const double borderRadiusLarge = 16.0;
  
  /// Button height
  static const double buttonHeight = 48.0;
  
  /// Input field height
  static const double inputFieldHeight = 56.0;
  
  /// App bar height
  static const double appBarHeight = 56.0;
  
  /// Bottom navigation height
  static const double bottomNavHeight = 60.0;
  
  
  /// Fast animation duration
  static const Duration animationFast = Duration(milliseconds: 150);
  
  /// Normal animation duration
  static const Duration animationNormal = Duration(milliseconds: 300);
  
  /// Slow animation duration
  static const Duration animationSlow = Duration(milliseconds: 500);
  
  /// Page transition duration
  static const Duration pageTransitionDuration = Duration(milliseconds: 250);
  
  
  /// Minimum password length
  static const int minPasswordLength = 8;
  
  /// Maximum password length
  static const int maxPasswordLength = 128;
  
  /// Minimum username length
  static const int minUsernameLength = 3;
  
  /// Maximum username length
  static const int maxUsernameLength = 50;
  
  /// Maximum file size in bytes (10MB)
  static const int maxFileSizeBytes = 10 * 1024 * 1024;
  
  
  /// Connection timeout in seconds
  static const int connectionTimeoutSeconds = 30;
  
  /// Read timeout in seconds
  static const int readTimeoutSeconds = 30;
  
  /// Write timeout in seconds
  static const int writeTimeoutSeconds = 30;
  
  /// Maximum retry attempts
  static const int maxRetryAttempts = 3;
  
  /// Retry delay in seconds
  static const int retryDelaySeconds = 2;
  
  
  /// Default cache duration in hours
  static const int defaultCacheDurationHours = 24;
  
  /// Image cache duration in hours
  static const int imageCacheDurationHours = 168; // 7 days
  
  /// API cache duration in minutes
  static const int apiCacheDurationMinutes = 30;
  
  
  /// Network error code
  static const String errorCodeNetwork = 'NETWORK_ERROR';
  
  /// Authentication error code
  static const String errorCodeAuth = 'AUTH_ERROR';
  
  /// Validation error code
  static const String errorCodeValidation = 'VALIDATION_ERROR';
  
  /// Server error code
  static const String errorCodeServer = 'SERVER_ERROR';
  
  /// Unknown error code
  static const String errorCodeUnknown = 'UNKNOWN_ERROR';
  
  
  /// Email validation regex
  static const String regexEmail = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  
  /// Phone number validation regex
  static const String regexPhone = r'^\+?[1-9]\d{1,14}$';
  
  /// Username validation regex (alphanumeric and underscore)
  static const String regexUsername = r'^[a-zA-Z0-9_]{3,50}$';
  
  /// Password validation regex (at least one letter, one number)
  static const String regexPassword = r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$';
}