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

/// QY App Configuration
/// Contains app-specific configuration settings and constants
class QyAppConfig {
  static const String appId = 'qy';
  static const String appName = 'QY App';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'QY application for demonstration';

  // API Configuration
  static const String baseUrl = 'https://api.example.com';
  static const String apiVersion = 'v1';
  static const String apiTimeout = '30000'; // milliseconds

  // Feature Flags
  static const bool enableAnalytics = true;
  static const bool enableCrashReporting = true;
  static const bool enablePushNotifications = true;
  static const bool enableOfflineMode = false;
  static const bool enableBiometricAuth = false;

  // UI Configuration
  static const String defaultTheme = 'light';
  static const String defaultLanguage = 'en';
  static const int itemsPerPage = 20;
  static const int maxCacheSize = 100; // MB

  // Social Features
  static const bool enableSocialSharing = true;
  static const bool enableComments = true;
  static const bool enableLikes = true;
  static const bool enableFollowing = true;

  // Security Configuration
  static const int sessionTimeoutMinutes = 30;
  static const int maxLoginAttempts = 5;
  static const bool requireStrongPassword = true;
  static const bool enableTwoFactorAuth = false;

  // Content Configuration
  static const int maxFileUploadSizeMB = 50;
  static const List<String> supportedImageFormats = ['jpg', 'jpeg', 'png', 'gif'];
  static const List<String> supportedVideoFormats = ['mp4', 'mov', 'avi'];
  static const List<String> supportedDocumentFormats = ['pdf', 'doc', 'docx', 'txt'];

  // Notification Configuration
  static const bool enableInAppNotifications = true;
  static const bool enableEmailNotifications = true;
  static const bool enableSMSNotifications = false;
  static const int notificationRetentionDays = 30;

  // Performance Configuration
  static const int imageCompressionQuality = 80;
  static const bool enableImageCaching = true;
  static const bool enableDataCompression = true;
  static const int networkRetryAttempts = 3;

  // Debug Configuration
  static const bool enableDebugMode = false;
  static const bool enableLogging = true;
  static const String logLevel = 'info'; // debug, info, warning, error

  // Get full API URL
  static String get fullApiUrl => '$baseUrl/$apiVersion';

  // Get app info
  static Map<String, dynamic> get appInfo => {
    'id': appId,
    'name': appName,
    'version': appVersion,
    'description': appDescription,
  };

  // Get feature flags
  static Map<String, bool> get featureFlags => {
    'analytics': enableAnalytics,
    'crashReporting': enableCrashReporting,
    'pushNotifications': enablePushNotifications,
    'offlineMode': enableOfflineMode,
    'biometricAuth': enableBiometricAuth,
    'socialSharing': enableSocialSharing,
    'comments': enableComments,
    'likes': enableLikes,
    'following': enableFollowing,
    'inAppNotifications': enableInAppNotifications,
    'emailNotifications': enableEmailNotifications,
    'smsNotifications': enableSMSNotifications,
    'imageCaching': enableImageCaching,
    'dataCompression': enableDataCompression,
    'debugMode': enableDebugMode,
    'logging': enableLogging,
  };

  // Get supported file formats
  static Map<String, List<String>> get supportedFormats => {
    'images': supportedImageFormats,
    'videos': supportedVideoFormats,
    'documents': supportedDocumentFormats,
  };

  // Check if feature is enabled
  static bool isFeatureEnabled(String feature) {
    return featureFlags[feature] ?? false;
  }

  // Check if file format is supported
  static bool isFileFormatSupported(String extension, String type) {
    final formats = supportedFormats[type];
    return formats?.contains(extension.toLowerCase()) ?? false;
  }
}
