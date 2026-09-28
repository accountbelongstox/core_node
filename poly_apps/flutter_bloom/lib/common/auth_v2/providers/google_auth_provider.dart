
/// Google authentication provider implementation
/// Supports Google Sign-In with access token and user info retrieval
library;

import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../auth_interface.dart';
import '../auth_models.dart';
import '../auth_config.dart';

/// Google authentication provider
class GoogleAuthProvider extends IAuthProvider {
  static const MethodChannel _channel = MethodChannel('flutter_bloom/auth_google');

  GoogleAuthConfig? _config;
  bool _isInitialized = false;
  AuthUser? _currentUser;
  AuthToken? _currentToken;

  @override
  AuthProvider get providerType => AuthProvider.google;

  @override
  bool get isInitialized => _isInitialized;

  @override
  Future<bool> get isAvailable async {
    try {
      final result = await _channel.invokeMethod('isGooglePlayServicesAvailable');
      return result as bool? ?? false;
    } catch (e) {
      return false;
    }
  }

  @override
  Future<void> initialize(AuthConfig config) async {
    if (config is! GoogleAuthConfig) {
      throw ArgumentError('GoogleAuthConfig required for Google provider');
    }

    try {
      await _channel.invokeMethod('initialize', {
        'webClientId': config.webClientId,
        'iosClientId': config.iosClientId,
        'androidClientId': config.androidClientId,
        'scopes': config.scopes,
        'hostedDomain': config.hostedDomain,
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
        errorMessage: 'Google provider not initialized',
        errorCode: AuthError.providerNotConfigured,
      );
    }

    try {
      final available = await isAvailable;
      if (!available) {
        return AuthResult.failure(
          errorMessage: 'Google Play Services not available',
          errorCode: AuthError.providerNotAvailable,
        );
      }

      // Start Google Sign-In
      final loginResult = await _channel.invokeMethod('signIn');

      if (loginResult == null) {
        return AuthResult.failure(
          errorMessage: 'Google Sign-In failed',
          errorCode: AuthError.unknownError,
        );
      }

      final resultData = loginResult as Map<String, dynamic>;
      final idToken = resultData['idToken'] as String?;
      final accessToken = resultData['accessToken'] as String?;

      if (idToken == null && accessToken == null) {
        return AuthResult.failure(
          errorMessage: 'Failed to get authentication token',
          errorCode: AuthError.invalidResponse,
        );
      }

      // Parse Google Sign-In result
      final user = _parseGoogleUser(resultData);

      // Create token object
      final token = AuthToken(
        accessToken: accessToken ?? idToken!,
        refreshToken: resultData['refreshToken'] as String?,
        tokenType: 'Bearer',
        expiresIn: resultData['expiresIn'] as int?,
        expiresAt: resultData['expiresIn'] != null
            ? DateTime.now().add(Duration(seconds: resultData['expiresIn'] as int))
            : null,
        scope: resultData['scope'] as String?,
        additionalData: {
          'idToken': idToken,
          'serverAuthCode': resultData['serverAuthCode'],
          'user': resultData,
        },
      );

      _currentUser = user;
      _currentToken = token;

      return AuthResult.success(
        user: user,
        token: token,
        additionalData: {
          'idToken': idToken,
          'serverAuthCode': resultData['serverAuthCode'],
        },
      );
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'Google authentication error: ${e.toString()}',
        errorCode: AuthError.unknownError,
      );
    }
  }

  @override
  Future<void> signOut() async {
    try {
      await _channel.invokeMethod('signOut');
      _currentUser = null;
      _currentToken = null;
    } catch (e) {
      // Continue with cleanup even if sign out fails
      _currentUser = null;
      _currentToken = null;
    }
  }

  @override
  Future<AuthToken?> refreshToken(String? refreshToken) async {
    if (refreshToken == null || refreshToken.isEmpty) {
      return null;
    }

    if (_config?.webClientId == null) {
      return null;
    }

    try {
      final response = await http.post(
        Uri.parse('https://oauth2.googleapis.com/token'),
        body: {
          'client_id': _config!.webClientId,
          'refresh_token': refreshToken,
          'grant_type': 'refresh_token',
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      );

      if (response.statusCode != 200) {
        return null;
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (data.containsKey('error')) {
        return null;
      }

      return AuthToken(
        accessToken: data['access_token'] as String,
        refreshToken: data['refresh_token'] as String? ?? refreshToken,
        tokenType: data['token_type'] as String? ?? 'Bearer',
        expiresIn: data['expires_in'] as int?,
        scope: data['scope'] as String?,
        expiresAt: data['expires_in'] != null
            ? DateTime.now().add(Duration(seconds: data['expires_in'] as int))
            : null,
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

    // Try to get current user silently
    try {
      final userInfo = await _channel.invokeMethod('signInSilently');
      if (userInfo != null) {
        final userData = userInfo as Map<String, dynamic>;
        _currentUser = _parseGoogleUser(userData);
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
    // Google doesn't support profile updates through the SDK
    return false;
  }

  @override
  Future<AuthResult> linkAdditionalProvider(
    AuthProvider provider,
    AuthConfig config,
  ) async {
    // Google doesn't support linking additional providers through the SDK
    return AuthResult.failure(
      errorMessage: 'Google does not support linking additional providers',
      errorCode: AuthError.accountNotLinked,
    );
  }

  @override
  Future<bool> unlinkProvider(AuthProvider provider) async {
    // Google doesn't support unlinking providers through the SDK
    return false;
  }

  @override
  Future<List<AuthProvider>> getLinkedProviders() async {
    // Google doesn't support linked providers through the SDK
    return [];
  }

  @override
  void dispose() {
    _currentUser = null;
    _currentToken = null;
    _config = null;
    _isInitialized = false;
  }

  /// Parse Google Sign-In user data
  AuthUser _parseGoogleUser(Map<String, dynamic> userData) {
    final photoUrl = userData['photoUrl'] as String?;
    String? avatar = photoUrl;

    // If photo URL is provided and not empty, add size parameter for better quality
    if (photoUrl != null && photoUrl.isNotEmpty) {
      avatar = photoUrl.contains('?')
          ? '$photoUrl&sz=200'
          : '$photoUrl?sz=200';
    }

    return AuthUser(
      id: userData['id'] as String? ?? '',
      provider: AuthProvider.google,
      email: userData['email'] as String?,
      username: userData['email'] as String?,
      displayName: userData['displayName'] as String?,
      avatar: avatar,
      profile: userData,
      lastLoginAt: DateTime.now(),
      isVerified: userData['emailVerified'] as bool? ?? false,
    );
  }

  /// Verify Google ID token (server-side validation)
  Future<bool> verifyIdToken(String idToken) async {
    if (_config?.webClientId == null) {
      return false;
    }

    try {
      // This is a client-side verification
      // In production, you should verify the token on your server
      final response = await http.get(
        Uri.parse(
          'https://www.googleapis.com/oauth2/v1/tokeninfo?id_token=$idToken',
        ),
      );

      if (response.statusCode != 200) {
        return false;
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final audience = data['audience'] as String?;

      return audience == _config!.webClientId;
    } catch (e) {
      return false;
    }
  }

  /// Get user info from Google People API (requires additional scopes)
  Future<AuthResult> getDetailedUserInfo(String accessToken) async {
    try {
      final response = await http.get(
        Uri.parse('https://www.googleapis.com/oauth2/v2/userinfo'),
        headers: {
          'Authorization': 'Bearer $accessToken',
        },
      );

      if (response.statusCode != 200) {
        return AuthResult.failure(
          errorMessage: 'Failed to get detailed user info',
          errorCode: AuthError.networkError,
        );
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      final user = AuthUser(
        id: data['id'] as String? ?? '',
        provider: AuthProvider.google,
        email: data['email'] as String?,
        username: data['email'] as String?,
        displayName: data['name'] as String?,
        avatar: data['picture'] as String?,
        profile: data,
        lastLoginAt: DateTime.now(),
        isVerified: data['verified_email'] as bool? ?? false,
      );

      return AuthResult(
        success: true,
        user: user,
      );
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'Detailed user info error: ${e.toString()}',
        errorCode: AuthError.networkError,
      );
    }
  }

  /// Revoke access token
  Future<bool> revokeToken(String accessToken) async {
    try {
      final response = await http.get(
        Uri.parse('https://oauth2.googleapis.com/revoke?token=$accessToken'),
      );

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}