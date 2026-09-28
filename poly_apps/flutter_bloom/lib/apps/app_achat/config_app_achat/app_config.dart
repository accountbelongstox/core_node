/// AChat App Configuration
/// Defines app-specific configuration values following the standard pattern
class AChatAppConfig {
  // App identification
  static const String appName = 'AChat';
  static const String appId = 'achat';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'AI Chat Application';
  
  // Fix: Device identification (should be generated per device in production)
  static String get deviceId => 'achat_test_device_${DateTime.now().millisecondsSinceEpoch}';

  // Feature flags
  static const bool enableAnalytics = true;
  static const bool enableCrashReporting = true;
  static const bool enablePushNotifications = true;
  static const bool enableOfflineMode = true;
  static const bool enableBiometricAuth = false;
  static const bool enableVoiceInput = true;
  static const bool enableImageGeneration = false;

  // API configuration - Cross-app data consistency with BankV1 backend
  static const String baseUrl = 'https://api.si.12gm.com';
  static const String apiBasePath = '/api/bank';
  static const String apiVersion = 'v1';
  static const int timeoutSeconds = 30;

  // Test app specific configuration
  static const bool isTestApp = true;
  static const bool requiresAuthentication = false; // Test app doesn't need login

  // Chat configuration
  static const int maxMessageLength = 1000;
  static const int maxHistoryItems = 100;
  static const Duration typingIndicatorDelay = Duration(milliseconds: 500);

  // Storage keys
  static const String userPreferencesKey = 'achat_user_preferences';
  static const String chatHistoryKey = 'achat_chat_history';
  static const String settingsKey = 'achat_settings';

  // Error messages
  static const String networkErrorMessage = 'Network connection error';
  static const String serverErrorMessage = 'Server error occurred';
  static const String unknownErrorMessage = 'An unknown error occurred';

  /// Get app configuration map
  static Map<String, dynamic> getConfig() {
    return {
      'appId': appId,
      'appTitle': appName,
      'appVersion': appVersion,
      'enableFeatures': [
        if (enableAnalytics) 'analytics',
        if (enableCrashReporting) 'crashReporting',
        if (enablePushNotifications) 'pushNotifications',
        if (enableOfflineMode) 'offlineMode',
        if (enableBiometricAuth) 'biometricAuth',
        if (enableVoiceInput) 'voiceInput',
        if (enableImageGeneration) 'imageGeneration',
      ],
    };
  }
}
