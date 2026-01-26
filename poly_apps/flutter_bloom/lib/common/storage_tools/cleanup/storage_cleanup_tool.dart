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

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import '../storage_manager.dart';
import '../adapters/storage_adapter_unified.dart';

/// Storage cleanup tool to maintain consistency and remove redundant implementations
class StorageCleanupTool {
  static const String _cleanupFlagKey = '_storage_cleanup_completed';
  static const String _cleanupVersion = '1.0.0';

  /// Check if cleanup is needed
  static Future<bool> isCleanupNeeded({String? appName}) async {
    try {
      await StorageManager.instance.init(appName: appName);

      // Check if cleanup flag exists
      final result = await StorageManager.instance.getValue<String>(
        'common_storage',
        _cleanupFlagKey,
      );
      
      return result != _cleanupVersion;
    } catch (e) {
      debugPrint('Cleanup check error: $e');
      return true; // Assume cleanup is needed if check fails
    }
  }

  /// Perform storage system cleanup
  static Future<CleanupResult> performCleanup({
    String? appName,
    bool removeOldDatabases = true,
    bool optimizeDatabase = true,
  }) async {
    try {
      debugPrint('Starting storage system cleanup...');

      // Initialize storage
      await StorageManager.instance.init(appName: appName);

      // Check if cleanup is needed
      if (!await isCleanupNeeded(appName: appName)) {
        return CleanupResult(
          success: true,
          message: 'Cleanup not needed or already completed',
          cleanedItems: 0,
        );
      }

      int cleanedItems = 0;
      final List<String> actions = [];

      // Clean up old database files
      if (removeOldDatabases) {
        final oldDbCount = await _removeOldDatabases();
        cleanedItems += oldDbCount;
        if (oldDbCount > 0) {
          actions.add('Removed $oldDbCount old database files');
        }
      }

      // Optimize current database
      if (optimizeDatabase) {
        final optimized = await _optimizeDatabase(appName: appName);
        if (optimized) {
          actions.add('Optimized current database');
        }
      }

      // Clean up expired entries
      final expiredCount = await _cleanupExpiredEntries(appName: appName);
      cleanedItems += expiredCount;
      if (expiredCount > 0) {
        actions.add('Removed $expiredCount expired entries');
      }

      // Mark cleanup as completed
      await StorageManager.instance.putValue(
        'common_storage',
        _cleanupFlagKey,
        _cleanupVersion,
      );

      final success = true;
      final message = actions.isEmpty 
          ? 'No cleanup actions needed'
          : 'Cleanup completed: ${actions.join(', ')}';

      debugPrint('Storage cleanup completed: $message');
      debugPrint('Total cleaned items: $cleanedItems');

      return CleanupResult(
        success: success,
        message: message,
        cleanedItems: cleanedItems,
        actions: actions,
      );
    } catch (e) {
      debugPrint('Storage cleanup failed: $e');
      return CleanupResult(
        success: false,
        message: 'Cleanup failed: $e',
        cleanedItems: 0,
        actions: [],
      );
    }
  }

  /// Remove old database files
  static Future<int> _removeOldDatabases() async {
    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      final storageDir = join(documentsDirectory.path, 'storage_v1');
      final storageV2Dir = join(documentsDirectory.path, 'storagev2');
      
      int removedCount = 0;

      // Remove old v1 storage files
      final v1Dir = Directory(storageDir);
      if (await v1Dir.exists()) {
        final files = await v1Dir.list().toList();
        for (final file in files) {
          if (file is File && file.path.endsWith('.db')) {
            await file.delete();
            removedCount++;
          }
        }
      }

      // Remove old v2 storage files
      final v2Dir = Directory(storageV2Dir);
      if (await v2Dir.exists()) {
        final files = await v2Dir.list().toList();
        for (final file in files) {
          if (file is File && file.path.endsWith('.db')) {
            await file.delete();
            removedCount++;
          }
        }
      }

      return removedCount;
    } catch (e) {
      debugPrint('Error removing old databases: $e');
      return 0;
    }
  }

  /// Optimize current database
  static Future<bool> _optimizeDatabase({String? appName}) async {
    try {
      await StorageManager.instance.init(appName: appName);
      await UnifiedSQLiteStorageAdapter.instance.init(appName: appName);

      // Get unified storage adapter
      final adapter = UnifiedSQLiteStorageAdapter.instance;
      
      // Clean up expired entries
      await adapter.cleanupExpiredEntries();
      
      // Get storage stats
      final stats = await adapter.getStorageStats();
      debugPrint('Database optimization completed. Stats: $stats');
      
      return true;
    } catch (e) {
      debugPrint('Error optimizing database: $e');
      return false;
    }
  }

  /// Clean up expired entries
  static Future<int> _cleanupExpiredEntries({String? appName}) async {
    try {
      await StorageManager.instance.init(appName: appName);
      await UnifiedSQLiteStorageAdapter.instance.init(appName: appName);

      final adapter = UnifiedSQLiteStorageAdapter.instance;
      return await adapter.cleanupExpiredEntries();
    } catch (e) {
      debugPrint('Error cleaning up expired entries: $e');
      return 0;
    }
  }

  /// Get storage system health status
  static Future<StorageHealthStatus> getStorageHealth() async {
    try {
      final adapter = UnifiedSQLiteStorageAdapter.instance;
      final stats = await adapter.getStorageStats();
      
      final totalEntries = stats['total_entries'] as int? ?? 0;
      final databaseSize = stats['database_size'] as int? ?? 0;
      final boxStats = stats['box_stats'] as Map<String, int>? ?? {};

      // Calculate health score (0-100)
      int healthScore = 100;
      
      // Reduce score for large database size
      if (databaseSize > 10 * 1024 * 1024) { // 10MB
        healthScore -= 20;
      }
      
      // Reduce score for too many entries
      if (totalEntries > 10000) {
        healthScore -= 10;
      }

      // Reduce score for unbalanced box distribution
      if (boxStats.length > 10) {
        healthScore -= 15;
      }

      return StorageHealthStatus(
        healthScore: healthScore,
        totalEntries: totalEntries,
        databaseSize: databaseSize,
        boxCount: boxStats.length,
        boxStats: boxStats,
        isHealthy: healthScore >= 80,
      );
    } catch (e) {
      debugPrint('Error getting storage health: $e');
      return StorageHealthStatus(
        healthScore: 0,
        totalEntries: 0,
        databaseSize: 0,
        boxCount: 0,
        boxStats: {},
        isHealthy: false,
      );
    }
  }

  /// Clear cleanup flag (for testing)
  static Future<void> clearCleanupFlag() async {
    try {
      await StorageManager.instance.deleteKey('common_storage', _cleanupFlagKey);
    } catch (e) {
      debugPrint('Failed to clear cleanup flag: $e');
    }
  }
}

/// Cleanup result
class CleanupResult {
  final bool success;
  final String message;
  final int cleanedItems;
  final List<String> actions;

  CleanupResult({
    required this.success,
    required this.message,
    required this.cleanedItems,
    this.actions = const [],
  });
}

/// Storage health status
class StorageHealthStatus {
  final int healthScore;
  final int totalEntries;
  final int databaseSize;
  final int boxCount;
  final Map<String, int> boxStats;
  final bool isHealthy;

  StorageHealthStatus({
    required this.healthScore,
    required this.totalEntries,
    required this.databaseSize,
    required this.boxCount,
    required this.boxStats,
    required this.isHealthy,
  });

  @override
  String toString() {
    return 'StorageHealthStatus(healthScore: $healthScore, totalEntries: $totalEntries, databaseSize: ${(databaseSize / 1024 / 1024).toStringAsFixed(2)}MB, boxCount: $boxCount, isHealthy: $isHealthy)';
  }
}
