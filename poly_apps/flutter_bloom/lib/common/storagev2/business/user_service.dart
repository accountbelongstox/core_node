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
import '../models/user_entity.dart';

/// User business logic service
class UserService {
  final UserRepository _userRepository;
  
  UserService({required UserRepository userRepository})
      : _userRepository = userRepository;
  
  /// Create a new user
  Future<StorageResult<UserEntity>> createUser({
    required String email,
    String? name,
    String? role,
    Map<String, dynamic>? preferences,
  }) async {
    try {
      // Check if user already exists
      final existingResult = await _userRepository.getByEmail(email);
      if (existingResult is StorageError) {
        return existingResult;
      }
      
      if (existingResult.data != null) {
        return StorageError.withCode(
          'USER_ALREADY_EXISTS',
          'User with email $email already exists',
        );
      }
      
      // Validate email format
      if (!_isValidEmail(email)) {
        return StorageError.withCode(
          'INVALID_EMAIL',
          'Invalid email format: $email',
        );
      }
      
      // Create new user
      final user = UserEntity.create(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        email: email,
        name: name,
        role: role ?? 'user',
        preferences: preferences ?? {},
      );
      
      return await _userRepository.save(user);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to create user',
      );
    }
  }
  
  /// Update user information
  Future<StorageResult<UserEntity>> updateUser(
    String userId, {
    String? name,
    String? role,
    Map<String, dynamic>? preferences,
  }) async {
    try {
      final userResult = await _userRepository.getById(userId);
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
      
      final updatedUser = user.copyWith(
        name: name,
        role: role,
        preferences: preferences,
      );
      
      return await _userRepository.update(updatedUser);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to update user: $userId',
      );
    }
  }
  
  /// Authenticate user
  Future<StorageResult<UserEntity>> authenticateUser(String email) async {
    try {
      final userResult = await _userRepository.getByEmail(email);
      if (userResult is StorageError) {
        return userResult;
      }
      
      final user = userResult.data;
      if (user == null) {
        return StorageError.withCode(
          'USER_NOT_FOUND',
          'User not found: $email',
        );
      }
      
      if (!user.isActive) {
        return StorageError.withCode(
          'USER_INACTIVE',
          'User account is inactive: $email',
        );
      }
      
      // Update last login
      final loginResult = await _userRepository.updateLastLogin(user.id);
      if (loginResult is StorageError) {
        return loginResult;
      }
      
      return StorageSuccess(loginResult.data!);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to authenticate user: $email',
      );
    }
  }
  
  /// Deactivate user
  Future<StorageResult<UserEntity>> deactivateUser(String userId) async {
    try {
      final userResult = await _userRepository.getById(userId);
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
      
      final deactivatedUser = user.deactivate();
      return await _userRepository.update(deactivatedUser);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to deactivate user: $userId',
      );
    }
  }
  
  /// Activate user
  Future<StorageResult<UserEntity>> activateUser(String userId) async {
    try {
      final userResult = await _userRepository.getById(userId);
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
      
      final activatedUser = user.activate();
      return await _userRepository.update(activatedUser);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to activate user: $userId',
      );
    }
  }
  
  /// Get users by role
  Future<StorageResult<List<UserEntity>>> getUsersByRole(String role) async {
    try {
      return await _userRepository.getByRole(role);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get users by role: $role',
      );
    }
  }
  
  /// Get active users
  Future<StorageResult<List<UserEntity>>> getActiveUsers() async {
    try {
      return await _userRepository.getActiveUsers();
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get active users',
      );
    }
  }
  
  /// Update user preferences
  Future<StorageResult<UserEntity>> updateUserPreferences(
    String userId,
    Map<String, dynamic> newPreferences,
  ) async {
    try {
      final userResult = await _userRepository.getById(userId);
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
      
      final updatedUser = user.updatePreferences(newPreferences);
      return await _userRepository.update(updatedUser);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to update user preferences: $userId',
      );
    }
  }
  
  /// Delete user
  Future<StorageResult<void>> deleteUser(String userId) async {
    try {
      final userResult = await _userRepository.getById(userId);
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
      
      return await _userRepository.deleteById(userId);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to delete user: $userId',
      );
    }
  }
  
  /// Get user by ID
  Future<StorageResult<UserEntity?>> getUserById(String userId) async {
    try {
      return await _userRepository.getById(userId);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get user by ID: $userId',
      );
    }
  }
  
  /// Get user statistics
  Future<StorageResult<Map<String, dynamic>>> getUserStats() async {
    try {
      final allUsersResult = await _userRepository.getAll();
      if (allUsersResult is StorageError) {
        return allUsersResult;
      }
      
      final allUsers = allUsersResult.data ?? [];
      final activeUsers = allUsers.where((u) => u.isActive).length;
      final inactiveUsers = allUsers.length - activeUsers;
      
      final roleStats = <String, int>{};
      for (final user in allUsers) {
        roleStats[user.role ?? 'unknown'] = (roleStats[user.role ?? 'unknown'] ?? 0) + 1;
      }
      
      return StorageSuccess({
        'totalUsers': allUsers.length,
        'activeUsers': activeUsers,
        'inactiveUsers': inactiveUsers,
        'roleStats': roleStats,
        'lastUpdated': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get user statistics',
      );
    }
  }
  
  /// Validate email format
  bool _isValidEmail(String email) {
    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    return emailRegex.hasMatch(email);
  }
}
