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
import '../business/user_service.dart';
import '../business/config_service.dart';
import '../models/storage_result.dart';
import '../models/user_entity.dart';
import '../models/config_entity.dart';

/// Application service for storage operations
/// Orchestrates business logic and provides high-level operations
class StorageApplicationService {
  final UserService _userService;
  final ConfigService _configService;
  
  StorageApplicationService({
    required UserService userService,
    required ConfigService configService,
  }) : _userService = userService,
       _configService = configService;
  
  /// Initialize application
  Future<StorageResult<void>> initialize() async {
    try {
      // Initialize default configurations
      await _initializeDefaultConfigs();
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize storage application',
      );
    }
  }
  
  /// User management operations
  
  /// Register a new user
  Future<StorageResult<UserEntity>> registerUser({
    required String email,
    String? name,
    String? role,
    Map<String, dynamic>? preferences,
  }) async {
    try {
      return await _userService.createUser(
        email: email,
        name: name,
        role: role,
        preferences: preferences,
      );
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to register user',
      );
    }
  }
  
  /// Login user
  Future<StorageResult<UserEntity>> loginUser(String email) async {
    try {
      final result = await _userService.authenticateUser(email);
      if (result is StorageSuccess) {
        // Update login statistics
        await _updateLoginStats();
      }
      return result;
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to login user',
      );
    }
  }
  
  /// Update user profile
  Future<StorageResult<UserEntity>> updateUserProfile(
    String userId, {
    String? name,
    Map<String, dynamic>? preferences,
  }) async {
    try {
      return await _userService.updateUser(
        userId,
        name: name,
        preferences: preferences,
      );
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to update user profile',
      );
    }
  }
  
  /// Deactivate user account
  Future<StorageResult<UserEntity>> deactivateUserAccount(String userId) async {
    try {
      return await _userService.deactivateUser(userId);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to deactivate user account',
      );
    }
  }
  
  /// Configuration management operations
  
  /// Get application setting
  Future<StorageResult<T?>> getSetting<T>(String key) async {
    try {
      return await _configService.getConfig<T>(key);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get setting: $key',
      );
    }
  }
  
  /// Set application setting
  Future<StorageResult<ConfigEntity>> setSetting(
    String key, 
    dynamic value, {
    String? category,
    String? description,
    bool isEncrypted = false,
  }) async {
    try {
      return await _configService.setConfig(
        key,
        value,
        category: category,
        description: description,
        isEncrypted: isEncrypted,
      );
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to set setting: $key',
      );
    }
  }
  
  /// Get setting with default value
  Future<StorageResult<T>> getSettingWithDefault<T>(
    String key, 
    T defaultValue,
  ) async {
    try {
      return await _configService.getConfigWithDefault(key, defaultValue);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get setting with default: $key',
      );
    }
  }
  
  /// Bulk update settings
  Future<StorageResult<List<ConfigEntity>>> updateSettings(
    Map<String, dynamic> settings,
  ) async {
    try {
      return await _configService.bulkUpdateConfigs(settings);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to update settings',
      );
    }
  }
  
  /// Analytics and reporting operations
  
  /// Get application statistics
  Future<StorageResult<Map<String, dynamic>>> getApplicationStats() async {
    try {
      final userStatsResult = await _userService.getUserStats();
      final configStatsResult = await _configService.getConfigStats();
      
      if (userStatsResult is StorageError) {
        return userStatsResult;
      }
      
      if (configStatsResult is StorageError) {
        return configStatsResult;
      }
      
      final userStats = userStatsResult.data ?? {};
      final configStats = configStatsResult.data ?? {};
      
      return StorageSuccess({
        'users': userStats,
        'configurations': configStats,
        'generatedAt': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get application statistics',
      );
    }
  }
  
  /// Get user analytics
  Future<StorageResult<Map<String, dynamic>>> getUserAnalytics() async {
    try {
      final userStatsResult = await _userService.getUserStats();
      if (userStatsResult is StorageError) {
        return userStatsResult;
      }
      
      final userStats = userStatsResult.data ?? {};
      
      // Calculate additional analytics
      final totalUsers = userStats['totalUsers'] as int? ?? 0;
      final activeUsers = userStats['activeUsers'] as int? ?? 0;
      final activationRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0.0;
      
      return StorageSuccess({
        ...userStats,
        'activationRate': activationRate,
        'analyticsGeneratedAt': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get user analytics',
      );
    }
  }
  
  /// Data management operations
  
  /// Export user data
  Future<StorageResult<Map<String, dynamic>>> exportUserData(String userId) async {
    try {
      final userResult = await _userService.getUserById(userId);
      if (userResult is StorageError) {
        return userResult;
      }
      
      final user = userResult.data;
      if (user == null) {
        return StorageError.withCode(
          'USER_NOT_FOUND',
          'User not found: $userId',
        );
      }
      
      return StorageSuccess({
        'user': user.toMap(),
        'exportedAt': DateTime.now().toIso8601String(),
        'version': '1.0',
      });
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to export user data',
      );
    }
  }
  
  /// Export application data
  Future<StorageResult<Map<String, dynamic>>> exportApplicationData() async {
    try {
      final usersResult = await _userService.getActiveUsers();
      final configsResult = await _configService.getConfigsByCategory('system');
      
      if (usersResult is StorageError) {
        return usersResult;
      }
      
      if (configsResult is StorageError) {
        return configsResult;
      }
      
      final users = (usersResult.data ?? []).map((u) => u.toMap()).toList();
      final configs = (configsResult.data ?? []).map((c) => c.toMap()).toList();
      
      return StorageSuccess({
        'users': users,
        'configurations': configs,
        'exportedAt': DateTime.now().toIso8601String(),
        'version': '1.0',
      });
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to export application data',
      );
    }
  }
  
  /// System maintenance operations
  
  /// Cleanup inactive users
  Future<StorageResult<int>> cleanupInactiveUsers({int daysInactive = 90}) async {
    try {
      final allUsersResult = await _userService.getActiveUsers();
      if (allUsersResult is StorageError) {
        return allUsersResult;
      }
      
      final cutoffDate = DateTime.now().subtract(Duration(days: daysInactive));
      final inactiveUsers = (allUsersResult.data ?? []).where((user) {
        return !user.isActive && user.updatedAt.isBefore(cutoffDate);
      }).toList();
      
      int cleanedCount = 0;
      for (final user in inactiveUsers) {
        final deleteResult = await _userService.deleteUser(user.id);
        if (deleteResult is StorageSuccess) {
          cleanedCount++;
        }
      }
      
      return StorageSuccess(cleanedCount);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to cleanup inactive users',
      );
    }
  }
  
  /// Validate data integrity
  Future<StorageResult<Map<String, dynamic>>> validateDataIntegrity() async {
    try {
      final issues = <String>[];
      
      // Validate users
      final usersResult = await _userService.getActiveUsers();
      if (usersResult is StorageSuccess) {
        for (final user in usersResult.data ?? []) {
          if (!user.validate()) {
            issues.add('Invalid user data: ${user.id}');
          }
        }
      }
      
      // Validate configurations
      final configsResult = await _configService.getConfigsByCategory('system');
      if (configsResult is StorageSuccess) {
        for (final config in configsResult.data ?? []) {
          if (!config.validate()) {
            issues.add('Invalid config data: ${config.id}');
          }
        }
      }
      
      return StorageSuccess({
        'isValid': issues.isEmpty,
        'issues': issues,
        'validatedAt': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to validate data integrity',
      );
    }
  }
  
  /// Initialize default configurations
  Future<void> _initializeDefaultConfigs() async {
    final defaultConfigs = {
      'app.version': '1.0.0',
      'app.name': 'StorageV2 App',
      'app.environment': 'development',
      'storage.encryption.enabled': false,
      'storage.caching.enabled': true,
      'storage.cache.maxSize': 1000,
      'storage.cache.defaultExpiry': 3600, // 1 hour in seconds
      'user.defaultRole': 'user',
      'user.autoActivate': true,
      'analytics.enabled': true,
      'maintenance.cleanupInterval': 7, // days
    };
    
    for (final entry in defaultConfigs.entries) {
      await _configService.setConfig(
        entry.key,
        entry.value,
        category: 'system',
        description: 'Default system configuration',
      );
    }
  }
  
  /// Update login statistics
  Future<void> _updateLoginStats() async {
    final loginCountResult = await _configService.getConfigWithDefault(
      'analytics.loginCount',
      0,
    );
    
    if (loginCountResult is StorageSuccess) {
      final currentCount = loginCountResult.data as int;
      await _configService.setConfig(
        'analytics.loginCount',
        currentCount + 1,
        category: 'analytics',
      );
    }
    
    await _configService.setConfig(
      'analytics.lastLogin',
      DateTime.now().toIso8601String(),
      category: 'analytics',
    );
  }
}
