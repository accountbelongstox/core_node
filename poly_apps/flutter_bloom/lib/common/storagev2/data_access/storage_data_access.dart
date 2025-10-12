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
import 'dart:convert';
import '../interfaces/storage_adapter_interface.dart';
import '../interfaces/encryption_service_interface.dart';
import '../interfaces/cache_service_interface.dart';
import '../models/storage_result.dart';
import '../models/storage_entity.dart';
import '../config/storage_config.dart';

/// Data access layer for storage operations
/// Handles serialization, encryption, caching, and adapter coordination
class StorageDataAccess {
  final StorageAdapter _adapter;
  final EncryptionService? _encryptionService;
  final CacheService? _cacheService;
  final StorageConfig _config;
  final String _boxName;
  final Type _entityType;
  
  StorageDataAccess({
    required StorageAdapter adapter,
    required StorageConfig config,
    required String boxName,
    required Type entityType,
    EncryptionService? encryptionService,
    CacheService? cacheService,
  }) : _adapter = adapter,
       _config = config,
       _boxName = boxName,
       _entityType = entityType,
       _encryptionService = encryptionService,
       _cacheService = cacheService;
  
  /// Initialize the data access layer
  Future<StorageResult<void>> initialize() async {
    try {
      final result = await _adapter.openBox(_boxName);
      if (result is StorageError) {
        return result;
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize data access for box: $_boxName',
      );
    }
  }
  
  /// Save an entity to storage
  Future<StorageResult<T>> save<T extends StorageEntity>(T entity) async {
    try {
      // Validate entity
      final validationResult = entity.validateForStorage();
      if (validationResult is StorageError) {
        return validationResult;
      }
      
      // Serialize entity
      final serializedData = _serializeEntity(entity);
      
      // Encrypt if needed
      final processedData = await _processDataForStorage(serializedData);
      if (processedData is StorageError) {
        return processedData;
      }
      
      // Save to adapter
      final saveResult = await _adapter.setValue(_boxName, entity.id, processedData.data);
      if (saveResult is StorageError) {
        return saveResult;
      }
      
      // Update cache
      await _updateCache(entity.id, entity);
      
      return StorageSuccess(entity);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to save entity: ${entity.id}',
      );
    }
  }
  
  /// Get an entity by ID
  Future<StorageResult<T?>> getById<T extends StorageEntity>(String id) async {
    try {
      // Check cache first
      if (_cacheService != null) {
        final cacheResult = await _cacheService!.get<T>('$_boxName:$id');
        if (cacheResult is StorageSuccess && cacheResult.data != null) {
          return StorageSuccess(cacheResult.data);
        }
      }
      
      // Get from adapter
      final result = await _adapter.getValue(_boxName, id);
      if (result is StorageError) {
        return result;
      }
      
      if (result.data == null) {
        return const StorageSuccess(null);
      }
      
      // Process data from storage
      final processedData = await _processDataFromStorage(result.data);
      if (processedData is StorageError) {
        return processedData;
      }
      
      // Deserialize entity
      final entity = _deserializeEntity<T>(processedData.data);
      if (entity == null) {
        return StorageError.withCode(
          'DESERIALIZATION_FAILED',
          'Failed to deserialize entity: $id',
        );
      }
      
      // Update cache
      await _updateCache(id, entity);
      
      return StorageSuccess(entity);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get entity: $id',
      );
    }
  }
  
  /// Get all entities
  Future<StorageResult<List<T>>> getAll<T extends StorageEntity>() async {
    try {
      final result = await _adapter.getAll(_boxName);
      if (result is StorageError) {
        return result;
      }
      
      final entities = <T>[];
      for (final entry in (result.data ?? {}).entries) {
        final processedData = await _processDataFromStorage(entry.value);
        if (processedData is StorageError) {
          continue; // Skip invalid entries
        }
        
        final entity = _deserializeEntity<T>(processedData.data);
        if (entity != null) {
          entities.add(entity);
        }
      }
      
      return StorageSuccess(entities);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get all entities',
      );
    }
  }
  
  /// Update an entity
  Future<StorageResult<T>> update<T extends StorageEntity>(T entity) async {
    try {
      // Check if entity exists
      final existsResult = await _adapter.containsKey(_boxName, entity.id);
      if (existsResult is StorageError) {
        return existsResult;
      }
      
      if (!(existsResult.data ?? false)) {
        return StorageError.withCode(
          'ENTITY_NOT_FOUND',
          'Entity not found: ${entity.id}',
        );
      }
      
      // Save updated entity
      return await save(entity);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to update entity: ${entity.id}',
      );
    }
  }
  
  /// Delete an entity by ID
  Future<StorageResult<void>> deleteById(String id) async {
    try {
      final result = await _adapter.deleteValue(_boxName, id);
      if (result is StorageError) {
        return result;
      }
      
      // Remove from cache
      if (_cacheService != null) {
        await _cacheService!.remove('$_boxName:$id');
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to delete entity: $id',
      );
    }
  }
  
  /// Delete all entities
  Future<StorageResult<void>> deleteAll() async {
    try {
      final result = await _adapter.clearBox(_boxName);
      if (result is StorageError) {
        return result;
      }
      
      // Clear cache
      if (_cacheService != null) {
        await _cacheService!.removeKeysMatching('$_boxName:*');
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to delete all entities',
      );
    }
  }
  
  /// Check if entity exists
  Future<StorageResult<bool>> exists(String id) async {
    try {
      return await _adapter.containsKey(_boxName, id);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to check if entity exists: $id',
      );
    }
  }
  
  /// Get entities by criteria
  Future<StorageResult<List<T>>> getByCriteria<T extends StorageEntity>(
    Map<String, dynamic> criteria,
  ) async {
    try {
      // Get all entities and filter
      final allResult = await getAll<T>();
      if (allResult is StorageError) {
        return allResult;
      }
      
      final filtered = (allResult.data ?? []).where((entity) {
        final entityMap = entity.toMap();
        for (final entry in criteria.entries) {
          if (entityMap[entry.key] != entry.value) {
            return false;
          }
        }
        return true;
      }).toList();
      
      return StorageSuccess(filtered);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get entities by criteria',
      );
    }
  }
  
  /// Save multiple entities
  Future<StorageResult<List<T>>> saveBatch<T extends StorageEntity>(
    List<T> entities,
  ) async {
    try {
      final savedEntities = <T>[];
      
      for (final entity in entities) {
        final result = await save(entity);
        if (result is StorageError) {
          return result;
        }
        savedEntities.add(result.data!);
      }
      
      return StorageSuccess(savedEntities);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to save batch of entities',
      );
    }
  }
  
  /// Delete multiple entities
  Future<StorageResult<void>> deleteBatch(List<String> ids) async {
    try {
      final result = await _adapter.deleteMultiple(_boxName, ids);
      if (result is StorageError) {
        return result;
      }
      
      // Remove from cache
      if (_cacheService != null) {
        final cacheKeys = ids.map((id) => '$_boxName:$id').toList();
        await _cacheService!.removeMultiple(cacheKeys);
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to delete batch of entities',
      );
    }
  }
  
  /// Watch for changes
  Stream<StorageResult<StorageChange<T>>> watch<T extends StorageEntity>({String? id}) {
    return _adapter.watchBox(_boxName, key: id).asyncMap((result) async {
      if (result is StorageError) {
        return result;
      }
      
      final event = result.data;
      T? oldEntity;
      T? newEntity;
      
      if (event?.oldValue != null) {
        final processedOld = await _processDataFromStorage(event!.oldValue);
        if (processedOld is StorageSuccess) {
          oldEntity = _deserializeEntity<T>(processedOld.data);
        }
      }
      
      if (event?.newValue != null) {
        final processedNew = await _processDataFromStorage(event!.newValue);
        if (processedNew is StorageSuccess) {
          newEntity = _deserializeEntity<T>(processedNew.data);
        }
      }
      
      final change = StorageChange<T>(
        id: event?.key ?? '',
        oldValue: oldEntity,
        newValue: newEntity,
        type: event?.type ?? StorageChangeType.updated,
        timestamp: DateTime.now(),
      );
      
      return StorageSuccess(change);
    });
  }
  
  /// Get storage statistics
  Future<StorageResult<Map<String, dynamic>>> getStats() async {
    try {
      final result = await _adapter.getStats();
      if (result is StorageError) {
        return result;
      }
      
      final stats = result.data;
      final boxCount = await _adapter.getCount(_boxName);
      
      return StorageSuccess({
        'totalBoxes': stats?.totalBoxes ?? 0,
        'openBoxes': stats?.openBoxes ?? 0,
        'totalKeys': stats?.totalKeys ?? 0,
        'totalSize': stats?.totalSize ?? 0,
        'boxCount': boxCount.data ?? 0,
        'lastUpdated': stats?.lastUpdated.toIso8601String() ?? DateTime.now().toIso8601String(),
      });
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get storage stats',
      );
    }
  }
  
  /// Close the data access layer
  Future<StorageResult<void>> close() async {
    try {
      final result = await _adapter.closeBox(_boxName);
      if (result is StorageError) {
        return result;
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to close data access for box: $_boxName',
      );
    }
  }
  
  /// Serialize entity to JSON string
  String _serializeEntity<T extends StorageEntity>(T entity) {
    final map = entity.toMap();
    map['_entityType'] = entity.entityType;
    map['_version'] = entity.version;
    return jsonEncode(map);
  }
  
  /// Deserialize JSON string to entity
  T? _deserializeEntity<T extends StorageEntity>(dynamic data) {
    try {
      if (data is String) {
        final map = jsonDecode(data) as Map<String, dynamic>;
        return StorageEntity.fromMap<T>(map);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  
  /// Process data for storage (encryption, etc.)
  Future<StorageResult<dynamic>> _processDataForStorage(dynamic data) async {
    if (_encryptionService != null && _config.encryptSensitiveData) {
      final encryptedResult = await _encryptionService!.encrypt(data.toString());
      if (encryptedResult is StorageError) {
        return encryptedResult;
      }
      return StorageSuccess(encryptedResult.data);
    }
    return StorageSuccess(data);
  }
  
  /// Process data from storage (decryption, etc.)
  Future<StorageResult<dynamic>> _processDataFromStorage(dynamic data) async {
    if (_encryptionService != null && _config.encryptSensitiveData) {
      if (data is String && _encryptionService!.isEncrypted(data)) {
        final decryptedResult = await _encryptionService!.decrypt(data);
        if (decryptedResult is StorageError) {
          return decryptedResult;
        }
        return StorageSuccess(decryptedResult.data);
      }
    }
    return StorageSuccess(data);
  }
  
  /// Update cache with entity
  Future<void> _updateCache<T extends StorageEntity>(String id, T entity) async {
    if (_cacheService != null && _config.enableCaching) {
      await _cacheService!.set('$_boxName:$id', entity);
    }
  }
}
