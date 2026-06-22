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
import '../../../common/storagev2/flutter_storage.dart';
import '../models_app_wuy/user_model_app_wuy.dart';

/// Wuy App SQLite Storage Service
/// Provides unified SQLite-based storage for app_wuy
/// Replaces UnifiedStorage to avoid Hive dependency issues
class WuySQLiteStorageService {
  static WuySQLiteStorageService? _instance;
  static const String _namespace = 'app_wuy_sqlite';
  
  WuySQLiteStorageService._internal();
  
  static WuySQLiteStorageService get instance {
    _instance ??= WuySQLiteStorageService._internal();
    return _instance!;
  }
  
  bool _isInitialized = false;
  StorageContainer? _container;
  UserService? _userService;
  ConfigService? _configService;
  
  /// Initialize SQLite storage service
  Future<bool> initialize() async {
    if (_isInitialized) return true;
    
    try {
      // Create SQLite-only configuration
      final config = StorageConfig(
        appName: _namespace,
        storageType: StorageType.sqlite,
        enableCaching: true,
        cacheMaxSize: 100,
        cacheDefaultExpiry: 300,
        encryptSensitiveData: false,
        enableLogging: kDebugMode,
        subDirectory: 'sqlite_$_namespace',
      );
      
      // Initialize StorageV2 container with SQLite
      _container = StorageContainer();
      final initResult = await _container!.initialize(config);
      
      if (initResult is StorageError) {
        debugPrint('WuySQLiteStorageService: Failed to initialize: ${initResult.message}');
        return false;
      }
      
      // Get services
      _userService = _container!.get<UserService>();
      _configService = _container!.get<ConfigService>();
      
      _isInitialized = true;
      debugPrint('WuySQLiteStorageService: Initialized successfully with SQLite');
      return true;
    } catch (e) {
      debugPrint('WuySQLiteStorageService: Initialization error: $e');
      return false;
    }
  }
  
  /// Save user data using SQLite
  Future<bool> saveUser(UserModelAppWuy user) async {
    if (!_isInitialized || _userService == null) {
      debugPrint('WuySQLiteStorageService: Not initialized');
      return false;
    }
    
    try {
      // Save using UserService
      final result = await _userService!.createUser(
        email: user.email ?? '',
        name: user.name,
        role: user.roleName ?? 'user',
        preferences: user.preferences,
      );
      
      if (result is StorageError) {
        debugPrint('WuySQLiteStorageService: Failed to save user: ${result.message}');
        return false;
      }
      
      debugPrint('WuySQLiteStorageService: User saved successfully');
      return true;
    } catch (e) {
      debugPrint('WuySQLiteStorageService: Save user error: $e');
      return false;
    }
  }
  
  /// Get user data from SQLite
  Future<UserModelAppWuy?> getUser(String email) async {
    if (!_isInitialized || _userService == null) {
      debugPrint('WuySQLiteStorageService: Not initialized');
      return null;
    }
    
    try {
      // Get user by email
      final result = await _userService!.authenticateUser(email);
      
      if (result is StorageError) {
        debugPrint('WuySQLiteStorageService: Failed to get user: ${result.message}');
        return null;
      }
      
      final userEntity = result.data;
      if (userEntity == null) {
        debugPrint('WuySQLiteStorageService: User not found');
        return null;
      }
      
      // Convert UserEntity back to UserModelAppWuy
      return UserModelAppWuy(
        id: int.tryParse(userEntity.id) ?? 0,
        name: userEntity.name,
        email: userEntity.email,
        phone: userEntity.metadata['phone'] as String?,
        phoneNumber: userEntity.metadata['phoneNumber'] as String?,
        avatar: userEntity.avatarUrl,
        avatarUrl: userEntity.metadata['avatarUrl'] as String?,
        roleName: userEntity.role ?? 'user',
        preferences: userEntity.preferences,
        createdAt: userEntity.createdAt,
        updatedAt: userEntity.updatedAt,
        isOnline: userEntity.metadata['isOnline'] as bool? ?? false,
        isVerified: userEntity.metadata['isVerified'] as bool? ?? false,
        bio: userEntity.metadata['bio'] as String?,
        lastSeen: userEntity.metadata['lastSeen'] != null 
            ? DateTime.tryParse(userEntity.metadata['lastSeen'] as String)
            : null,
        firstName: userEntity.metadata['firstName'] as String?,
        lastName: userEntity.metadata['lastName'] as String?,
        isActive: userEntity.metadata['isActive'] as bool? ?? true,
      );
    } catch (e) {
      debugPrint('WuySQLiteStorageService: Get user error: $e');
      return null;
    }
  }
  
  /// Update user data in SQLite
  Future<bool> updateUser(UserModelAppWuy user) async {
    if (!_isInitialized || _userService == null) {
      debugPrint('WuySQLiteStorageService: Not initialized');
      return false;
    }
    
    try {
      final result = await _userService!.updateUser(
        user.id.toString(),
        name: user.name,
        role: user.roleName ?? 'user',
        preferences: user.preferences,
      );
      
      if (result is StorageError) {
        debugPrint('WuySQLiteStorageService: Failed to update user: ${result.message}');
        return false;
      }
      
      debugPrint('WuySQLiteStorageService: User updated successfully');
      return true;
    } catch (e) {
      debugPrint('WuySQLiteStorageService: Update user error: $e');
      return false;
    }
  }
  
  /// Delete user from SQLite
  Future<bool> deleteUser(String userId) async {
    if (!_isInitialized || _userService == null) {
      debugPrint('WuySQLiteStorageService: Not initialized');
      return false;
    }
    
    try {
      final result = await _userService!.deleteUser(userId);
      
      if (result is StorageError) {
        debugPrint('WuySQLiteStorageService: Failed to delete user: ${result.message}');
        return false;
      }
      
      debugPrint('WuySQLiteStorageService: User deleted successfully');
      return true;
    } catch (e) {
      debugPrint('WuySQLiteStorageService: Delete user error: $e');
      return false;
    }
  }
  
  /// Save app settings using ConfigService
  Future<bool> saveAppSetting(String key, dynamic value) async {
    if (!_isInitialized || _configService == null) {
      debugPrint('WuySQLiteStorageService: Not initialized');
      return false;
    }
    
    try {
      final result = await _configService!.setConfig(
        key,
        value,
        category: 'app_settings',
        description: 'App setting: $key',
      );
      
      if (result is StorageError) {
        debugPrint('WuySQLiteStorageService: Failed to save setting: ${result.message}');
        return false;
      }
      
      debugPrint('WuySQLiteStorageService: Setting saved successfully');
      return true;
    } catch (e) {
      debugPrint('WuySQLiteStorageService: Save setting error: $e');
      return false;
    }
  }
  
  /// Get app setting from ConfigService
  Future<dynamic> getAppSetting(String key) async {
    if (!_isInitialized || _configService == null) {
      debugPrint('WuySQLiteStorageService: Not initialized');
      return null;
    }
    
    try {
      final result = await _configService!.getConfig(key);
      
      if (result is StorageError) {
        debugPrint('WuySQLiteStorageService: Failed to get setting: ${result.message}');
        return null;
      }
      
      return result.data?.value;
    } catch (e) {
      debugPrint('WuySQLiteStorageService: Get setting error: $e');
      return null;
    }
  }
  
  /// Get storage statistics
  Future<Map<String, dynamic>?> getStorageStats() async {
    if (!_isInitialized) {
      debugPrint('WuySQLiteStorageService: Not initialized');
      return null;
    }
    
    try {
      final userStats = await _userService?.getUserStats();
      final configStats = await _configService?.getConfigStats();
      
      return {
        'storageType': 'SQLite',
        'initialized': _isInitialized,
        'userStats': userStats,
        'configStats': configStats,
        'timestamp': DateTime.now().toIso8601String(),
      };
    } catch (e) {
      debugPrint('WuySQLiteStorageService: Get stats error: $e');
      return null;
    }
  }
  
  /// Dispose resources
  Future<void> dispose() async {
    if (_container != null) {
      await _container!.dispose();
      _container = null;
    }
    _userService = null;
    _configService = null;
    _isInitialized = false;
  }
  
  /// Check if service is initialized
  bool get isInitialized => _isInitialized;
}
