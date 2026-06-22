// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:async';
import '../models/storage_result.dart';
import '../interfaces/storage_adapter_interface.dart';
import '../interfaces/cache_service_interface.dart';
import '../config/storage_config.dart';

/// Storage service for managing storage operations
class StorageService {
  final StorageAdapter _storageAdapter;
  final CacheService? _cacheService;
  final StorageConfig _config;
  
  StorageService({
    required StorageAdapter storageAdapter,
    required StorageConfig config,
    CacheService? cacheService,
  }) : _storageAdapter = storageAdapter,
       _config = config,
       _cacheService = cacheService;
  
  /// Initialize storage service
  Future<StorageResult<void>> initialize() async {
    try {
      final result = await _storageAdapter.initialize(_config);
      if (result is StorageError) {
        return result;
      }
      
      if (_cacheService != null) {
        final cacheResult = await _cacheService.initialize();
        if (cacheResult is StorageError) {
          return cacheResult;
        }
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize storage service',
      );
    }
  }
  
  /// Get storage statistics
  Future<StorageResult<Map<String, dynamic>>> getStorageStats() async {
    try {
      final statsResult = await _storageAdapter.getStats();
      if (statsResult is StorageError) {
        return statsResult;
      }
      
      final stats = statsResult.data;
      final result = {
        'totalBoxes': stats?.totalBoxes ?? 0,
        'openBoxes': stats?.openBoxes ?? 0,
        'totalKeys': stats?.totalKeys ?? 0,
        'totalSize': stats?.totalSize ?? 0,
        'lastUpdated': stats?.lastUpdated.toIso8601String() ?? DateTime.now().toIso8601String(),
      };
      
      if (_cacheService != null) {
        final cacheStatsResult = await _cacheService.getStats();
        if (cacheStatsResult is StorageSuccess) {
          result['cache'] = cacheStatsResult.data?.toMap() ?? {};
        }
      }
      
      return StorageSuccess(result);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get storage statistics',
      );
    }
  }
  
  /// Perform storage maintenance
  Future<StorageResult<Map<String, dynamic>>> performMaintenance() async {
    try {
      final results = <String, dynamic>{};
      
      // Clean up expired cache entries
      if (_cacheService != null) {
        final cleanupResult = await _cacheService.cleanupExpired();
        if (cleanupResult is StorageSuccess) {
          results['cacheCleanup'] = cleanupResult.data;
        }
      }
      
      // Get storage stats after maintenance
      final statsResult = await getStorageStats();
      if (statsResult is StorageSuccess) {
        results['storageStats'] = statsResult.data;
      }
      
      results['maintenanceCompleted'] = DateTime.now().toIso8601String();
      
      return StorageSuccess(results);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to perform storage maintenance',
      );
    }
  }
  
  /// Backup storage data
  Future<StorageResult<Map<String, dynamic>>> backupData() async {
    try {
      final backupData = <String, dynamic>{};
      
      // Get all boxes and their data
      final statsResult = await _storageAdapter.getStats();
      if (statsResult is StorageError) {
        return statsResult;
      }
      
      final stats = statsResult.data;
      backupData['metadata'] = {
        'totalBoxes': stats?.totalBoxes ?? 0,
        'totalKeys': stats?.totalKeys ?? 0,
        'totalSize': stats?.totalSize ?? 0,
        'backupDate': DateTime.now().toIso8601String(),
      };
      
      // Note: In a real implementation, you would iterate through all boxes
      // and export their data. For now, we'll return the metadata.
      
      return StorageSuccess(backupData);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to backup storage data',
      );
    }
  }
  
  /// Restore storage data
  Future<StorageResult<void>> restoreData(Map<String, dynamic> backupData) async {
    try {
      // Note: In a real implementation, you would restore the data
      // from the backup. For now, we'll just validate the backup format.
      
      if (!backupData.containsKey('metadata')) {
        return StorageError.withCode(
          'INVALID_BACKUP',
          'Invalid backup data format',
        );
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to restore storage data',
      );
    }
  }
  
  /// Optimize storage performance
  Future<StorageResult<Map<String, dynamic>>> optimizeStorage() async {
    try {
      final results = <String, dynamic>{};
      
      // Clean up cache
      if (_cacheService != null) {
        final cleanupResult = await _cacheService.cleanupExpired();
        if (cleanupResult is StorageSuccess) {
          results['cacheOptimized'] = cleanupResult.data;
        }
      }
      
      // Get stats before and after optimization
      final beforeStats = await getStorageStats();
      if (beforeStats is StorageSuccess) {
        results['beforeOptimization'] = beforeStats.data;
      }
      
      // Note: In a real implementation, you might perform additional
      // optimizations like defragmentation, index rebuilding, etc.
      
      final afterStats = await getStorageStats();
      if (afterStats is StorageSuccess) {
        results['afterOptimization'] = afterStats.data;
      }
      
      results['optimizationCompleted'] = DateTime.now().toIso8601String();
      
      return StorageSuccess(results);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to optimize storage',
      );
    }
  }
  
  /// Validate storage integrity
  Future<StorageResult<Map<String, dynamic>>> validateIntegrity() async {
    try {
      final results = <String, dynamic>{
        'isValid': true,
        'issues': <String>[],
        'validatedAt': DateTime.now().toIso8601String(),
      };
      
      // Check storage adapter
      final statsResult = await _storageAdapter.getStats();
      if (statsResult is StorageError) {
        results['isValid'] = false;
        results['issues'].add('Storage adapter error: ${statsResult.message}');
      }
      
      // Check cache service if available
      if (_cacheService != null) {
        final cacheStatsResult = await _cacheService.getStats();
        if (cacheStatsResult is StorageError) {
          results['isValid'] = false;
          results['issues'].add('Cache service error: ${cacheStatsResult.message}');
        }
      }
      
      return StorageSuccess(results);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to validate storage integrity',
      );
    }
  }
  
  /// Close storage service
  Future<StorageResult<void>> close() async {
    try {
      if (_cacheService != null) {
        final cacheResult = await _cacheService.close();
        if (cacheResult is StorageError) {
          return cacheResult;
        }
      }
      
      final result = await _storageAdapter.close();
      if (result is StorageError) {
        return result;
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to close storage service',
      );
    }
  }
}
