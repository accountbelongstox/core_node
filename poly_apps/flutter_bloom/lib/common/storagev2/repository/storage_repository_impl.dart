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
import '../interfaces/storage_repository_interface.dart';
import '../data_access/storage_data_access.dart';
import '../models/storage_result.dart';
import '../models/storage_entity.dart';
import '../models/user_entity.dart';
import '../models/config_entity.dart';

/// Generic storage repository implementation
class StorageRepositoryImpl<T extends StorageEntity> implements StorageRepository<T> {
  final StorageDataAccess _dataAccess;
  final String _entityType;
  
  StorageRepositoryImpl({
    required StorageDataAccess dataAccess,
    required String entityType,
  }) : _dataAccess = dataAccess,
       _entityType = entityType;
  
  @override
  Future<StorageResult<void>> initialize() async {
    return await _dataAccess.initialize();
  }
  
  @override
  Future<StorageResult<T>> save(T entity) async {
    return await _dataAccess.save<T>(entity);
  }
  
  @override
  Future<StorageResult<T?>> getById(String id) async {
    return await _dataAccess.getById<T>(id);
  }
  
  @override
  Future<StorageResult<List<T>>> getAll() async {
    return await _dataAccess.getAll<T>();
  }
  
  @override
  Future<StorageResult<T>> update(T entity) async {
    return await _dataAccess.update<T>(entity);
  }
  
  @override
  Future<StorageResult<void>> deleteById(String id) async {
    return await _dataAccess.deleteById(id);
  }
  
  @override
  Future<StorageResult<void>> deleteAll() async {
    return await _dataAccess.deleteAll();
  }
  
  @override
  Future<StorageResult<bool>> exists(String id) async {
    return await _dataAccess.exists(id);
  }
  
  @override
  Future<StorageResult<List<T>>> getByCriteria(Map<String, dynamic> criteria) async {
    return await _dataAccess.getByCriteria<T>(criteria);
  }
  
  @override
  Future<StorageResult<PaginatedResult<T>>> getByCriteriaPaginated(
    Map<String, dynamic> criteria, {
    int page = 1,
    int limit = 20,
    String? sortBy,
    bool ascending = true,
  }) async {
    try {
      final allResult = await getByCriteria(criteria);
      if (allResult is StorageError) {
        return allResult;
      }
      
      final allEntities = allResult.data ?? [];
      
      // Sort if specified
      if (sortBy != null) {
        allEntities.sort((a, b) {
          final aValue = a.toMap()[sortBy];
          final bValue = b.toMap()[sortBy];
          
          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return ascending ? -1 : 1;
          if (bValue == null) return ascending ? 1 : -1;
          
          final comparison = _compareValues(aValue, bValue);
          return ascending ? comparison : -comparison;
        });
      }
      
      // Calculate pagination
      final totalCount = allEntities.length;
      final totalPages = (totalCount / limit).ceil();
      final startIndex = (page - 1) * limit;
      final endIndex = (startIndex + limit).clamp(0, totalCount);
      
      final paginatedEntities = allEntities.sublist(startIndex, endIndex);
      
      final result = PaginatedResult<T>(
        data: paginatedEntities,
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      );
      
      return StorageSuccess(result);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get paginated entities',
      );
    }
  }
  
  @override
  Future<StorageResult<List<T>>> saveBatch(List<T> entities) async {
    return await _dataAccess.saveBatch<T>(entities);
  }
  
  @override
  Future<StorageResult<void>> deleteBatch(List<String> ids) async {
    return await _dataAccess.deleteBatch(ids);
  }
  
  @override
  Future<StorageResult<R>> transaction<R>(
    Future<StorageResult<R>> Function() operation,
  ) async {
    try {
      // For now, we'll execute the operation directly
      // In a real implementation, this would coordinate with the storage adapter's transaction support
      return await operation();
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Transaction failed',
      );
    }
  }
  
  @override
  Stream<StorageResult<StorageChange<T>>> watch({String? id}) {
    return _dataAccess.watch<T>(id: id);
  }
  
  @override
  Future<StorageResult<RepositoryStats>> getStats() async {
    try {
      final statsResult = await _dataAccess.getStats();
      if (statsResult is StorageError) {
        return statsResult;
      }
      
      final stats = statsResult.data ?? {};
      final result = RepositoryStats(
        entityType: _entityType,
        totalEntities: stats['boxCount'] as int? ?? 0,
        totalSize: stats['totalSize'] as int? ?? 0,
        lastUpdated: DateTime.tryParse(stats['lastUpdated'] as String? ?? '') ?? DateTime.now(),
      );
      
      return StorageSuccess(result);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get repository stats',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> close() async {
    return await _dataAccess.close();
  }
  
  /// Compare two values for sorting
  int _compareValues(dynamic a, dynamic b) {
    if (a is num && b is num) {
      return a.compareTo(b);
    }
    if (a is String && b is String) {
      return a.compareTo(b);
    }
    if (a is DateTime && b is DateTime) {
      return a.compareTo(b);
    }
    return a.toString().compareTo(b.toString());
  }
}

/// User repository implementation
class UserRepository extends StorageRepositoryImpl<UserEntity> {
  UserRepository({required super.dataAccess})
      : super(entityType: 'user');
  
  /// Get user by email
  Future<StorageResult<UserEntity?>> getByEmail(String email) async {
    final result = await getByCriteria({'email': email});
    if (result is StorageError) {
      return result;
    }
    
    return StorageSuccess(result.data?.isNotEmpty == true ? result.data!.first : null);
  }
  
  /// Get active users
  Future<StorageResult<List<UserEntity>>> getActiveUsers() async {
    return await getByCriteria({'isActive': true});
  }
  
  /// Get users by role
  Future<StorageResult<List<UserEntity>>> getByRole(String role) async {
    return await getByCriteria({'role': role});
  }
  
  /// Update user last login
  Future<StorageResult<UserEntity>> updateLastLogin(String userId) async {
    final userResult = await getById(userId);
    if (userResult is StorageError) {
      return userResult;
    }
    
    final user = userResult.data;
    if (user == null) {
      return StorageError.withCode('USER_NOT_FOUND', 'User not found: $userId');
    }
    
    final updatedUser = user.updateLastLogin();
    return await update(updatedUser);
  }
}

/// Config repository implementation
class ConfigRepository extends StorageRepositoryImpl<ConfigEntity> {
  ConfigRepository({required super.dataAccess})
      : super(entityType: 'config');
  
  /// Get config by key
  Future<StorageResult<ConfigEntity?>> getByKey(String key) async {
    final result = await getByCriteria({'key': key});
    if (result is StorageError) {
      return result;
    }
    
    return StorageSuccess(result.data?.isNotEmpty == true ? result.data!.first : null);
  }
  
  /// Get config value by key
  Future<StorageResult<T?>> getValue<T>(String key) async {
    final configResult = await getByKey(key);
    if (configResult is StorageError) {
      return configResult;
    }
    
    final config = configResult.data;
    if (config == null) {
      return const StorageSuccess(null);
    }
    
    return StorageSuccess(config.getValueAs<T>());
  }
  
  /// Set config value
  Future<StorageResult<ConfigEntity>> setValue(String key, dynamic value) async {
    final existingResult = await getByKey(key);
    if (existingResult is StorageError) {
      return existingResult;
    }
    
    final existing = existingResult.data;
    if (existing != null) {
      final updated = existing.updateValue(value);
      return await update(updated);
    } else {
      final newConfig = ConfigEntity.create(key: key, value: value);
      return await save(newConfig);
    }
  }
  
  /// Get all configs by category
  Future<StorageResult<List<ConfigEntity>>> getByCategory(String category) async {
    return await getByCriteria({'category': category});
  }
  
  /// Get encrypted configs
  Future<StorageResult<List<ConfigEntity>>> getEncryptedConfigs() async {
    return await getByCriteria({'isEncrypted': true});
  }
}
