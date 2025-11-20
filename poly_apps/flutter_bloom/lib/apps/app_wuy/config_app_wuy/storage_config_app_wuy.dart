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
