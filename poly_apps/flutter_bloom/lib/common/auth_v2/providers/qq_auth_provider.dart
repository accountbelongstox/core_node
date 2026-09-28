
/// QQ authentication provider implementation
/// Supports QQ login with access token and user info retrieval
library;

import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../auth_interface.dart';
import '../auth_models.dart';
import '../auth_config.dart';

/// QQ authentication provider
class QQAuthProvider extends IAuthProvider {
  static const MethodChannel _channel = MethodChannel('flutter_bloom/auth_qq');

  QQAuthConfig? _config;
  bool _isInitialized = false;
  AuthUser? _currentUser;
  AuthToken? _currentToken;

  @override
  AuthProvider get providerType => AuthProvider.qq;

  @override
  bool get isInitialized => _isInitialized;

  @override
  Future<bool> get isAvailable async {
    try {
      final result = await _channel.invokeMethod('isQQAppInstalled');
      return result as bool? ?? false;
    } catch (e) {
      return false;
    }
  }

  @override
  Future<void> initialize(AuthConfig config) async {
    if (config is! QQAuthConfig) {
      throw ArgumentError('QQAuthConfig required for QQ provider');
    }

    try {
      await _channel.invokeMethod('initialize', {
        'appId': config.appId,
        'appKey': config.appKey,
        'universalLink': config.universalLink,
      });

      _config = config;
      _isInitialized = true;
    } catch (e) {
      _isInitialized = false;
      rethrow;
    }
  }

  @override
  Future<AuthResult> authenticate({
    Map<String, dynamic>? additionalParameters,
  }) async {
    if (!_isInitialized) {
      return AuthResult.failure(
        errorMessage: 'QQ provider not initialized',
        errorCode: AuthError.providerNotConfigured,
      );
    }

    try {
      final available = await isAvailable;
      if (!available) {
        return AuthResult.failure(
          errorMessage: 'QQ app not installed',
          errorCode: AuthError.providerNotAvailable,
        );
      }

      // Start QQ login
      final loginResult = await _channel.invokeMethod('login');

      if (loginResult == null) {
        return AuthResult.failure(
          errorMessage: 'QQ login failed',
          errorCode: AuthError.unknownError,
        );
      }

      final resultData = loginResult as Map<String, dynamic>;
      final ret = resultData['ret'] as int?;

      // Check for QQ login errors
      if (ret != null && ret != 0) {
        return _handleQQError(ret, resultData['msg'] as String?);
      }

      final accessToken = resultData['access_token'] as String?;
      final openId = resultData['openid'] as String?;

      if (accessToken == null || accessToken.isEmpty) {
        return AuthResult.failure(
          errorMessage: 'Failed to get access token',
          errorCode: AuthError.invalidResponse,
        );
      }

      // Create access token object
      final expiresIn = resultData['expires_in'] as int?;
      final token = AuthToken(
        accessToken: accessToken,
        refreshToken: null, // QQ doesn't provide refresh tokens
        tokenType: 'Bearer',
        expiresIn: expiresIn,
        expiresAt: expiresIn != null
            ? DateTime.now().add(Duration(seconds: expiresIn))
            : null,
        additionalData: {
          'openid': openId,
          'appid': _config?.appId,
        },
      );

      // Get user info
      AuthUser? user;
      final userResult = await _getUserInfo(accessToken, openId);
      if (userResult.success) {
        user = userResult.user;
      }

      // Create basic user if user info failed
      user ??= AuthUser(
        id: openId ?? '',
        provider: AuthProvider.qq,
        openId: openId,
        lastLoginAt: DateTime.now(),
      );

      _currentUser = user;
      _currentToken = token;

      return AuthResult.success(
        user: user,
        token: token,
        additionalData: {
          'openid': openId,
          'appid': _config?.appId,
        },
      );
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'QQ authentication error: ${e.toString()}',
        errorCode: AuthError.unknownError,
      );
    }
  }

  @override
  Future<void> signOut() async {
    try {
      await _channel.invokeMethod('logout');
      _currentUser = null;
      _currentToken = null;
    } catch (e) {
      // Continue with cleanup even if logout fails
      _currentUser = null;
      _currentToken = null;
    }
  }

  @override
  Future<AuthToken?> refreshToken(String? refreshToken) async {
    // QQ doesn't support token refresh
    return null;
  }

  @override
  Future<AuthUser?> getCurrentUser() async {
    if (_currentUser != null) {
      return _currentUser;
    }

    // Try to get current user from QQ SDK
    try {
      final userInfo = await _channel.invokeMethod('getCurrentUser');
      if (userInfo != null) {
        final userData = userInfo as Map<String, dynamic>;
        _currentUser = AuthUser(
          id: userData['openid'] as String? ?? '',
          provider: AuthProvider.qq,
          username: userData['nickname'] as String?,
          displayName: userData['nickname'] as String?,
          avatar: userData['figureurl_qq_2'] as String? ??
              userData['figureurl_qq_1'] as String?,
          openId: userData['openid'] as String?,
          profile: userData,
          lastLoginAt: DateTime.now(),
        );
        return _currentUser;
      }
    } catch (e) {
      // Ignore error and return null
    }

    return null;
  }

  @override
  Future<bool> get isAuthenticated async {
    if (_currentToken != null && !_currentToken!.isExpired) {
      return true;
    }

    final user = await getCurrentUser();
    return user != null;
  }

  @override
  Future<Map<String, dynamic>?> getUserProfile() async {
    final user = await getCurrentUser();
    return user?.profile;
  }

  @override
  Future<bool> updateUserProfile(Map<String, dynamic> profile) async {
    // QQ doesn't support profile updates
    return false;
  }

  @override
  Future<AuthResult> linkAdditionalProvider(
    AuthProvider provider,
    AuthConfig config,
  ) async {
    // QQ doesn't support linking additional providers
    return AuthResult.failure(
      errorMessage: 'QQ does not support linking additional providers',
      errorCode: AuthError.accountNotLinked,
    );
  }

  @override
  Future<bool> unlinkProvider(AuthProvider provider) async {
    // QQ doesn't support unlinking providers
    return false;
  }

  @override
  Future<List<AuthProvider>> getLinkedProviders() async {
    // QQ doesn't support linked providers
    return [];
  }

  @override
  void dispose() {
    _currentUser = null;
    _currentToken = null;
    _config = null;
    _isInitialized = false;
  }

  /// Get user information from QQ API
  Future<AuthResult> _getUserInfo(String accessToken, String? openId) async {
    if (openId == null || openId.isEmpty) {
      return AuthResult.failure(
        errorMessage: 'OpenID is required to get user info',
        errorCode: AuthError.invalidResponse,
      );
    }

    if (_config == null) {
      return AuthResult.failure(
        errorMessage: 'QQ provider not configured',
        errorCode: AuthError.providerNotConfigured,
      );
    }

    try {
      final response = await http.get(
        Uri.parse(
          'https://graph.qq.com/user/get_user_info?access_token=$accessToken&oauth_consumer_key=${_config!.appId}&openid=$openId',
        ),
      );

      if (response.statusCode != 200) {
        return AuthResult.failure(
          errorMessage: 'Failed to get user info',
          errorCode: AuthError.networkError,
        );
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final ret = data['ret'] as int?;

      if (ret != null && ret != 0) {
        return AuthResult.failure(
          errorMessage: data['msg'] as String? ?? 'Failed to get user info',
          errorCode: _mapQQUserError(ret),
        );
      }

      final user = AuthUser(
        id: openId,
        provider: AuthProvider.qq,
        username: data['nickname'] as String?,
        displayName: data['nickname'] as String?,
        avatar: data['figureurl_qq_2'] as String? ??
            data['figureurl_qq_1'] as String?,
        openId: openId,
        profile: data,
        lastLoginAt: DateTime.now(),
      );

      return AuthResult(
        success: true,
        user: user,
      );
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'User info error: ${e.toString()}',
        errorCode: AuthError.networkError,
      );
    }
  }

  /// Handle QQ login errors
  AuthResult _handleQQError(int errorCode, String? errorMsg) {
    switch (errorCode) {
      case 100014: // User cancel
        return AuthResult.failure(
          errorMessage: 'User cancelled login',
          errorCode: AuthError.userCancelled,
        );
      case 100015: // User deny authorization
        return AuthResult.failure(
          errorMessage: 'User denied authorization',
          errorCode: AuthError.userCancelled,
        );
      case 100001: // Network error
        return AuthResult.failure(
          errorMessage: 'Network error',
          errorCode: AuthError.networkError,
        );
      default:
        return AuthResult.failure(
          errorMessage: errorMsg ?? 'QQ login failed',
          errorCode: AuthError.unknownError,
        );
    }
  }

  /// Map QQ user info errors to AuthError
  AuthError _mapQQUserError(int errorCode) {
    switch (errorCode) {
      case 100001: // Network error
        return AuthError.networkError;
      case 100002: // Invalid protocol
        return AuthError.invalidRequest;
      case 100003: // Invalid parameter
        return AuthError.invalidRequest;
      case 100004: // Access token invalid or expired
        return AuthError.sessionExpired;
      case 100005: // App ID invalid
        return AuthError.providerNotConfigured;
      case 100006: // OpenID invalid
        return AuthError.invalidCredentials;
      case 100007: // Sub app ID invalid
        return AuthError.providerNotConfigured;
      case 100008: // Request too frequent
        return AuthError.tooManyAttempts;
      default:
        return AuthError.unknownError;
    }
  }
}