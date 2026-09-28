/// AChat application constants
/// Defines app-specific constants and configuration values
class AppConstants {
  const AppConstants();
  
  // App information
  static const String appName = 'AChat';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'AI Chat Application';
  
  // API configuration
  static const String baseUrl = 'https://api.achat.com';
  static const String apiVersion = 'v1';
  static const int timeoutSeconds = 30;
  
  // Feature flags
  static const bool enableChatHistory = true;
  static const bool enableVoiceInput = true;
  static const bool enableImageGeneration = false;
  
  // UI constants - Use ThemeDimensions instead of hardcoded values
  // static const double defaultPadding = 16.0; // Use ThemeDimensions.paddingM
  // static const double defaultRadius = 8.0;   // Use ThemeDimensions.radiusMedium
  // static const double defaultElevation = 2.0; // Use ThemeDimensions.cardElevation
  
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

  // SharedPreferences configuration
  static const String prefsPrefix = 'achat_';
  static const String prefsName = 'achat_prefs';
}
