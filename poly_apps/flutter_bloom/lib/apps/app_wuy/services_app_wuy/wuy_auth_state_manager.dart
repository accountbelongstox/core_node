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

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:qyflutter/common/storage/unified_storage.dart';
import '../models_app_wuy/user_model_app_wuy.dart';

/// Unified Authentication State Manager for Wuy App
/// Centralizes authentication state management and ensures data consistency
/// Provides single source of truth for authentication status and user data
class WuyAuthStateManager {
  static WuyAuthStateManager? _instance;
  static WuyAuthStateManager get instance =>
      _instance ??= WuyAuthStateManager._internal();

  WuyAuthStateManager._internal();

  // State management
  UserModelAppWuy? _currentUser;
  bool _isAuthenticated = false;
  final StreamController<AuthState> _authStateController =
      StreamController<AuthState>.broadcast();

  // Getters
  UserModelAppWuy? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  Stream<AuthState> get authStateStream => _authStateController.stream;

  /// Initialize the auth state manager
  Future<void> initialize() async {
    try {
      // Load authentication state from storage
      await _loadAuthState();

      debugPrint(
          'WuyAuthStateManager initialized - isAuthenticated: $_isAuthenticated');
    } catch (e) {
      debugPrint('WuyAuthStateManager initialization failed: $e');
      // Set default state if initialization fails
      _isAuthenticated = false;
      _currentUser = null;
      _notifyAuthStateChange(AuthState.unauthenticated);
    }
  }

  /// Load authentication state from storage
  Future<void> _loadAuthState() async {
    try {
      // Check if UnifiedStorage is initialized before attempting to load
      // This prevents the "UnifiedStorage not initialized" error
      final userData = await UnifiedStorage.get('user_profile');
      if (userData != null && userData is Map<String, dynamic>) {
        _currentUser = UserModelAppWuy.fromJson(userData);
        _isAuthenticated = true;
        _notifyAuthStateChange(AuthState.authenticated);
        debugPrint(
            'Auth state loaded from storage for user: ${_currentUser?.displayName}');
      } else {
        _isAuthenticated = false;
        _currentUser = null;
        _notifyAuthStateChange(AuthState.unauthenticated);
        debugPrint('No auth state found in storage');
      }
    } catch (e) {
      debugPrint('Error loading auth state: $e');
      // If UnifiedStorage is not initialized, set default unauthenticated state
      _isAuthenticated = false;
      _currentUser = null;
      _notifyAuthStateChange(AuthState.unauthenticated);
    }
  }

  /// Set authenticated user with comprehensive state management
  Future<void> setAuthenticatedUser(UserModelAppWuy user) async {
    try {
      _currentUser = user;
      _isAuthenticated = true;

      // Save to storage only if UnifiedStorage is initialized
      try {
        await UnifiedStorage.set('user_profile', user.toJson());
        await UnifiedStorage.set('user_preferences', user.preferences);
        await UnifiedStorage.set(
            'auth_timestamp', DateTime.now().millisecondsSinceEpoch);
        debugPrint('User data saved to storage');
      } catch (storageError) {
        debugPrint(
            'Warning: Could not save to storage (may not be initialized): $storageError');
        // Continue without throwing - the user is still authenticated in memory
      }

      // Notify state change
      _notifyAuthStateChange(AuthState.authenticated);

      debugPrint('User authenticated: ${user.displayName}');
      debugPrint('Auth state manager: isAuthenticated = $_isAuthenticated');
    } catch (e) {
      debugPrint('Error setting authenticated user: $e');
      rethrow;
    }
  }

  /// Clear authentication state
  Future<void> clearAuthentication() async {
    try {
      _currentUser = null;
      _isAuthenticated = false;

      // Clear from storage only if UnifiedStorage is initialized
      try {
        await UnifiedStorage.remove('user_profile');
        await UnifiedStorage.remove('user_preferences');
        await UnifiedStorage.remove('auth_timestamp');
        debugPrint('User data cleared from storage');
      } catch (storageError) {
        debugPrint(
            'Warning: Could not clear from storage (may not be initialized): $storageError');
        // Continue without throwing - the user is still cleared in memory
      }

      // User provider will be cleared separately to avoid circular dependency

      _notifyAuthStateChange(AuthState.unauthenticated);
      debugPrint('Authentication cleared');
    } catch (e) {
      debugPrint('Error clearing authentication: $e');
      rethrow;
    }
  }

  /// Check if user has specific permission
  bool hasPermission(String permission) {
    if (!_isAuthenticated || _currentUser == null) {
      return false;
    }

    // Check user permissions based on role or specific permissions
    // This can be extended based on your permission system
    return _currentUser!.isActive && _currentUser!.isVerified;
  }

  /// Check if user can access API endpoint
  bool canAccessApi(String endpoint) {
    if (!_isAuthenticated || _currentUser == null) {
      return false;
    }

    // Define API access rules based on endpoint
    if (endpoint.contains('/auth/') || endpoint.contains('/public/')) {
      return true; // Public endpoints
    }

    // Protected endpoints require authentication
    return _isAuthenticated;
  }

  /// Get user context for API requests
  Map<String, dynamic>? getUserContext() {
    if (!_isAuthenticated || _currentUser == null) {
      return null;
    }

    return {
      'user_id': _currentUser!.id,
      'user_name': _currentUser!.displayName,
      'user_phone': _currentUser!.phoneNumber,
      'is_verified': _currentUser!.isVerified,
      'is_active': _currentUser!.isActive,
      'auth_timestamp': DateTime.now().millisecondsSinceEpoch,
    };
  }

  /// Validate authentication token/state
  Future<bool> validateAuthState() async {
    try {
      if (!_isAuthenticated || _currentUser == null) {
        return false;
      }

      // Check if auth is still valid (e.g., not expired)
      final authTimestamp = await UnifiedStorage.get('auth_timestamp');
      if (authTimestamp != null) {
        final timestamp = authTimestamp as int;
        final authTime = DateTime.fromMillisecondsSinceEpoch(timestamp);
        final now = DateTime.now();

        // Check if auth is older than 30 days (example)
        if (now.difference(authTime).inDays > 30) {
          await clearAuthentication();
          return false;
        }
      }

      return true;
    } catch (e) {
      debugPrint('Error validating auth state: $e');
      return false;
    }
  }

  /// Get initial route based on authentication state
  String getInitialRoute() {
    if (_isAuthenticated && _currentUser != null) {
      debugPrint(
          'Auth state manager: User authenticated, returning home route');
      return '/wuy/map'; // Map is the home page (matching React version)
    } else {
      debugPrint(
          'Auth state manager: User not authenticated, returning login entry route');
      return '/wuy/login-entry';
    }
  }

  /// Handle login success
  Future<void> onLoginSuccess(UserModelAppWuy user) async {
    await setAuthenticatedUser(user);
    debugPrint('Login success handled for user: ${user.displayName}');
  }

  /// Handle logout
  Future<void> onLogout() async {
    await clearAuthentication();
    debugPrint('Logout handled');
  }

  /// Notify auth state change
  void _notifyAuthStateChange(AuthState state) {
    if (!_authStateController.isClosed) {
      _authStateController.add(state);
    }
  }

  /// Dispose resources
  void dispose() {
    _authStateController.close();
  }
}

/// Authentication state enum
enum AuthState {
  authenticated,
  unauthenticated,
  loading,
}

/// Authentication result class
class AuthResult {
  final bool isSuccess;
  final String message;
  final String? error;
  final UserModelAppWuy? user;

  AuthResult._({
    required this.isSuccess,
    required this.message,
    this.error,
    this.user,
  });

  factory AuthResult.success(UserModelAppWuy? user, String message) {
    return AuthResult._(
      isSuccess: true,
      message: message,
      user: user,
    );
  }

  factory AuthResult.error(String error) {
    return AuthResult._(
      isSuccess: false,
      message: error,
      error: error,
    );
  }
}
