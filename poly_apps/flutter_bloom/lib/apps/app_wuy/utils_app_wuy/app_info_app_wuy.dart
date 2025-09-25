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

import 'package:flutter/material.dart';
import '../config_app_wuy/app_config_app_wuy.dart';

/// Wuy App Information and Utilities
/// Contains app information, initialization, and utility functions
class WuyAppInfo {
  
  /// Get comprehensive Wuy app information
  static Map<String, dynamic> getAppInfo() {
    return {
      'name': AppConfigAppWuy.appName,
      'version': AppConfigAppWuy.appVersion,
      'buildNumber': AppConfigAppWuy.buildNumber,
      'packageName': AppConfigAppWuy.packageName,
      'description': 'Wuy Test Application - A sample app demonstrating the Flutter Bloom architecture',
      'features': [
        'Multi-language support (English, Chinese)',
        'Dark/Light theme switching',
        'User authentication',
        'Local storage management',
        'API integration',
        'Responsive design',
        'Material Design 3',
      ],
      'supportedPlatforms': ['Android', 'iOS', 'Web'],
      'minimumSdkVersion': 21,
      'targetSdkVersion': 34,
    };
  }
  
  /// Get basic app information
  static Map<String, String> getBasicInfo() {
    return {
      'name': AppConfigAppWuy.appName,
      'version': AppConfigAppWuy.appVersion,
      'buildNumber': AppConfigAppWuy.buildNumber,
      'packageName': AppConfigAppWuy.packageName,
    };
  }
  
  /// Get app features list
  static List<String> getFeatures() {
    return [
      'Multi-language support (English, Chinese)',
      'Dark/Light theme switching',
      'User authentication',
      'Local storage management',
      'API integration',
      'Responsive design',
      'Material Design 3',
    ];
  }
  
  /// Get supported platforms
  static List<String> getSupportedPlatforms() {
    return ['Android', 'iOS', 'Web'];
  }
  
  /// Get app description
  static String getDescription() {
    return 'Wuy Test Application - A sample app demonstrating the Flutter Bloom architecture';
  }
  
  /// Initialize Wuy app-specific configurations
  static void initializeApp() {
    debugPrint('Initializing Wuy App...');
    debugPrint('App Name: ${AppConfigAppWuy.appName}');
    debugPrint('App Version: ${AppConfigAppWuy.appVersion}');
    debugPrint('Package Name: ${AppConfigAppWuy.packageName}');
    debugPrint('Debug Mode: ${AppConfigAppWuy.enableDebugMode}');
    
    // TODO: Add any Wuy-specific initialization here
    // For example:
    // - Initialize analytics
    // - Set up crash reporting
    // - Configure push notifications
    // - Initialize local storage
  }
  
  /// Check if Wuy app is ready
  static bool isAppReady() {
    // TODO: Add any readiness checks here
    // For example:
    // - Check if required services are initialized
    // - Verify network connectivity
    // - Validate configuration
    
    return true;
  }
  
  /// Get app status information
  static Map<String, dynamic> getAppStatus() {
    return {
      'isReady': isAppReady(),
      'debugMode': AppConfigAppWuy.enableDebugMode,
      'analyticsEnabled': AppConfigAppWuy.enableAnalytics,
      'crashReportingEnabled': AppConfigAppWuy.enableCrashReporting,
      'pushNotificationsEnabled': AppConfigAppWuy.enablePushNotifications,
      'offlineModeEnabled': AppConfigAppWuy.enableOfflineMode,
      'biometricAuthEnabled': AppConfigAppWuy.enableBiometricAuth,
    };
  }
  
  /// Print app information to debug console
  static void printAppInfo() {
    final info = getAppInfo();
    debugPrint('=== Wuy App Information ===');
    debugPrint('Name: ${info['name']}');
    debugPrint('Version: ${info['version']}');
    debugPrint('Build: ${info['buildNumber']}');
    debugPrint('Package: ${info['packageName']}');
    debugPrint('Description: ${info['description']}');
    debugPrint('Platforms: ${info['supportedPlatforms'].join(', ')}');
    debugPrint('Features: ${info['features'].length} features available');
  }
}
