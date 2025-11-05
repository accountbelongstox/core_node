/// User provider for app_qy authentication state management
library;

import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../../../common/auth_v2/auth_v2.dart';
import '../features_app_qy/authentication/auth_config_app_qy.dart';
import '../services_app_qy/cache_service_app_qy.dart';

class UserProviderAppQy extends ChangeNotifier {
  late final AuthenticationManager _authManager;
  late final AuthServiceAppQy _authService;
  late final CacheServiceAppQy _cacheService;

  AuthUser? _currentUser;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  String? _errorMessage;

  // Getters
  AuthUser? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  AuthenticationManager get authManager => _authManager;

  UserProviderAppQy() {
    _authManager = AuthenticationManager();
    _authService = AuthServiceAppQy(_authManager);
    _cacheService = CacheServiceAppQy();
  }

  /// Initialize authentication with configuration
  Future<void> initializeAuth() async {
    try {
      _setLoading(true);

      // Initialize authentication manager with app-specific configuration
      await _authManager.initialize(AuthConfigAppQy.currentConfig);

      // Try to restore existing session
      await _restoreSession();

      // Listen to authentication state changes
      _authManager.authStateStream.listen(_onAuthStateChanged);

    } catch (e) {
      _setError('Authentication initialization error: $e');
    } finally {
      _setLoading(false);
    }
  }

  /// Login with phone number and verification code
  Future<bool> loginWithPhone(String phoneNumber, String verificationCode) async {
    try {
      _setLoading(true);
      _clearError();

      final result = await _authService.authenticateWithPhone(phoneNumber, verificationCode);

      if (result.success && result.user != null && result.token != null) {
        await _handleSuccessfulAuth(result.user!, result.token!);
        return true;
      } else {
        _setError(result.errorMessage ?? 'Phone login failed');
        return false;
      }

    } catch (e) {
      _setError('Phone login error: $e');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Login with WeChat
  Future<bool> loginWithWeChat() async {
    try {
      _setLoading(true);
      _clearError();

      final result = await _authService.authenticateWithWeChat();

      if (result.success && result.user != null && result.token != null) {
        await _handleSuccessfulAuth(result.user!, result.token!);
        return true;
      } else {
        _setError(result.errorMessage ?? 'WeChat login failed');
        return false;
      }

    } catch (e) {
      _setError('WeChat login error: $e');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Skip login for development/debug purposes
  Future<bool> skipLogin() async {
    try {
      _setLoading(true);
      _clearError();

      // Create mock user for development
      final mockUser = AuthUser(
        id: 'debug_user_${DateTime.now().millisecondsSinceEpoch}',
        provider: AuthProvider.phone,
        displayName: 'Debug User',
        email: 'debug@shanbay.com',
        createdAt: DateTime.now(),
        lastLoginAt: DateTime.now(),
      );

      final mockToken = AuthToken(
        accessToken: 'debug_token_${DateTime.now().millisecondsSinceEpoch}',
        refreshToken: 'debug_refresh_token',
        tokenType: 'Bearer',
        expiresIn: 86400,
        expiresAt: DateTime.now().add(const Duration(hours: 24)),
      );

      await _handleSuccessfulAuth(mockUser, mockToken);
      return true;

    } catch (e) {
      _setError('Skip login failed: $e');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Send verification code
  Future<PhoneAuthResult> sendVerificationCode(String phoneNumber) async {
    try {
      return await _authService.sendVerificationCode(phoneNumber);
    } catch (e) {
      return PhoneAuthResult.failure(
        errorMessage: 'Send verification code failed: $e',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }
  }

  /// Sign out current user
  Future<void> signOut() async {
    try {
      await _authService.signOut();
      await _clearSession();
    } catch (e) {
      if (kDebugMode) {
        print('Sign out error: $e');
      }
    }
  }

  /// Check if session is valid
  Future<bool> validateSession() async {
    try {
      return await _authService.validateSession();
    } catch (e) {
      if (kDebugMode) {
        print('Session validation error: $e');
      }
      return false;
    }
  }

  /// Refresh current token
  Future<bool> refreshToken() async {
    try {
      return await _authService.refreshToken();
    } catch (e) {
      _setError('Token refresh failed: $e');
      return false;
    }
  }

  /// Update user profile
  Future<bool> updateProfile(Map<String, dynamic> profile) async {
    try {
      return await _authManager.updateUserProfile(profile);
    } catch (e) {
      _setError('Profile update failed: $e');
      return false;
    }
  }

  /// Validate phone number
  bool validatePhoneNumber(String phoneNumber) {
    return _authService.validatePhoneNumber(phoneNumber);
  }

  /// Validate verification code
  bool validateVerificationCode(String code) {
    return _authService.validateVerificationCode(code);
  }

  /// Handle successful authentication
  Future<void> _handleSuccessfulAuth(AuthUser user, AuthToken token) async {
    _currentUser = user;
    _isAuthenticated = true;

    // Save to cache
    await _cacheService.saveUser(user);
    await _cacheService.saveToken(token);

    notifyListeners();
  }

  /// Restore existing session from cache
  Future<void> _restoreSession() async {
    try {
      final cachedUser = await _cacheService.getUser();
      final cachedToken = await _cacheService.getToken();

      if (cachedUser != null && cachedToken != null && !cachedToken.isExpired) {
        _currentUser = cachedUser;
        _isAuthenticated = true;

        // Validate session with auth manager
        final isValid = await _authManager.validateSession();
        if (!isValid) {
          await _clearSession();
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Session restore error: $e');
      }
      await _clearSession();
    }
  }

  /// Clear session data
  Future<void> _clearSession() async {
    _currentUser = null;
    _isAuthenticated = false;

    await _cacheService.clearUser();
    await _cacheService.clearToken();

    notifyListeners();
  }

  /// Handle authentication state changes
  void _onAuthStateChanged(AuthResult? result) {
    if (result != null && result.success && result.user != null) {
      _currentUser = result.user;
      _isAuthenticated = true;
      notifyListeners();
    } else {
      _currentUser = null;
      _isAuthenticated = false;
      notifyListeners();
    }
  }

  /// Set loading state
  void _setLoading(bool loading) {
    if (_isLoading != loading) {
      _isLoading = loading;
      notifyListeners();
    }
  }

  /// Set error message
  void _setError(String error) {
    _errorMessage = error;
    notifyListeners();
  }

  /// Clear error message
  void _clearError() {
    if (_errorMessage != null) {
      _errorMessage = null;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _authManager.dispose();
    super.dispose();
  }
}