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

/// Travel App Configuration
/// Contains app-specific configuration settings and constants
class TravelAppConfig {
  static const String appId = 'travel';
  static const String appName = 'Travel App';
  static const String appNameEn = 'Qunar Travel';
  static const String appNameZh = '去哪儿旅行';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'Tourism and travel guide application';

  // API Configuration
  static const String baseUrl = 'https://api.travel.com';
  static const String apiVersion = 'v1';
  static const String apiTimeout = '30000'; // milliseconds

  // Feature Flags
  static const bool enableOfflineMode = true;
  static const bool enableImageCaching = true;
  static const bool enableLocationServices = true;
  static const bool enableMapIntegration = true;
  static const bool enableFavorites = true;
  static const bool enableSocialSharing = true;
  static const bool enableReviews = true;
  static const bool enableBookmarks = true;

  // UI Configuration
  static const String defaultTheme = 'light';
  static const String defaultLanguage = 'en';
  static const int itemsPerPage = 20;
  static const int maxCacheSize = 200; // MB

  // Content Configuration
  static const int imageCompressionQuality = 85;
  static const List<String> supportedImageFormats = ['jpg', 'jpeg', 'png', 'webp'];

  // Map Configuration
  static const double defaultMapZoom = 14.0;
  static const double maxMapZoom = 20.0;
  static const double minMapZoom = 3.0;

  // Search Configuration
  static const int minSearchLength = 2;
  static const int maxSearchResults = 50;
  static const int searchDebounceMs = 300;

  // Performance Configuration
  static const bool enableImageOptimization = true;
  static const bool enableDataCompression = true;
  static const int networkRetryAttempts = 3;
  static const int imageCacheMaxAge = 7; // days

  // Debug Configuration
  static const bool enableDebugMode = false;
  static const bool enableLogging = true;
  static const String logLevel = 'info';

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
    'offlineMode': enableOfflineMode,
    'imageCaching': enableImageCaching,
    'locationServices': enableLocationServices,
    'mapIntegration': enableMapIntegration,
    'favorites': enableFavorites,
    'socialSharing': enableSocialSharing,
    'reviews': enableReviews,
    'bookmarks': enableBookmarks,
    'imageOptimization': enableImageOptimization,
    'dataCompression': enableDataCompression,
    'debugMode': enableDebugMode,
    'logging': enableLogging,
  };

  // Check if feature is enabled
  static bool isFeatureEnabled(String feature) {
    return featureFlags[feature] ?? false;
  }

  // Check if file format is supported
  static bool isImageFormatSupported(String extension) {
    return supportedImageFormats.contains(extension.toLowerCase());
  }
}
