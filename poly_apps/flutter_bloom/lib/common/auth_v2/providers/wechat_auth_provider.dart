
library;

import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../auth_interface.dart';
import '../auth_models.dart';
import '../auth_config.dart';

/// WeChat authentication provider
class WeChatAuthProvider extends IAuthProvider {
  static const MethodChannel _channel = MethodChannel('flutter_bloom/auth_wechat');

  WeChatAuthConfig? _config;
  bool _isInitialized = false;
  AuthUser? _currentUser;
  AuthToken? _currentToken;

  @override
  AuthProvider get providerType => AuthProvider.wechat;

  @override
  bool get isInitialized => _isInitialized;

  @override
  Future<bool> get isAvailable async {
    try {
      final result = await _channel.invokeMethod('isWeChatAppInstalled');
      return result as bool? ?? false;
    } catch (e) {
      return false;
    }
  }

  @override
  Future<void> initialize(AuthConfig config) async {
    if (config is! WeChatAuthConfig) {
      throw ArgumentError('WeChatAuthConfig required for WeChat provider');
    }

    try {
      await _channel.invokeMethod('initialize', {
        'appId': config.appId,
        'appSecret': config.appSecret,
        'universalLink': config.universalLink,
        'enableUserInfo': config.enableUserInfo,
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
        errorMessage: 'WeChat provider not initialized',
        errorCode: AuthError.providerNotConfigured,
      );
    }

    try {
      final available = await isAvailable;
      if (!available) {
        return AuthResult.failure(
          errorMessage: 'WeChat app not installed',
          errorCode: AuthError.providerNotAvailable,
        );
      }

      // Start WeChat login
      final loginResult = await _channel.invokeMethod('login');

      if (loginResult == null) {
        return AuthResult.failure(
          errorMessage: 'WeChat login failed',
          errorCode: AuthError.unknownError,
        );
      }

      final resultData = loginResult as Map<String, dynamic>;
      final errorCode = resultData['errCode'] as int?;
      final errorMsg = resultData['errStr'] as String?;

      // Check for WeChat login errors
      if (errorCode != null && errorCode != 0) {
        return _handleWeChatError(errorCode, errorMsg);
      }

      final authCode = resultData['code'] as String?;
      if (authCode == null || authCode.isEmpty) {
        return AuthResult.failure(
          errorMessage: 'Failed to get authorization code',
          errorCode: AuthError.invalidResponse,
        );
      }

      // Exchange auth code for access token
      final tokenResult = await _exchangeCodeForToken(authCode);
      if (!tokenResult.success) {
        return tokenResult;
      }

      // Get user info if enabled
      AuthUser? user;
      if (_config?.enableUserInfo == true) {
        final userResult = await _getUserInfo(tokenResult.token!);
        if (userResult.success) {
          user = userResult.user;
        }
      }

      // Create basic user if user info failed
      user ??= AuthUser(
        id: tokenResult.token!.accessToken,
        provider: AuthProvider.wechat,
        openId: resultData['openId'] as String?,
        unionId: resultData['unionId'] as String?,
        lastLoginAt: DateTime.now(),
      );

      _currentUser = user;
      _currentToken = tokenResult.token;

      return AuthResult.success(
        user: user,
        token: tokenResult.token!,
        additionalData: {
          'openId': resultData['openId'],
          'unionId': resultData['unionId'],
        },
      );
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'WeChat authentication error: ${e.toString()}',
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
    if (refreshToken == null || refreshToken.isEmpty) {
      return null;
    }

    if (_config == null) {
      return null;
    }

    try {
      final response = await http.post(
        Uri.parse('https://api.weixin.qq.com/sns/oauth2/refresh_token'),
        body: {
          'appid': _config!.appId,
          'grant_type': 'refresh_token',
          'refresh_token': refreshToken,
        },
      );

      if (response.statusCode != 200) {
        return null;
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final errorCode = data['errcode'] as int?;

      if (errorCode != null && errorCode != 0) {
        return null;
      }

      return AuthToken(
        accessToken: data['access_token'] as String,
        refreshToken: data['refresh_token'] as String?,
        tokenType: 'Bearer',
        expiresIn: data['expires_in'] as int?,
        scope: data['scope'] as String?,
        expiresAt: DateTime.now().add(
          Duration(seconds: data['expires_in'] as int? ?? 7200),
        ),
      );
    } catch (e) {
      return null;
    }
  }

  @override
  Future<AuthUser?> getCurrentUser() async {
    if (_currentUser != null) {
      return _currentUser;
    }

    // Try to get current user from WeChat SDK
    try {
      final userInfo = await _channel.invokeMethod('getCurrentUser');
      if (userInfo != null) {
        final userData = userInfo as Map<String, dynamic>;
        _currentUser = AuthUser(
          id: userData['openid'] as String? ?? '',
          provider: AuthProvider.wechat,
          username: userData['nickname'] as String?,
          displayName: userData['nickname'] as String?,
          avatar: userData['headimgurl'] as String?,
          openId: userData['openid'] as String?,
          unionId: userData['unionid'] as String?,
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
    // WeChat doesn't support profile updates
    return false;
  }

  @override
  Future<AuthResult> linkAdditionalProvider(
    AuthProvider provider,
    AuthConfig config,
  ) async {
    // WeChat doesn't support linking additional providers
    return AuthResult.failure(
      errorMessage: 'WeChat does not support linking additional providers',
      errorCode: AuthError.accountNotLinked,
    );
  }

  @override
  Future<bool> unlinkProvider(AuthProvider provider) async {
    // WeChat doesn't support unlinking providers
    return false;
  }

  @override
  Future<List<AuthProvider>> getLinkedProviders() async {
    // WeChat doesn't support linked providers
    return [];
  }

  @override
  void dispose() {
    _currentUser = null;
    _currentToken = null;
    _config = null;
    _isInitialized = false;
  }

  /// Exchange authorization code for access token
  Future<AuthResult> _exchangeCodeForToken(String authCode) async {
    if (_config == null) {
      return AuthResult.failure(
        errorMessage: 'WeChat provider not configured',
        errorCode: AuthError.providerNotConfigured,
      );
    }

    try {
      final response = await http.post(
        Uri.parse('https://api.weixin.qq.com/sns/oauth2/access_token'),
        body: {
          'appid': _config!.appId,
          'secret': _config!.appSecret,
          'code': authCode,
          'grant_type': 'authorization_code',
        },
      );

      if (response.statusCode != 200) {
        return AuthResult.failure(
          errorMessage: 'Failed to exchange code for token',
          errorCode: AuthError.networkError,
        );
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final errorCode = data['errcode'] as int?;

      if (errorCode != null && errorCode != 0) {
        return AuthResult.failure(
          errorMessage: data['errmsg'] as String? ?? 'Token exchange failed',
          errorCode: _mapWeChatTokenError(errorCode),
        );
      }

      final accessToken = data['access_token'] as String?;
      final refreshToken = data['refresh_token'] as String?;
      final expiresIn = data['expires_in'] as int?;

      if (accessToken == null) {
        return AuthResult.failure(
          errorMessage: 'Invalid token response',
          errorCode: AuthError.invalidResponse,
        );
      }

      final token = AuthToken(
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenType: 'Bearer',
        expiresIn: expiresIn,
        scope: data['scope'] as String?,
        expiresAt: expiresIn != null
            ? DateTime.now().add(Duration(seconds: expiresIn))
            : null,
        additionalData: {
          'openid': data['openid'],
          'unionid': data['unionid'],
        },
      );

      return AuthResult(
        success: true,
        token: token,
      );
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'Token exchange error: ${e.toString()}',
        errorCode: AuthError.networkError,
      );
    }
  }

  /// Get user information from WeChat API
  Future<AuthResult> _getUserInfo(AuthToken token) async {
    try {
      final openId = token.additionalData?['openid'] as String?;
      if (openId == null) {
        return AuthResult.failure(
          errorMessage: 'OpenID not found in token',
          errorCode: AuthError.invalidResponse,
        );
      }

      final response = await http.get(
        Uri.parse(
          'https://api.weixin.qq.com/sns/userinfo?access_token=${token.accessToken}&openid=$openId',
        ),
      );

      if (response.statusCode != 200) {
        return AuthResult.failure(
          errorMessage: 'Failed to get user info',
          errorCode: AuthError.networkError,
        );
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final errorCode = data['errcode'] as int?;

      if (errorCode != null && errorCode != 0) {
        return AuthResult.failure(
          errorMessage: data['errmsg'] as String? ?? 'Failed to get user info',
          errorCode: _mapWeChatUserError(errorCode),
        );
      }

      final user = AuthUser(
        id: openId,
        provider: AuthProvider.wechat,
        username: data['nickname'] as String?,
        displayName: data['nickname'] as String?,
        avatar: data['headimgurl'] as String?,
        openId: openId,
        unionId: data['unionid'] as String?,
        profile: data,
        lastLoginAt: DateTime.now(),
      );

      return AuthResult.success(user: user, token: token);
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'User info error: ${e.toString()}',
        errorCode: AuthError.networkError,
      );
    }
  }

  /// Handle WeChat login errors
  AuthResult _handleWeChatError(int errorCode, String? errorMsg) {
    switch (errorCode) {
      case -2: // User cancel
        return AuthResult.failure(
          errorMessage: 'User cancelled login',
          errorCode: AuthError.userCancelled,
        );
      case -4: // User deny authorization
        return AuthResult.failure(
          errorMessage: 'User denied authorization',
          errorCode: AuthError.userCancelled,
        );
      case -1: // Common error
        return AuthResult.failure(
          errorMessage: errorMsg ?? 'WeChat login error',
          errorCode: AuthError.unknownError,
        );
      default:
        return AuthResult.failure(
          errorMessage: errorMsg ?? 'WeChat login failed',
          errorCode: AuthError.unknownError,
        );
    }
  }

  /// Map WeChat token errors to AuthError
  AuthError _mapWeChatTokenError(int errorCode) {
    switch (errorCode) {
      case 40001: // Access token expired
        return AuthError.sessionExpired;
      case 40003: // Invalid openid
        return AuthError.invalidCredentials;
      case 40013: // Invalid app ID
        return AuthError.providerNotConfigured;
      default:
        return AuthError.unknownError;
    }
  }

  /// Map WeChat user info errors to AuthError
  AuthError _mapWeChatUserError(int errorCode) {
    switch (errorCode) {
      case 40001: // Access token expired
        return AuthError.sessionExpired;
      case 40003: // Invalid openid
        return AuthError.invalidCredentials;
      case 48001: // API forbidden (user hasn't authorized)
        return AuthError.accountNotLinked;
      default:
        return AuthError.unknownError;
    }
  }
}