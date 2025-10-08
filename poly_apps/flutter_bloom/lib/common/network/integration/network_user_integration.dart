/// Network and User Provider Integration
/// This file provides integration between the network framework and user providers

import 'package:flutter/foundation.dart';
import '../auth/unified_auth_manager.dart';
import '../core/network_types.dart' as network_types;
import '../../provider_status/user_provider.dart';

/// Network User Integration Manager
/// Handles the integration between network authentication and user providers
class NetworkUserIntegration {
  static NetworkUserIntegration? _instance;
  static NetworkUserIntegration get instance => _instance ??= NetworkUserIntegration._();
  NetworkUserIntegration._();

  BaseUserProvider? _userProvider;
  bool _isInitialized = false;

  /// Initialize integration with user provider
  Future<void> initialize(BaseUserProvider userProvider) async {
    if (_isInitialized) return;

    _userProvider = userProvider;
    
    // Set user provider in auth manager
    UnifiedAuthManager.instance.setUserProvider(userProvider);
    
    // Listen to user provider changes
    userProvider.addListener(_onUserProviderChanged);
    
    _isInitialized = true;
    debugPrint('NetworkUserIntegration initialized');
  }

  /// Handle user provider changes
  void _onUserProviderChanged() {
    if (_userProvider == null) return;

    // Sync authentication state when user provider changes
    final authMetadata = _userProvider!.authMetadata;
    final authManager = UnifiedAuthManager.instance;

    // Update auth manager based on user provider auth metadata
    switch (authMetadata.authType) {
      case network_types.AuthType.jwt:
        if (authMetadata.jwtToken != null) {
          authManager.setToken(
            authMetadata.jwtToken!,
            refreshToken: authMetadata.refreshToken,
            expiresAt: authMetadata.expiresAt,
          );
        }
        break;
      case network_types.AuthType.clientId:
        if (authMetadata.clientId != null) {
          authManager.setClientCredentials(
            authMetadata.clientId!,
            '', // Client secret not stored in user provider for security
          );
        }
        break;
      case network_types.AuthType.clientKey:
        // Handle client key authentication
        break;
      case network_types.AuthType.session:
        if (authMetadata.sessionId != null) {
          authManager.setSessionId(authMetadata.sessionId!);
        }
        break;
      case network_types.AuthType.custom:
        if (authMetadata.customHeaders != null) {
          authManager.setCustomAuthFields(authMetadata.customHeaders!);
        }
        break;
      case network_types.AuthType.headerKey:
        if (authMetadata.headerKey != null && authMetadata.headerValue != null) {
          authManager.setCustomAuthFields({
            authMetadata.headerKey!: authMetadata.headerValue!,
          });
        }
        break;
      case network_types.AuthType.none:
        // No action needed
        break;
      case network_types.AuthType.multiple:
        // Handle multiple auth types
        if (authMetadata.jwtToken != null) {
          authManager.setToken(
            authMetadata.jwtToken!,
            refreshToken: authMetadata.refreshToken,
            expiresAt: authMetadata.expiresAt,
          );
        }
        if (authMetadata.clientId != null) {
          authManager.setClientCredentials(authMetadata.clientId!, '');
        }
        if (authMetadata.sessionId != null) {
          authManager.setSessionId(authMetadata.sessionId!);
        }
        if (authMetadata.customHeaders != null) {
          authManager.setCustomAuthFields(authMetadata.customHeaders!);
        }
        break;
    }
  }

  /// Set authentication for JWT
  Future<void> setJwtAuth({
    required String token,
    String? refreshToken,
    DateTime? expiresAt,
  }) async {
    if (_userProvider == null) return;

    // Update user provider
    _userProvider!.updateAuthMetadata(
      authType: network_types.AuthType.jwt,
      jwtToken: token,
      refreshToken: refreshToken,
      expiresAt: expiresAt,
      isAuthenticated: true,
      authenticatedAt: DateTime.now(),
    );

    // Update auth manager
    await UnifiedAuthManager.instance.setToken(
      token,
      refreshToken: refreshToken,
      expiresAt: expiresAt,
    );
  }

  /// Set authentication for Client ID
  Future<void> setClientIdAuth({
    required String clientId,
    String? headerKey,
  }) async {
    if (_userProvider == null) return;

    // Update user provider
    _userProvider!.updateAuthMetadata(
      authType: network_types.AuthType.clientId,
      clientId: clientId,
      headerKey: headerKey ?? 'X-Client-ID',
      isAuthenticated: true,
      authenticatedAt: DateTime.now(),
    );

    // Update auth manager
    await UnifiedAuthManager.instance.setClientCredentials(clientId, '');
  }

  /// Set authentication for Header Key
  Future<void> setHeaderKeyAuth({
    required String headerKey,
    required String headerValue,
  }) async {
    if (_userProvider == null) return;

    // Update user provider
    _userProvider!.updateAuthMetadata(
      authType: network_types.AuthType.headerKey,
      headerKey: headerKey,
      headerValue: headerValue,
      isAuthenticated: true,
      authenticatedAt: DateTime.now(),
    );

    // Update auth manager
    await UnifiedAuthManager.instance.setCustomAuthFields({
      headerKey: headerValue,
    });
  }

  /// Set authentication for Session
  Future<void> setSessionAuth({
    required String sessionId,
    DateTime? expiresAt,
  }) async {
    if (_userProvider == null) return;

    // Update user provider
    _userProvider!.updateAuthMetadata(
      authType: network_types.AuthType.session,
      sessionId: sessionId,
      expiresAt: expiresAt,
      isAuthenticated: true,
      authenticatedAt: DateTime.now(),
    );

    // Update auth manager
    await UnifiedAuthManager.instance.setSessionId(sessionId);
  }

  /// Set custom authentication
  Future<void> setCustomAuth({
    required Map<String, String> customHeaders,
  }) async {
    if (_userProvider == null) return;

    // Update user provider
    _userProvider!.updateAuthMetadata(
      authType: network_types.AuthType.custom,
      customHeaders: customHeaders,
      isAuthenticated: true,
      authenticatedAt: DateTime.now(),
    );

    // Update auth manager
    await UnifiedAuthManager.instance.setCustomAuthFields(customHeaders);
  }

  /// Clear authentication
  Future<void> clearAuth() async {
    if (_userProvider == null) return;

    // Clear user provider
    _userProvider!.setAuthMetadata(const AuthMetadata());

    // Clear auth manager
    await UnifiedAuthManager.instance.clearAuth();
  }

  /// Check if user is authenticated
  bool get isAuthenticated {
    return _userProvider?.isAuthenticated ?? false;
  }

  /// Check if authentication needs refresh
  bool get needsAuthRefresh {
    return _userProvider?.needsAuthRefresh ?? false;
  }

  /// Get authentication headers
  Map<String, String> getAuthHeaders() {
    return _userProvider?.getAuthHeaders() ?? {};
  }

  /// Check if user has permission
  bool hasPermission(String permission) {
    return _userProvider?.hasPermission(permission) ?? false;
  }

  /// Check if user has role
  bool hasRole(String role) {
    return _userProvider?.hasRole(role) ?? false;
  }

  /// Get current user
  BaseUserModel? get currentUser {
    return _userProvider?.user;
  }

  /// Get authentication metadata
  AuthMetadata get authMetadata {
    return _userProvider?.authMetadata ?? const AuthMetadata();
  }

  /// Get integration status
  Map<String, dynamic> getStatus() {
    return {
      'isInitialized': _isInitialized,
      'hasUserProvider': _userProvider != null,
      'isAuthenticated': isAuthenticated,
      'needsAuthRefresh': needsAuthRefresh,
      'authType': authMetadata.authType.name,
      'hasUser': currentUser != null,
      'userId': currentUser?.id,
      'username': currentUser?.username,
    };
  }

  /// Dispose resources
  void dispose() {
    _userProvider?.removeListener(_onUserProviderChanged);
    _userProvider = null;
    _isInitialized = false;
    _instance = null;
  }
}
