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

import 'package:qyflutter/common/storage/app_storage_base.dart';

/// Main App Storage Implementation
/// Extends AppStorageBase to provide app-specific storage functionality
class StorageAppMain extends AppStorageBase {
  static StorageAppMain? _instance;

  StorageAppMain._internal();

  static StorageAppMain get instance {
    _instance ??= StorageAppMain._internal();
    return _instance!;
  }

  @override
  String get appBox => 'main_app_storage';

  @override
  String get cacheNamespace => 'main_cache';
  
  // Main app specific storage keys
  static const String _keyShowcaseSettings = 'showcase_settings';
  static const String _keySelectedApps = 'selected_apps';
  static const String _keyAppPreferences = 'app_preferences';
  static const String _keyDeveloperSettings = 'developer_settings';
  static const String _keyMainAppStats = 'main_app_stats';
  
  // Main app specific methods
  
  /// Get showcase settings
  Future<Map<String, dynamic>?> getShowcaseSettings() async {
    return await getApp<Map<String, dynamic>>(_keyShowcaseSettings);
  }

  /// Set showcase settings
  Future<void> setShowcaseSettings(Map<String, dynamic> settings) async {
    await setApp<Map<String, dynamic>>(_keyShowcaseSettings, settings);
  }

  /// Get selected apps list
  Future<List<String>> getSelectedApps() async {
    final apps = await getApp<List<dynamic>>(_keySelectedApps);
    return apps?.cast<String>() ?? [];
  }

  /// Set selected apps list
  Future<void> setSelectedApps(List<String> apps) async {
    await setApp<List<String>>(_keySelectedApps, apps);
  }
  
  /// Add app to selected apps
  Future<void> addSelectedApp(String appId) async {
    final currentApps = await getSelectedApps();
    if (!currentApps.contains(appId)) {
      currentApps.add(appId);
      await setSelectedApps(currentApps);
    }
  }
  
  /// Remove app from selected apps
  Future<void> removeSelectedApp(String appId) async {
    final currentApps = await getSelectedApps();
    currentApps.remove(appId);
    await setSelectedApps(currentApps);
  }
  
  /// Get app preferences
  Future<Map<String, dynamic>?> getAppPreferences() async {
    return await getApp<Map<String, dynamic>>(_keyAppPreferences);
  }

  /// Set app preferences
  Future<void> setAppPreferences(Map<String, dynamic> preferences) async {
    await setApp<Map<String, dynamic>>(_keyAppPreferences, preferences);
  }

  /// Get developer settings
  Future<Map<String, dynamic>?> getDeveloperSettings() async {
    return await getApp<Map<String, dynamic>>(_keyDeveloperSettings);
  }

  /// Set developer settings
  Future<void> setDeveloperSettings(Map<String, dynamic> settings) async {
    await setApp<Map<String, dynamic>>(_keyDeveloperSettings, settings);
  }

  /// Get main app statistics
  Future<Map<String, dynamic>?> getMainAppStats() async {
    return await getApp<Map<String, dynamic>>(_keyMainAppStats);
  }

  /// Set main app statistics
  Future<void> setMainAppStats(Map<String, dynamic> stats) async {
    await setApp<Map<String, dynamic>>(_keyMainAppStats, stats);
  }
  
  /// Update main app launch statistics
  Future<void> updateLaunchStats() async {
    final stats = await getMainAppStats() ?? <String, dynamic>{};
    final currentCount = stats['launchCount'] ?? 0;
    final lastLaunch = DateTime.now().toIso8601String();
    
    stats['launchCount'] = currentCount + 1;
    stats['lastLaunch'] = lastLaunch;
    stats['totalUsageTime'] = stats['totalUsageTime'] ?? 0;
    
    await setMainAppStats(stats);
  }
  
  /// Clear all main app specific data
  Future<void> clearMainAppData() async {
    await clearAppStorage();
  }
}
