
/// Authentication manager for coordinating multiple authentication providers
/// Provides a unified interface for authentication across different providers
library auth_manager;

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../auth_interface.dart';
import '../auth_models.dart';
import '../auth_config.dart';
import 'providers/wechat_auth_provider.dart';
import 'providers/qq_auth_provider.dart';
import 'providers/google_auth_provider.dart';
import 'providers/github_auth_provider.dart';
import 'providers/phone_auth_provider.dart';

/// Authentication manager implementation
class AuthenticationManager extends IAuthenticationManager {
  AppAuthConfig? _config;
  final Map<AuthProvider, IAuthProvider> _providers = {};
  final List<IAuthStateListener> _listeners = [];
  final StreamController<AuthResult?> _authStateController =
      StreamController<AuthResult?>.broadcast();
  AuthUser? _currentUser;
  AuthToken? _currentToken;
  AuthSession? _currentSession;
  Timer? _sessionTimer;

  @override
  Future<void> initialize(AppAuthConfig config) async {
    _config = config;

    // Initialize all enabled providers
    for (final providerType in config.enabledProviders) {
      try {
        final providerConfig = config.providers[providerType];
        if (providerConfig != null) {
          final provider = _createProvider(providerType);
          await provider.initialize(providerConfig);
          _providers[providerType] = provider;
        }
      } catch (e) {
        if (kDebugMode) {
          print('Failed to initialize ${providerType.name} provider: $e');
        }
      }
    }

    // Try to restore existing session
    await _restoreSession();
  }

  @override
  Future<AuthResult> authenticate(
    AuthProvider provider, {
    Map<String, dynamic>? additionalParameters,
  }) async {
    if (_config == null) {
      return AuthResult.failure(
        errorMessage: 'Authentication manager not initialized',
        errorCode: AuthError.providerNotConfigured,
      );
    }

    final authProvider = _providers[provider];
    if (authProvider == null) {
      return AuthResult.failure(
        errorMessage: 'Provider ${provider.name} not available',
        errorCode: AuthError.providerNotAvailable,
      );
    }

    try {
      final result = await authProvider.authenticate(
        additionalParameters: additionalParameters,
      );

      if (result.success && result.user != null && result.token != null) {
        await _handleSuccessfulAuthentication(result);
      }

      return result;
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'Authentication error: ${e.toString()}',
        errorCode: AuthError.unknownError,
      );
    }
  }

  @override
  Future<void> signOut() async {
    try {
      // Sign out from all providers
      for (final provider in _providers.values) {
        try {
          await provider.signOut();
        } catch (e) {
          if (kDebugMode) {
            print('Error signing out from provider: $e');
          }
        }
      }

      // Clear current session
      await _clearSession();

      // Notify listeners
      for (final listener in _listeners) {
        try {
          listener.onAuthStateChanged(null);
        } catch (e) {
          if (kDebugMode) {
            print('Error notifying listener: $e');
          }
        }
      }

      _authStateController.add(null);
    } catch (e) {
      if (kDebugMode) {
        print('Error during sign out: $e');
      }
    }
  }

  @override
  Future<void> signOutFrom(AuthProvider provider) async {
    final authProvider = _providers[provider];
    if (authProvider == null) {
      return;
    }

    try {
      await authProvider.signOut();
    } catch (e) {
      if (kDebugMode) {
        print('Error signing out from ${provider.name}: $e');
      }
    }
  }

  @override
  AuthUser? get currentUser => _currentUser;

  @override
  AuthToken? get currentToken => _currentToken;

  @override
  bool get isAuthenticated {
    return _currentUser != null &&
        _currentToken != null &&
        !_currentToken!.isExpired;
  }

  @override
  Stream<AuthResult?> get authStateStream => _authStateController.stream;

  @override
  void addAuthStateListener(IAuthStateListener listener) {
    if (!_listeners.contains(listener)) {
      _listeners.add(listener);
    }
  }

  @override
  void removeAuthStateListener(IAuthStateListener listener) {
    _listeners.remove(listener);
  }

  @override
  Future<bool> refreshToken() async {
    if (_currentToken?.refreshToken == null) {
      return false;
    }

    final provider = _getProviderForToken(_currentToken!);
    if (provider == null) {
      return false;
    }

    try {
      final newToken = await provider.refreshToken(_currentToken!.refreshToken);
      if (newToken != null) {
        _currentToken = newToken;
        await _saveToken(newToken);

        // Notify listeners
        for (final listener in _listeners) {
          try {
            listener.onTokenRefreshed(newToken);
          } catch (e) {
            if (kDebugMode) {
              print('Error notifying listener about token refresh: $e');
            }
          }
        }

        return true;
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error refreshing token: $e');
      }
    }

    return false;
  }

  @override
  List<AuthProvider> get availableProviders => _providers.keys.toList();

  @override
  bool isProviderAvailable(AuthProvider provider) {
    return _providers.containsKey(provider);
  }

  @override
  Future<AuthResult> linkAdditionalProvider(
    AuthProvider provider,
    AuthConfig config,
  ) async {
    if (!isAuthenticated) {
      return AuthResult.failure(
        errorMessage: 'User not authenticated',
        errorCode: AuthError.invalidCredentials,
      );
    }

    final authProvider = _providers[provider];
    if (authProvider == null) {
      return AuthResult.failure(
        errorMessage: 'Provider ${provider.name} not available',
        errorCode: AuthError.providerNotAvailable,
      );
    }

    try {
      return await authProvider.linkAdditionalProvider(provider, config);
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'Provider linking error: ${e.toString()}',
        errorCode: AuthError.unknownError,
      );
    }
  }

  @override
  Future<bool> unlinkProvider(AuthProvider provider) async {
    final authProvider = _providers[provider];
    if (authProvider == null) {
      return false;
    }

    try {
      return await authProvider.unlinkProvider(provider);
    } catch (e) {
      return false;
    }
  }

  @override
  Future<List<AuthProvider>> getLinkedProviders() async {
    if (!isAuthenticated) {
      return [];
    }

    // Get the current provider and check for linked providers
    final currentProvider = _getProviderForToken(_currentToken!);
    if (currentProvider == null) {
      return [];
    }

    try {
      return await currentProvider.getLinkedProviders();
    } catch (e) {
      return [];
    }
  }

  @override
  Future<AuthResult> switchProvider(AuthProvider newProvider) async {
    if (!isProviderAvailable(newProvider)) {
      return AuthResult.failure(
        errorMessage: 'Provider ${newProvider.name} not available',
        errorCode: AuthError.providerNotAvailable,
      );
    }

    final result = await authenticate(newProvider);
    if (result.success) {
      // Sign out from other providers
      for (final provider in _providers.keys) {
        if (provider != newProvider) {
          await signOutFrom(provider);
        }
      }
    }

    return result;
  }

  @override
  AuthSession? get currentSession => _currentSession;

  @override
  Future<bool> validateSession() async {
    if (_currentSession == null || _currentSession!.isExpired) {
      await _clearSession();
      return false;
    }

    if (_currentToken?.isExpired == true) {
      final refreshed = await refreshToken();
      if (!refreshed) {
        await _clearSession();
        return false;
      }
    }

    // Update last activity time
    _currentSession = _currentSession?.copyWith(
      lastActivityAt: DateTime.now(),
    );

    await _saveSession(_currentSession!);

    return true;
  }

  @override
  Future<bool> updateUserProfile(Map<String, dynamic> profile) async {
    if (!isAuthenticated) {
      return false;
    }

    final provider = _getProviderForToken(_currentToken!);
    if (provider == null) {
      return false;
    }

    try {
      final success = await provider.updateUserProfile(profile);
      if (success) {
        // Update user profile
        _currentUser = _currentUser?.copyWith(profile: {
          ...(_currentUser?.profile ?? {}),
          ...profile,
        });

        await _saveUser(_currentUser!);

        // Notify listeners
        for (final listener in _listeners) {
          try {
            listener.onUserProfileUpdated(_currentUser!);
          } catch (e) {
            if (kDebugMode) {
              print('Error notifying listener about profile update: $e');
            }
          }
        }
      }

      return success;
    } catch (e) {
      return false;
    }
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    _authStateController.close();
    _listeners.clear();

    for (final provider in _providers.values) {
      provider.dispose();
    }

    _providers.clear();
    _currentUser = null;
    _currentToken = null;
    _currentSession = null;
  }

  /// Create authentication provider instance
  IAuthProvider _createProvider(AuthProvider type) {
    switch (type) {
      case AuthProvider.wechat:
        return WeChatAuthProvider();
      case AuthProvider.qq:
        return QQAuthProvider();
      case AuthProvider.google:
        return GoogleAuthProvider();
      case AuthProvider.github:
        return GitHubAuthProvider();
      case AuthProvider.phone:
        return PhoneAuthProvider();
      case AuthProvider.email:
        throw ArgumentError('Email provider not implemented yet');
    }
  }

  /// Handle successful authentication
  Future<void> _handleSuccessfulAuthentication(AuthResult result) async {
    if (result.user != null && result.token != null) {
      _currentUser = result.user;
      _currentToken = result.token;

      // Create session
      _currentSession = AuthSession(
        sessionId: _generateSessionId(),
        userId: result.user!.id,
        provider: result.user!.provider,
        createdAt: DateTime.now(),
        lastActivityAt: DateTime.now(),
        expiresAt: _config?.sessionTimeoutMinutes != null
            ? DateTime.now().add(Duration(minutes: _config!.sessionTimeoutMinutes!))
            : null,
        metadata: result.additionalData,
      );

      // Save data
      await _saveUser(result.user!);
      await _saveToken(result.token!);
      await _saveSession(_currentSession!);

      // Start session timer
      _startSessionTimer();

      // Notify listeners
      for (final listener in _listeners) {
        try {
          listener.onAuthStateChanged(result);
        } catch (e) {
          if (kDebugMode) {
            print('Error notifying listener: $e');
          }
        }
      }

      _authStateController.add(result);
    }
  }

  /// Generate unique session ID
  String _generateSessionId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = DateTime.now().microsecondsSinceEpoch;
    return 'session_${timestamp}_$random';
  }

  /// Start session expiration timer
  void _startSessionTimer() {
    _sessionTimer?.cancel();

    if (_currentSession?.expiresAt != null) {
      final duration = _currentSession!.expiresAt!.difference(DateTime.now());
      if (duration.isPositive) {
        _sessionTimer = Timer(duration, () {
          _handleSessionExpired();
        });
      }
    }
  }

  /// Handle session expiration
  void _handleSessionExpired() {
    for (final listener in _listeners) {
      try {
        listener.onSessionExpired();
      } catch (e) {
        if (kDebugMode) {
          print('Error notifying listener about session expiration: $e');
        }
      }
    }

    _clearSession();
    _authStateController.add(null);
  }

  /// Get provider associated with token
  IAuthProvider? _getProviderForToken(AuthToken token) {
    for (final provider in _providers.values) {
      if (provider.providerType.name.toLowerCase() ==
          token.additionalData?['provider']?.toString().toLowerCase()) {
        return provider;
      }
    }

    // Fallback to any available provider
    return _providers.values.isNotEmpty ? _providers.values.first : null;
  }

  /// Save user data to storage
  Future<void> _saveUser(AuthUser user) async {
    // This would integrate with Flutter Bloom's storage system
    // For now, we'll just use a placeholder
    try {
      // Implementation would use common/storage
      if (kDebugMode) {
        print('Saving user data: ${user.id}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error saving user data: $e');
      }
    }
  }

  /// Save token data to storage
  Future<void> _saveToken(AuthToken token) async {
    // This would integrate with Flutter Bloom's storage system
    try {
      if (kDebugMode) {
        print('Saving token data');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error saving token data: $e');
      }
    }
  }

  /// Save session data to storage
  Future<void> _saveSession(AuthSession session) async {
    // This would integrate with Flutter Bloom's storage system
    try {
      if (kDebugMode) {
        print('Saving session data: ${session.sessionId}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error saving session data: $e');
      }
    }
  }

  /// Restore existing session
  Future<void> _restoreSession() async {
    // This would integrate with Flutter Bloom's storage system
    try {
      if (kDebugMode) {
        print('Restoring session data');
      }
      // Implementation would load saved data and set _currentUser, _currentToken, _currentSession
    } catch (e) {
      if (kDebugMode) {
        print('Error restoring session: $e');
      }
    }
  }

  /// Clear session data
  Future<void> _clearSession() async {
    _sessionTimer?.cancel();
    _sessionTimer = null;
    _currentUser = null;
    _currentToken = null;
    _currentSession = null;

    // Clear stored data
    try {
      if (kDebugMode) {
        print('Clearing session data');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error clearing session data: $e');
      }
    }
  }
}