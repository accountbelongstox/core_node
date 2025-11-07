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

/// Wuy App Configuration
/// Contains app-specific configuration settings and constants
class AppConfigAppWuy {
  static const String appId = 'wuy';
  static const String appName = 'Wuy App';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'Wuy test application';
  static const String buildNumber = '1';
  static const String packageName = 'com.example.wuy';

  // API Configuration
  static const String apiVersion = 'awy-v0'; // Updated to match backend API prefix
  static const String legacyApiVersion = 'v1'; // Keep for backward compatibility

  /// Base API URL for development (new API)
  static const String apiBaseUrlDev = 'https://api.anwuyou.test/api/awy-v0';

  /// Base API URL for staging (new API)
  static const String apiBaseUrlStaging = 'https://api.anwuyou.test/api/awy-v0';

  /// Base API URL for production (new API)
  static const String apiBaseUrlProd = 'https://api.anwuyou.com/api/awy-v0';

  /// Legacy API URL for development (fallback)
  static const String legacyApiBaseUrlDev = 'https://api.anwuyou.test/api/v1';

  /// Legacy API URL for staging (fallback)
  static const String legacyApiBaseUrlStaging = 'https://api.anwuyou.test/api/v1';

  /// Legacy API URL for production (fallback)
  static const String legacyApiBaseUrlProd = 'https://api.anwuyou.test/api/v1';

  /// API timeout in seconds
  static const int apiTimeoutSeconds = 30;

  /// API retry attempts
  static const int apiRetryAttempts = 3;

  // Tencent Maps Configuration
  // NOTE: Segments 3-6 need to be configured with actual API key segments
  // Obtain from Tencent Maps console: https://lbs.qq.com/console/mykey.html
  static const String _tencentMapKeySegment1 = 'WUYAPP';
  static const String _tencentMapKeySegment2 = '-TBZBZ-';
  static const String _tencentMapKeySegment3 = 'XXXXX-';
  static const String _tencentMapKeySegment4 = 'XXXXX-';
  static const String _tencentMapKeySegment5 = 'XXXXX-';
  static const String _tencentMapKeySegment6 = 'XXXXX-';
  static const String _tencentMapKeySegment7 = 'WUYKEY';

  static String _reconstructTencentMapKey() {
    return _tencentMapKeySegment1 +
        _tencentMapKeySegment2 +
        _tencentMapKeySegment3 +
        _tencentMapKeySegment4 +
        _tencentMapKeySegment5 +
        _tencentMapKeySegment6 +
        _tencentMapKeySegment7;
  }

  static String getTencentMapApiKey() {
    return _reconstructTencentMapKey();
  }

  static const bool enableTencentMaps = true;
  static const String defaultMapLanguage = 'zh-CN';
  static const String defaultMapRegion = 'CN';
  
  // Feature Flags
  static const bool enableAnalytics = true;
  static const bool enableCrashReporting = true;
  static const bool enablePushNotifications = true;
  static const bool enableOfflineMode = false;
  static const bool enableBiometricAuth = false;

  // UI Configuration
  static const String defaultTheme = 'light';
  static const String defaultThemeMode = 'system';
  static const String defaultLanguage = 'en';
  static const int itemsPerPage = 20;
  static const bool enableAnimations = true;
  static const int animationDurationMs = 300;
  static const int maxCacheSize = 100; // MB

  // Security Configuration
  static const int maxLoginAttempts = 5;
  static const bool requireStrongPassword = true;
  static const bool enableTwoFactorAuth = false;

  // Performance Configuration
  static const int imageCompressionQuality = 80;
  static const bool enableImageCaching = true;
  static const bool enableDataCompression = true;

  // UI Constants (merged from constants_app_wuy.dart)
  static const double paddingDefault = 16.0;
  static const double paddingSmall = 8.0;
  static const double paddingLarge = 24.0;
  static const double paddingExtraLarge = 32.0;
  static const double borderRadiusDefault = 8.0;
  static const double borderRadiusSmall = 4.0;
  static const double borderRadiusLarge = 16.0;
  static const double buttonHeight = 48.0;
  static const double inputFieldHeight = 56.0;
  static const double appBarHeight = 56.0;
  static const double bottomNavHeight = 60.0;

  // Animation Constants
  static const Duration animationFast = Duration(milliseconds: 150);
  static const Duration animationNormal = Duration(milliseconds: animationDurationMs);
  static const Duration animationSlow = Duration(milliseconds: 500);
  static const Duration pageTransitionDuration = Duration(milliseconds: 250);

  // Validation Constants
  static const int minPasswordLength = 8;
  static const int maxPasswordLength = 128;
  static const int minUsernameLength = 3;
  static const int maxUsernameLength = 50;
  static const int maxFileSizeBytes = 10 * 1024 * 1024; // 10MB

  // Network Constants (using apiTimeoutSeconds as base)
  static const int connectionTimeoutSeconds = apiTimeoutSeconds;
  static const int readTimeoutSeconds = apiTimeoutSeconds;
  static const int writeTimeoutSeconds = apiTimeoutSeconds;
  static const int retryDelaySeconds = 2;

  // Cache Constants
  static const int defaultCacheDurationHours = 24;
  static const int imageCacheDurationHours = 168; // 7 days
  static const int apiCacheDurationMinutes = 30;

  // Error Codes
  static const String errorCodeNetwork = 'NETWORK_ERROR';
  static const String errorCodeAuth = 'AUTH_ERROR';
  static const String errorCodeValidation = 'VALIDATION_ERROR';
  static const String errorCodeServer = 'SERVER_ERROR';
  static const String errorCodeUnknown = 'UNKNOWN_ERROR';

  // Validation Regex
  static const String regexEmail = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  static const String regexPhone = r'^\+?[1-9]\d{1,14}$';
  static const String regexUsername = r'^[a-zA-Z0-9_]{3,50}$';
  static const String regexPassword = r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$';

  // Debug Configuration
  static const bool enableDebugMode = true; // Set to true for development
  static const bool enableMockApi = true; // Enable mock API responses in debug mode
  static const bool enableNetworkLogging = true; // Enable network request logging

  // API Integration Configuration
  static const bool enableNewApiIntegration = true; // Enable awy-v0 API endpoints
  static const bool forceLegacyApi = false; // Force use of legacy v1 API even when new API is available
  
  
  /// Local storage box name
  static const String storageBoxName = 'wuy_app_storage';
  
  /// Storage keys (merged from constants_app_wuy.dart)
  static const String storageKeyUserPrefs = 'wuy_user_preferences';
  static const String storageKeyAppSettings = 'wuy_app_settings';
  static const String storageKeyCacheData = 'wuy_cache_data';
  static const String storageKeyUserSession = 'wuy_user_session';
  
  /// Maximum cache size in MB
  static const int maxCacheSizeMB = 100;
  
  
  /// Session timeout in minutes
  static const int sessionTimeoutMinutes = 30;
  
  /// Enable SSL pinning
  static const bool enableSSLPinning = false;
  
  
  /// Enable logging
  static const bool enableLogging = true;
  
  /// Log level (debug, info, warning, error)
  static const String logLevel = 'debug';
  
  /// Maximum log file size in MB
  static const int maxLogFileSizeMB = 10;
  
  
  /// Get current API base URL based on environment
  static String getCurrentApiBaseUrl() {
    // In production, you might check environment variables or build configuration
    // For now, return development URL
    return apiBaseUrlDev;
  }
  
  // Get full API URL
  static String get fullApiUrl => '${getCurrentApiBaseUrl()}/$apiVersion';

  // Get app info
  static Map<String, dynamic> get appInfo => {
    'id': appId,
    'name': appName,
    'version': appVersion,
    'description': appDescription,
  };

  // Get feature flags
  static Map<String, bool> getFeatureFlags() => {
    'analytics': enableAnalytics,
    'crashReporting': enableCrashReporting,
    'pushNotifications': enablePushNotifications,
    'offlineMode': enableOfflineMode,
    'biometricAuth': enableBiometricAuth,
    'imageCaching': enableImageCaching,
    'dataCompression': enableDataCompression,
    'debugMode': enableDebugMode,
    'mockApi': enableMockApi,
    'networkLogging': enableNetworkLogging,
    'logging': enableLogging,
  };

  // Check if feature is enabled
  static bool isFeatureEnabled(String feature) {
    return getFeatureFlags()[feature] ?? false;
  }

  // Get feature flags for main entry
  static Map<String, bool> get featureFlags => getFeatureFlags();
}