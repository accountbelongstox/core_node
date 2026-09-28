import 'package:flutter/foundation.dart';
import 'app_config_app_wuy.dart';
import '../services_app_wuy/wuy_sqlite_storage_service.dart';

/// Unified SQLite storage configuration for Wuy App
/// Uses only SQLite-based StorageV2, removes Hive dependency
class StorageConfigAppWuy {
  static bool _isInitialized = false;
  static WuySQLiteStorageService? _sqliteStorageService;
  
  /// Initialize storage system with SQLite only
  static Future<void> initialize() async {
    if (_isInitialized) return;
    
    try {
      // Initialize SQLite-only storage service
      _sqliteStorageService = WuySQLiteStorageService.instance;
      await _sqliteStorageService!.initialize();
      
      _isInitialized = true;
      
      if (AppConfigAppWuy.enableDebugMode) {
        debugPrint('StorageConfigAppWuy initialized successfully with SQLite only');
      }
    } catch (e) {
      debugPrint('Failed to initialize StorageConfigAppWuy: $e');
      rethrow;
    }
  }
  
  /// Dispose storage system
  static Future<void> dispose() async {
    if (!_isInitialized) return;
    
    try {
      // Dispose SQLite storage service
      if (_sqliteStorageService != null) {
        await _sqliteStorageService!.dispose();
        _sqliteStorageService = null;
      }
      
      _isInitialized = false;
      
      if (AppConfigAppWuy.enableDebugMode) {
        debugPrint('StorageConfigAppWuy disposed successfully');
      }
    } catch (e) {
      debugPrint('Failed to dispose StorageConfigAppWuy: $e');
    }
  }
  
  /// Check if storage is initialized
  static bool get isInitialized => _isInitialized;
  
  /// Get SQLite storage service instance
  static WuySQLiteStorageService? get sqliteStorageService => _sqliteStorageService;
}
