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
import 'app_storage_base.dart';

/// Provider for app-specific storage that can be used with Provider package
/// This allows easy access to storage throughout the app
class StorageProvider extends ChangeNotifier {
  final AppStorageBase _storage;
  bool _isInitialized = false;
  
  StorageProvider(this._storage);
  
  /// Get the storage instance
  AppStorageBase get storage => _storage;
  
  /// Check if storage is initialized
  bool get isInitialized => _isInitialized;
  
  /// Initialize storage
  Future<void> initialize() async {
    if (_isInitialized) return;
    
    await _storage.initAppStorage();
    _isInitialized = true;
    notifyListeners();
  }
  
  
  /// Check if this is the first launch
  bool isFirstLaunch() {
    return _storage.isFirstLaunch();
  }
  
  /// Mark app as launched and notify listeners
  void setNotFirstLaunch() {
    _storage.setNotFirstLaunch();
    notifyListeners();
  }
  
  /// Get current locale
  String? getLocale() {
    return _storage.getLocale();
  }
  
  /// Set locale and notify listeners
  void setLocale(String locale) {
    _storage.setLocale(locale);
    notifyListeners();
  }
  
  /// Get theme mode
  String? getThemeMode() {
    return _storage.getThemeMode();
  }
  
  /// Set theme mode and notify listeners
  void setThemeMode(String themeMode) {
    _storage.setThemeMode(themeMode);
    notifyListeners();
  }
  
  /// Check if user is authenticated
  bool isAuthenticated() {
    return _storage.isAuthenticated();
  }
  
  /// Get auth token
  String? getAuthToken() {
    return _storage.getAuthToken();
  }
  
  /// Set auth token and notify listeners
  void setAuthToken(String token) {
    _storage.setAuthToken(token);
    notifyListeners();
  }
  
  /// Clear authentication and notify listeners
  Future<void> clearAuth() async {
    await _storage.clearAuth();
    notifyListeners();
  }
  
  
  /// Refresh all data and notify listeners
  Future<void> refresh() async {
    await _storage.refreshCache();
    notifyListeners();
  }
  
  /// Get storage statistics
  Future<Map<String, dynamic>> getStats() async {
    return await _storage.getAppStats();
  }
  
  /// Export data for backup
  Future<Map<String, dynamic>> exportData() async {
    return await _storage.exportAppData();
  }
  
  /// Import data from backup and notify listeners
  Future<void> importData(Map<String, dynamic> data) async {
    await _storage.importAppData(data);
    notifyListeners();
  }
  
  /// Reset all data and notify listeners
  Future<void> resetData() async {
    await _storage.clearAppStorage();
    notifyListeners();
  }
}

/// Factory for creating storage providers for different apps
class StorageProviderFactory {
  static final Map<String, StorageProvider> _providers = {};
  
  /// Get or create storage provider for specific app
  static StorageProvider getProvider(String appName, AppStorageBase storage) {
    if (!_providers.containsKey(appName)) {
      _providers[appName] = StorageProvider(storage);
    }
    return _providers[appName]!;
  }
  
  /// Initialize storage for specific app
  static Future<StorageProvider> initializeProvider(String appName, AppStorageBase storage) async {
    final provider = getProvider(appName, storage);
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
