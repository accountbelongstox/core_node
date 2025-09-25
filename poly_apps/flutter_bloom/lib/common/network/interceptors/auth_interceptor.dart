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

abstract class AuthInterceptorInterface {
  Future<Map<String, String>> getAuthHeaders();
  Future<bool> refreshToken();
  bool shouldRefreshToken(int statusCode);
  void onAuthError();
}

class AuthInterceptor implements AuthInterceptorInterface {
  static AuthInterceptor? _instance;
  static AuthInterceptor get instance => _instance ??= AuthInterceptor._internal();
  
  AuthInterceptor._internal();

  String? _accessToken;
  String? _refreshToken;
  DateTime? _tokenExpiry;
  bool _isRefreshing = false;
  final List<Completer<String?>> _refreshCompleters = [];

  // Token storage callbacks
  Function(String token)? onTokenUpdated;
  Function()? onTokenExpired;
  Function()? onAuthenticationFailed;

  String? get accessToken => _accessToken;
  // Rename to avoid clashing with method name `refreshToken()`
  String? get refreshTokenValue => _refreshToken;
  DateTime? get tokenExpiry => _tokenExpiry;
  bool get isRefreshing => _isRefreshing;

  /// Set authentication tokens
  void setTokens({
    required String accessToken,
    String? refreshToken,
    DateTime? expiry,
  }) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _tokenExpiry = expiry;
    
    if (kDebugMode) {
      print('Auth tokens updated');
    }
  }

  /// Clear authentication tokens
  void clearTokens() {
    _accessToken = null;
    _refreshToken = null;
    _tokenExpiry = null;
    
    if (kDebugMode) {
      print('Auth tokens cleared');
    }
  }

  /// Check if token is expired
  bool isTokenExpired() {
    if (_tokenExpiry == null) return false;
    return DateTime.now().isAfter(_tokenExpiry!);
  }

  /// Check if token will expire soon (within 5 minutes)
  bool isTokenExpiringSoon() {
    if (_tokenExpiry == null) return false;
    final fiveMinutesFromNow = DateTime.now().add(Duration(minutes: 5));
    return fiveMinutesFromNow.isAfter(_tokenExpiry!);
  }

  @override
  Future<Map<String, String>> getAuthHeaders() async {
    final headers = <String, String>{};

    // Check if token needs refresh
    if (isTokenExpired() || isTokenExpiringSoon()) {
      if (_refreshToken != null && !_isRefreshing) {
        await refreshToken();
      }
    }

    // Add authorization header if token exists
    if (_accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }

    // Add custom headers based on your API requirements
    headers['Content-Type'] = 'application/json';
    headers['Accept'] = 'application/json';

    return headers;
  }

  @override
  Future<bool> refreshToken() async {
    if (_refreshToken == null) {
      if (kDebugMode) {
        print('No refresh token available');
      }
      return false;
    }

    if (_isRefreshing) {
      // Wait for ongoing refresh to complete
      final completer = Completer<String?>();
      _refreshCompleters.add(completer);
      final newToken = await completer.future;
      return newToken != null;
    }

    _isRefreshing = true;

    try {
      if (kDebugMode) {
        print('Refreshing authentication token');
      }

      // Simulate token refresh API call
      await Future.delayed(Duration(milliseconds: 1000));
      
      // Mock successful token refresh
      final newAccessToken = 'new_access_token_${DateTime.now().millisecondsSinceEpoch}';
      final newRefreshToken = 'new_refresh_token_${DateTime.now().millisecondsSinceEpoch}';
      final newExpiry = DateTime.now().add(Duration(hours: 1));

      setTokens(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiry: newExpiry,
      );

      // Notify callback
      onTokenUpdated?.call(newAccessToken);

      // Complete all waiting requests
      for (final completer in _refreshCompleters) {
        completer.complete(newAccessToken);
      }
      _refreshCompleters.clear();

      if (kDebugMode) {
        print('Token refresh successful');
      }

      return true;
    } catch (e) {
      if (kDebugMode) {
        print('Token refresh failed: $e');
      }

      // Complete all waiting requests with null
      for (final completer in _refreshCompleters) {
        completer.complete(null);
      }
      _refreshCompleters.clear();

      // Clear tokens on refresh failure
      clearTokens();
      onAuthenticationFailed?.call();

      return false;
    } finally {
      _isRefreshing = false;
    }
  }

  @override
  bool shouldRefreshToken(int statusCode) {
    return statusCode == 401; // Unauthorized
  }

  @override
  void onAuthError() {
    if (kDebugMode) {
      print('Authentication error occurred');
    }
    
    clearTokens();
    onTokenExpired?.call();
  }

  /// Process HTTP request with authentication
  Future<Map<String, String>> processRequest(Map<String, String>? headers) async {
    final authHeaders = await getAuthHeaders();
    final requestHeaders = <String, String>{};
    
    // Add existing headers
    if (headers != null) {
      requestHeaders.addAll(headers);
    }
    
    // Add auth headers (will override existing auth headers)
    requestHeaders.addAll(authHeaders);
    
    return requestHeaders;
  }

  /// Process HTTP response for auth errors
  Future<bool> processResponse(int statusCode, Map<String, dynamic>? responseBody) async {
    if (shouldRefreshToken(statusCode)) {
      if (kDebugMode) {
        print('Received ${statusCode} status, attempting token refresh');
      }
      
      final refreshSuccess = await refreshToken();
      if (!refreshSuccess) {
        onAuthError();
      }
      
      return refreshSuccess;
    }
    
    return true;
  }

  /// Get user info from token (mock implementation)
  Map<String, dynamic>? getUserInfo() {
    if (_accessToken == null) return null;
    
    // Mock user info extraction from token
    return {
      'user_id': 'user_123',
      'username': 'mock_user',
      'email': 'user@example.com',
      'roles': ['user'],
      'expires_at': _tokenExpiry?.toIso8601String(),
    };
  }

  /// Check if user has specific role
  bool hasRole(String role) {
    final userInfo = getUserInfo();
    if (userInfo == null) return false;
    
    final roles = userInfo['roles'] as List<dynamic>?;
    return roles?.contains(role) ?? false;
  }

  /// Check if user is authenticated
  bool isAuthenticated() {
    return _accessToken != null && !isTokenExpired();
  }

  /// Get token time remaining
  Duration? getTokenTimeRemaining() {
    if (_tokenExpiry == null) return null;
    final now = DateTime.now();
    if (now.isAfter(_tokenExpiry!)) return Duration.zero;
    return _tokenExpiry!.difference(now);
  }

  /// Format token expiry for display
  String? getTokenExpiryFormatted() {
    if (_tokenExpiry == null) return null;
    return _tokenExpiry!.toLocal().toString();
  }
}
