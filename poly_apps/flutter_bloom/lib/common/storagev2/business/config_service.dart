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

import '../repository/storage_repository_impl.dart';
import '../models/storage_result.dart';
import '../models/config_entity.dart';

/// Configuration business logic service
class ConfigService {
  final ConfigRepository _configRepository;
  
  ConfigService({required ConfigRepository configRepository})
      : _configRepository = configRepository;
  
  /// Get configuration value
  Future<StorageResult<T?>> getConfig<T>(String key) async {
    try {
      return await _configRepository.getValue<T>(key);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get config: $key',
      );
    }
  }
  
  /// Set configuration value
  Future<StorageResult<ConfigEntity>> setConfig(
    String key, 
    dynamic value, {
    String? category,
    String? description,
    bool isEncrypted = false,
    bool isReadOnly = false,
  }) async {
    try {
      // Check if config already exists
      final existingResult = await _configRepository.getByKey(key);
      if (existingResult is StorageError) {
        return existingResult;
      }
      
      final existing = existingResult.data;
      if (existing != null) {
        // Update existing config
        final updated = existing.copyWith(
          value: value,
          category: category,
          description: description,
          isEncrypted: isEncrypted,
          isReadOnly: isReadOnly,
        );
        return await _configRepository.update(updated);
      } else {
        // Create new config
        final newConfig = ConfigEntity.create(
          key: key,
          value: value,
          category: category,
          description: description,
          isEncrypted: isEncrypted,
          isReadOnly: isReadOnly,
        );
        return await _configRepository.save(newConfig);
      }
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to set config: $key',
      );
    }
  }
  
  /// Get configuration with default value
  Future<StorageResult<T>> getConfigWithDefault<T>(
    String key, 
    T defaultValue,
  ) async {
    try {
      final result = await _configRepository.getValue<T>(key);
      if (result is StorageError) {
        return result;
      }
      
      final value = result.data;
      if (value == null) {
        // Set default value
        final setResult = await setConfig(key, defaultValue);
        if (setResult is StorageError) {
          return setResult;
        }
        return StorageSuccess(defaultValue);
      }
      
      return StorageSuccess(value);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get config with default: $key',
      );
    }
  }
  
  /// Get all configurations by category
  Future<StorageResult<List<ConfigEntity>>> getConfigsByCategory(String category) async {
    try {
      return await _configRepository.getByCategory(category);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get configs by category: $category',
      );
    }
  }
  
  /// Get encrypted configurations
  Future<StorageResult<List<ConfigEntity>>> getEncryptedConfigs() async {
    try {
      return await _configRepository.getEncryptedConfigs();
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get encrypted configs',
      );
    }
  }
  
  /// Delete configuration
  Future<StorageResult<void>> deleteConfig(String key) async {
    try {
      final configResult = await _configRepository.getByKey(key);
      if (configResult is StorageError) {
        return configResult;
      }
      
      final config = configResult.data;
      if (config == null) {
        return StorageError.withCode(
          'CONFIG_NOT_FOUND',
          'Configuration not found: $key',
        );
      }
      
      if (config.isReadOnly) {
        return StorageError.withCode(
          'CONFIG_READ_ONLY',
          'Cannot delete read-only configuration: $key',
        );
      }
      
      return await _configRepository.deleteById(config.id);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to delete config: $key',
      );
    }
  }
  
  /// Update configuration value
  Future<StorageResult<ConfigEntity>> updateConfigValue(String key, dynamic newValue) async {
    try {
      final configResult = await _configRepository.getByKey(key);
      if (configResult is StorageError) {
        return configResult;
      }
      
      final config = configResult.data;
      if (config == null) {
        return StorageError.withCode(
          'CONFIG_NOT_FOUND',
          'Configuration not found: $key',
        );
      }
      
      if (config.isReadOnly) {
        return StorageError.withCode(
          'CONFIG_READ_ONLY',
          'Cannot update read-only configuration: $key',
        );
      }
      
      final updated = config.updateValue(newValue);
      return await _configRepository.update(updated);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to update config value: $key',
      );
    }
  }
  
  /// Mark configuration as encrypted
  Future<StorageResult<ConfigEntity>> markConfigAsEncrypted(String key) async {
    try {
      final configResult = await _configRepository.getByKey(key);
      if (configResult is StorageError) {
        return configResult;
      }
      
      final config = configResult.data;
      if (config == null) {
        return StorageError.withCode(
          'CONFIG_NOT_FOUND',
          'Configuration not found: $key',
        );
      }
      
      final encrypted = config.markAsEncrypted();
      return await _configRepository.update(encrypted);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to mark config as encrypted: $key',
      );
    }
  }
  
  /// Mark configuration as read-only
  Future<StorageResult<ConfigEntity>> markConfigAsReadOnly(String key) async {
    try {
      final configResult = await _configRepository.getByKey(key);
      if (configResult is StorageError) {
        return configResult;
      }
      
      final config = configResult.data;
      if (config == null) {
        return StorageError.withCode(
          'CONFIG_NOT_FOUND',
          'Configuration not found: $key',
        );
      }
      
      final readOnly = config.markAsReadOnly();
      return await _configRepository.update(readOnly);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to mark config as read-only: $key',
      );
    }
  }
  
  /// Get configuration statistics
  Future<StorageResult<Map<String, dynamic>>> getConfigStats() async {
    try {
      final allConfigsResult = await _configRepository.getAll();
      if (allConfigsResult is StorageError) {
        return allConfigsResult;
      }
      
      final allConfigs = allConfigsResult.data ?? [];
      final encryptedCount = allConfigs.where((c) => c.isEncrypted).length;
      final readOnlyCount = allConfigs.where((c) => c.isReadOnly).length;
      
      final categoryStats = <String, int>{};
      for (final config in allConfigs) {
        final category = config.category ?? 'uncategorized';
        categoryStats[category] = (categoryStats[category] ?? 0) + 1;
      }
      
      return StorageSuccess({
        'totalConfigs': allConfigs.length,
        'encryptedConfigs': encryptedCount,
        'readOnlyConfigs': readOnlyCount,
        'categoryStats': categoryStats,
        'lastUpdated': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get config statistics',
      );
    }
  }
  
  /// Bulk update configurations
  Future<StorageResult<List<ConfigEntity>>> bulkUpdateConfigs(
    Map<String, dynamic> configs,
  ) async {
    try {
      final updatedConfigs = <ConfigEntity>[];
      
      for (final entry in configs.entries) {
        final result = await updateConfigValue(entry.key, entry.value);
        if (result is StorageError) {
          return result;
        }
        updatedConfigs.add(result.data!);
      }
      
      return StorageSuccess(updatedConfigs);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to bulk update configs',
      );
    }
  }
  
  /// Export configurations
  Future<StorageResult<Map<String, dynamic>>> exportConfigs({String? category}) async {
    try {
      final configsResult = category != null 
          ? await getConfigsByCategory(category)
          : await _configRepository.getAll();
      
      if (configsResult is StorageError) {
        return configsResult;
      }
      
      final configs = configsResult.data ?? [];
      final exportData = <String, dynamic>{};
      
      for (final config in configs) {
        exportData[config.key] = {
          'value': config.value,
          'category': config.category,
          'description': config.description,
          'isEncrypted': config.isEncrypted,
          'isReadOnly': config.isReadOnly,
          'createdAt': config.createdAt.toIso8601String(),
          'updatedAt': config.updatedAt.toIso8601String(),
        };
      }
      
      return StorageSuccess(exportData);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to export configs',
      );
    }
  }
}
