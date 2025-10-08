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
  static const String baseUrl = 'https://api.wuy.example.com';
  static const String apiVersion = 'v1';
  static const String apiTimeout = '30000'; // milliseconds
  
  
  /// Base API URL for development
  static const String apiBaseUrlDev = 'https://api.anwuyou.test/api/v1';
  
  /// Base API URL for staging
  static const String apiBaseUrlStaging = 'https://api.anwuyou.test/api/v1';
  
  /// Base API URL for production
  static const String apiBaseUrlProd = 'https://api.anwuyou.test/api/v1';
  
  /// API timeout in seconds
  static const int apiTimeoutSeconds = 30;
  
  /// API retry attempts
  static const int apiRetryAttempts = 3;
  
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
  static const int networkRetryAttempts = 3;

  // Debug Configuration
  static const bool enableDebugMode = false;
  
  
  /// Local storage box name
  static const String storageBoxName = 'wuy_app_storage';
  
  /// Cache expiration time in hours
  static const int cacheExpirationHours = 24;
  
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
    'logging': enableLogging,
  };

  // Check if feature is enabled
  static bool isFeatureEnabled(String feature) {
    return getFeatureFlags()[feature] ?? false;
  }

  // Get feature flags for main entry
  static Map<String, bool> get featureFlags => getFeatureFlags();
}