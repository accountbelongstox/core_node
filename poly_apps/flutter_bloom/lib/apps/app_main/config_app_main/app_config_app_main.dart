/// Main App Configuration
/// Contains app-specific configuration constants and settings
class MainAppConfig {
  // App Identity
  static const String appName = 'Flutter Bloom - Main';
  static const String appId = 'main';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'Main aggregation app for Flutter Bloom project';
  
  // App specific settings
  static const bool isDebugMode = true;
  static const bool enableLogging = true;
  static const bool enableAnalytics = false;
  
  // Main app specific features
  static const bool enableAllAppsShowcase = true;
  static const bool enableAppSwitching = true;
  static const bool enableDeveloperMode = true;
  
  // Default routes
  static const String defaultRoute = '/main/home';
  static const String homeRoute = '/main/home';
  static const String showcaseRoute = '/main/showcase';
  static const String settingsRoute = '/main/settings';
  static const String aboutRoute = '/main/about';
  
  // App configuration map
  static Map<String, dynamic> getConfig() {
    return {
      'appName': appName,
      'appId': appId,
      'appVersion': appVersion,
      'appDescription': appDescription,
      'isDebugMode': isDebugMode,
      'enableLogging': enableLogging,
      'enableAnalytics': enableAnalytics,
      'enableAllAppsShowcase': enableAllAppsShowcase,
      'enableAppSwitching': enableAppSwitching,
      'enableDeveloperMode': enableDeveloperMode,
      'defaultRoute': defaultRoute,
      'homeRoute': homeRoute,
      'showcaseRoute': showcaseRoute,
      'settingsRoute': settingsRoute,
      'aboutRoute': aboutRoute,
    };
  }
}
