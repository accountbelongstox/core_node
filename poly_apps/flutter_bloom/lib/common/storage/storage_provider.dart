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

import 'package:flutter/foundation.dart';
import 'unified_storage.dart';

/// Provider for app-specific storage that can be used with Provider package
/// This allows easy access to storage throughout the app
class StorageProvider extends ChangeNotifier {
  final String _appBox;
  bool _isInitialized = false;
  
  StorageProvider({required String appBox, required String cacheNamespace}) 
      : _appBox = appBox;
  
  /// Check if storage is initialized
  bool get isInitialized => _isInitialized;
  
  /// Initialize storage
  Future<void> initialize() async {
    if (_isInitialized) return;
    
    await UnifiedStorage.init();
    _isInitialized = true;
    notifyListeners();
  }
  
  
  /// Check if this is the first launch
  bool isFirstLaunch() {
    return UnifiedStorage.getSync<bool>(CommonKeys.isFirstLaunch) ?? true;
  }
  
  /// Mark app as launched and notify listeners
  void setNotFirstLaunch() {
    UnifiedStorage.setSync<bool>(CommonKeys.isFirstLaunch, false);
    notifyListeners();
  }
  
  /// Get current locale
  String? getLocale() {
    return UnifiedStorage.getSync<String>(CommonKeys.locale);
  }
  
  /// Set locale and notify listeners
  void setLocale(String locale) {
    UnifiedStorage.setSync<String>(CommonKeys.locale, locale);
    notifyListeners();
  }
  
  /// Get theme mode
  String? getThemeMode() {
    return UnifiedStorage.getSync<String>(CommonKeys.themeMode);
  }
  
  /// Set theme mode and notify listeners
  void setThemeMode(String themeMode) {
    UnifiedStorage.setSync<String>(CommonKeys.themeMode, themeMode);
    notifyListeners();
  }
  
  /// Check if user is authenticated
  bool isAuthenticated() {
    return UnifiedStorage.getSync<bool>(CommonKeys.isAuthenticated) ?? false;
  }
  
  /// Get auth token
  String? getAuthToken() {
    return UnifiedStorage.getSync<String>(CommonKeys.authToken);
  }
  
  /// Set auth token and notify listeners
  void setAuthToken(String token) {
    UnifiedStorage.setSync<String>(CommonKeys.authToken, token);
    notifyListeners();
  }
  
  /// Clear authentication and notify listeners
  Future<void> clearAuth() async {
    UnifiedStorage.setSync<String?>(CommonKeys.authToken, null);
    UnifiedStorage.setSync<bool>(CommonKeys.isAuthenticated, false);
    notifyListeners();
  }
  
  
  /// Refresh all data and notify listeners
  Future<void> refresh() async {
    await UnifiedStorage.refreshSyncCache();
    notifyListeners();
  }
  
  /// Get storage statistics
  Future<Map<String, dynamic>> getStats() async {
    return await UnifiedStorage.getStats();
  }
  
  /// Export data for backup
  Future<Map<String, dynamic>> exportData() async {
    return await UnifiedStorage.exportData();
  }
  
  /// Import data from backup and notify listeners
  Future<void> importData(Map<String, dynamic> data) async {
    await UnifiedStorage.importData(data);
    notifyListeners();
  }
  
  /// Reset all data and notify listeners
  Future<void> resetData() async {
    await UnifiedStorage.clearAppStorage(_appBox);
    notifyListeners();
  }
}

/// Factory for creating storage providers for different apps
class StorageProviderFactory {
  static final Map<String, StorageProvider> _providers = {};
  
  /// Get or create storage provider for specific app
  static StorageProvider getProvider(String appName, {String? appBox, String? cacheNamespace}) {
    if (!_providers.containsKey(appName)) {
      _providers[appName] = StorageProvider(
        appBox: appBox ?? '${appName}_storage',
        cacheNamespace: cacheNamespace ?? appName,
      );
    }
    return _providers[appName]!;
  }
  
  /// Initialize storage for specific app
  static Future<StorageProvider> initializeProvider(String appName, {String? appBox, String? cacheNamespace}) async {
    final provider = getProvider(appName, appBox: appBox, cacheNamespace: cacheNamespace);
    await provider.initialize();
    return provider;
  }
  
  /// Get all registered providers
  static Map<String, StorageProvider> getAllProviders() {
    return Map.unmodifiable(_providers);
  }
  
  /// Clear all providers (for testing or reset)
  static void clearProviders() {
    _providers.clear();
  }
}
