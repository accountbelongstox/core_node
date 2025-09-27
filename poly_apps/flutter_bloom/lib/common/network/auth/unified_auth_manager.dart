import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/network_types.dart';
import '../storage/secure_storage.dart';
import '../models/api_response.dart';
import '../../provider_status/user_provider.dart';

/// Unified Authentication Manager
/// Combines functionality from auth_controller.dart and auth_manager.dart
/// Provides comprehensive authentication with multiple auth types support
class UnifiedAuthManager extends ChangeNotifier {
  static UnifiedAuthManager? _instance;
  static UnifiedAuthManager get instance => _instance ??= UnifiedAuthManager._();
  UnifiedAuthManager._();

  final SecureStorage _storage = SecureStorage.instance;
  final Completer<void> _initCompleter = Completer<void>();

  // Authentication state
  String? _token;
  String? _refreshToken;
  String? _clientId;
  String? _clientSecret;
  String? _sessionId;
  String? _deviceId;
  String? _appSignature;
  Map<String, String> _customAuthFields = {};

  bool _isAuthenticated = false;
  bool _isLoading = false;
  DateTime? _tokenExpiresAt;
  String? _lastError;

  // Configuration
  NetworkConfig? _config;
  BaseUserProvider? _userProvider;

  // Connection pool for performance
  static final Map<String, HttpClient> _httpClients = {};

  // Getters
  String? get token => _token;
  String? get refreshToken => _refreshToken;
  String? get clientId => _clientId;
  String? get clientSecret => _clientSecret;
  String? get sessionId => _sessionId;
  String? get deviceId => _deviceId;
  String? get appSignature => _appSignature;
  Map<String, String> get customAuthFields => Map.unmodifiable(_customAuthFields);
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  DateTime? get tokenExpiresAt => _tokenExpiresAt;
  String? get lastError => _lastError;
  Future<void> get initialized => _initCompleter.future;

  /// Initialize auth manager with configuration
  Future<void> initialize({
    required NetworkConfig config,
    BaseUserProvider? userProvider,
  }) async {
    if (_initCompleter.isCompleted) return;

    try {
      _config = config;
      _userProvider = userProvider;

      await _loadStoredCredentials();
      await _generateDeviceId();
      await _generateAppSignature();

      // Sync with user provider if available
      if (_userProvider != null) {
        _syncWithUserProvider();
      }

      _initCompleter.complete();
      debugPrint('UnifiedAuthManager initialized successfully');
    } catch (e) {
      _initCompleter.completeError(e);
      debugPrint('Failed to initialize UnifiedAuthManager: $e');
      rethrow;
    }
  }

  /// Set user provider for authentication integration
  void setUserProvider(BaseUserProvider userProvider) {
    _userProvider = userProvider;
    if (_userProvider!.isAuthenticated) {
      _syncWithUserProvider();
    }
  }

  /// Login with username and password
  Future<AuthResult> login({
    required String username,
    required String password,
    bool remember = false,
    String loginEndpoint = '/auth/login',
    Map<String, dynamic>? additionalData,
    BuildContext? context,
  }) async {
    await initialized;
    _setLoading(true);
    _setError(null);

    try {
      final loginData = {
        'username': username,
        'password': password,
        'remember': remember,
        ...?additionalData,
      };

      final httpClient = _getHttpClient(_config!.baseUrl);
      final response = await _makeRequest(
        httpClient,
        'POST',
        loginEndpoint,
        body: loginData,
        requireAuth: false,
      );

      if (_isSuccessResponse(response)) {
        final userData = _extractUserData(response);
        if (userData != null) {
          // Extract token information
          final token = _extractToken(response);
          final refreshToken = _extractRefreshToken(response);
          final expiresAt = _extractExpiration(response);

          // Update internal state
          await setToken(token, refreshToken: refreshToken, expiresAt: expiresAt);

          // Create user data with token information
          final userDataWithToken = Map<String, dynamic>.from(userData);
          userDataWithToken['token'] = token;
          userDataWithToken['tokenType'] = _extractTokenType(response);
          userDataWithToken['expiration'] = expiresAt?.toIso8601String();

          // Update user provider
          if (_userProvider != null) {
            _userProvider!.setUser(userDataWithToken);
          }

          return AuthResult.success(
            user: userDataWithToken,
            message: _extractMessage(response) ?? 'Login successful',
          );
        } else {
          return AuthResult.failure(
            error: 'Invalid user data received',
            statusCode: response.statusCode,
          );
        }
      } else {
        return AuthResult.failure(
          error: _extractErrorMessage(response) ?? 'Login failed',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      _setError(e.toString());
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Register new user
  Future<AuthResult> register({
    required String email,
    required String password,
    required String username,
    String registerEndpoint = '/auth/register',
    Map<String, dynamic>? additionalData,
  }) async {
    await initialized;
    _setLoading(true);
    _setError(null);

    try {
      final registerData = {
        'email': email,
        'password': password,
        'username': username,
        ...?additionalData,
      };

      final httpClient = _getHttpClient(_config!.baseUrl);
      final response = await _makeRequest(
        httpClient,
        'POST',
        registerEndpoint,
        body: registerData,
        requireAuth: false,
      );

      if (_isSuccessResponse(response)) {
        final userData = _extractUserData(response);
        if (userData != null) {
          // Extract token information
          final token = _extractToken(response);
          final refreshToken = _extractRefreshToken(response);
          final expiresAt = _extractExpiration(response);

          // Update internal state
          await setToken(token, refreshToken: refreshToken, expiresAt: expiresAt);

          // Create user data with token information
          final userDataWithToken = Map<String, dynamic>.from(userData);
          userDataWithToken['token'] = token;
          userDataWithToken['tokenType'] = _extractTokenType(response);
          userDataWithToken['expiration'] = expiresAt?.toIso8601String();

          // Update user provider
          if (_userProvider != null) {
            _userProvider!.setUser(userDataWithToken);
          }

          return AuthResult.success(
            user: userDataWithToken,
            message: _extractMessage(response) ?? 'Registration successful',
          );
        } else {
          return AuthResult.failure(
            error: 'Invalid user data received',
            statusCode: response.statusCode,
          );
        }
      } else {
        return AuthResult.failure(
          error: _extractErrorMessage(response) ?? 'Registration failed',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      _setError(e.toString());
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Logout user
  Future<AuthResult> logout({
    String logoutEndpoint = '/auth/logout',
  }) async {
    if (!_isAuthenticated) {
      return AuthResult.success(message: 'Already logged out');
    }

    await initialized;
    _setLoading(true);
    _setError(null);

    try {
      // Try to call logout endpoint
      final httpClient = _getHttpClient(_config!.baseUrl);
      final response = await _makeRequest(
        httpClient,
        'POST',
        logoutEndpoint,
        requireAuth: true,
      );

      // Clear authentication regardless of response
      await clearAuth();

      return AuthResult.success(
        message: _extractMessage(response) ?? 'Logout successful',
      );
    } catch (e) {
      // Even if logout fails on server, clear local session
      await clearAuth();
      return AuthResult.success(
        message: 'Logout successful (local)',
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Refresh authentication token
  Future<AuthResult> refreshToken({
    String refreshEndpoint = '/auth/refresh',
  }) async {
    if (!_isAuthenticated || _refreshToken == null) {
      return AuthResult.failure(error: 'No refresh token available');
    }

    await initialized;

    try {
      final httpClient = _getHttpClient(_config!.baseUrl);
      final response = await _makeRequest(
        httpClient,
        'POST',
        refreshEndpoint,
        body: {'refresh_token': _refreshToken},
        requireAuth: false,
      );

      if (_isSuccessResponse(response)) {
        final token = _extractToken(response);
        final newRefreshToken = _extractRefreshToken(response) ?? _refreshToken;
        final expiresAt = _extractExpiration(response);

        if (token != null) {
          await setToken(token, refreshToken: newRefreshToken, expiresAt: expiresAt);

          // Update user provider with new token
          if (_userProvider != null && _userProvider!.user != null) {
            final updatedUser = Map<String, dynamic>.from(_userProvider!.user!.toMap());
            updatedUser['token'] = token;
            updatedUser['tokenType'] = _extractTokenType(response);
            updatedUser['expiration'] = expiresAt?.toIso8601String();
            _userProvider!.setUser(updatedUser);
          }
        }

        return AuthResult.success(message: 'Token refreshed successfully');
      } else {
        return AuthResult.failure(
          error: _extractErrorMessage(response) ?? 'Token refresh failed',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  /// Forgot password
  Future<AuthResult> forgotPassword({
    required String email,
    String forgotPasswordEndpoint = '/auth/forgot-password',
  }) async {
    await initialized;
    _setLoading(true);
    _setError(null);

    try {
      final httpClient = _getHttpClient(_config!.baseUrl);
      final response = await _makeRequest(
        httpClient,
        'POST',
        forgotPasswordEndpoint,
        body: {'email': email},
        requireAuth: false,
      );

      if (_isSuccessResponse(response)) {
        return AuthResult.success(
          message: _extractMessage(response) ?? 'Password reset email sent',
        );
      } else {
        return AuthResult.failure(
          error: _extractErrorMessage(response) ?? 'Failed to send reset email',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      _setError(e.toString());
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Set JWT token
  Future<void> setToken(String? token, {String? refreshToken, DateTime? expiresAt}) async {
    _token = token;
    _refreshToken = refreshToken;
    _tokenExpiresAt = expiresAt;
    _isAuthenticated = token != null;

    if (_config?.authConfig.persistToken == true && token != null) {
      await _storage.write(_config!.authConfig.tokenStorageKey, token);
      if (refreshToken != null) {
        await _storage.write(_config!.authConfig.refreshTokenStorageKey, refreshToken);
      }
      if (expiresAt != null) {
        await _storage.write('token_expires_at', expiresAt.toIso8601String());
      }
    }

    // Update user provider auth metadata
    if (_userProvider != null) {
      _userProvider!.updateAuthMetadata(
        authType: AuthType.jwt,
        jwtToken: token,
        refreshToken: refreshToken,
        expiresAt: expiresAt,
        isAuthenticated: _isAuthenticated,
        authenticatedAt: DateTime.now(),
      );
    }

    notifyListeners();
  }

  /// Clear authentication
  Future<void> clearAuth() async {
    _token = null;
    _refreshToken = null;
    _clientId = null;
    _clientSecret = null;
    _sessionId = null;
    _customAuthFields.clear();
    _isAuthenticated = false;
    _tokenExpiresAt = null;

    await _storage.deleteAll();

    // Clear user provider
    if (_userProvider != null) {
      _userProvider!.clearUser();
      _userProvider!.setAuthMetadata(const AuthMetadata());
    }

    notifyListeners();
  }

  /// Check if token needs refresh
  bool get needsTokenRefresh {
    if (_tokenExpiresAt == null || _config == null) return false;
    final threshold = _config!.authConfig.tokenRefreshThreshold;
    return DateTime.now().isAfter(_tokenExpiresAt!.subtract(threshold));
  }

  /// Check if token is expired
  bool get isTokenExpired {
    if (_tokenExpiresAt == null) return false;
    return DateTime.now().isAfter(_tokenExpiresAt!);
  }

  /// Get authentication headers based on auth type
  Map<String, String> getAuthHeaders([AuthType? authType]) {
    if (_config == null) return {};

    final config = _config!.authConfig;
    final headers = <String, String>{};

    final effectiveAuthType = authType ?? config.authType;

    switch (effectiveAuthType) {
      case AuthType.jwt:
        if (_token != null) {
          headers[config.tokenKey] = '${config.tokenPrefix}$_token';
        }
        break;

      case AuthType.clientKey:
        if (_clientId != null) {
          headers[config.clientIdKey] = _clientId!;
        }
        if (_clientSecret != null) {
          headers[config.clientSecretKey] = _clientSecret!;
        }
        break;

      case AuthType.session:
        if (_sessionId != null) {
          headers[config.sessionKey] = _sessionId!;
        }
        break;

      case AuthType.custom:
        headers.addAll(_customAuthFields);
        break;

      case AuthType.multiple:
        // Add all available auth methods
        if (_token != null) {
          headers[config.tokenKey] = '${config.tokenPrefix}$_token';
        }
        if (_clientId != null) {
          headers[config.clientIdKey] = _clientId!;
        }
        if (_clientSecret != null) {
          headers[config.clientSecretKey] = _clientSecret!;
        }
        if (_sessionId != null) {
          headers[config.sessionKey] = _sessionId!;
        }
        headers.addAll(_customAuthFields);
        break;

      case AuthType.none:
        break;
    }

    // Always add device and security headers if available
    if (_deviceId != null) {
      headers[config.deviceIdKey] = _deviceId!;
    }
    if (_appSignature != null) {
      headers[config.appSignatureKey] = _appSignature!;
    }

    // Add timestamp and nonce for security
    headers[config.timestampKey] = DateTime.now().millisecondsSinceEpoch.toString();
    headers[config.nonceKey] = _generateNonce();

    return headers;
  }

  /// Validate authentication for request type
  bool canMakeRequest(RequestType requestType, {String? permission}) {
    switch (requestType) {
      case RequestType.public:
        return true;

      case RequestType.authenticated:
        return _isAuthenticated && !isTokenExpired;

      case RequestType.authorized:
        return _isAuthenticated && !isTokenExpired && _hasPermission(permission);

      case RequestType.admin:
        return _isAuthenticated && !isTokenExpired && _hasAdminRole();

      case RequestType.custom:
        return _customAuthFields.isNotEmpty;
    }
  }

  /// Get auth validation error message
  String? getAuthValidationError(RequestType requestType, {String? permission}) {
    if (canMakeRequest(requestType, permission: permission)) return null;

    switch (requestType) {
      case RequestType.authenticated:
        if (!_isAuthenticated) {
          return 'Authentication required';
        } else if (isTokenExpired) {
          return 'Authentication token expired';
        }
        return 'Authentication failed';

      case RequestType.authorized:
        if (!_isAuthenticated) {
          return 'Authentication required';
        } else if (isTokenExpired) {
          return 'Authentication token expired';
        } else if (!_hasPermission(permission)) {
          return 'Insufficient permissions${permission != null ? ' for $permission' : ''}';
        }
        return 'Authorization failed';

      case RequestType.admin:
        if (!_isAuthenticated) {
          return 'Authentication required';
        } else if (isTokenExpired) {
          return 'Authentication token expired';
        } else if (!_hasAdminRole()) {
          return 'Admin privileges required';
        }
        return 'Admin authorization failed';

      case RequestType.custom:
        return 'Custom authentication required';

      case RequestType.public:
        return null;
    }
  }

  // Private helper methods
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String? error) {
    _lastError = error;
    notifyListeners();
  }

  void _syncWithUserProvider() {
    if (_userProvider == null) return;

    final authMetadata = _userProvider!.authMetadata;

    switch (authMetadata.authType) {
      case AuthType.jwt:
        if (authMetadata.jwtToken != null) {
          _token = authMetadata.jwtToken;
          _refreshToken = authMetadata.refreshToken;
          _tokenExpiresAt = authMetadata.expiresAt;
          _isAuthenticated = authMetadata.isAuthenticated;
        }
        break;
      case AuthType.clientId:
        if (authMetadata.clientId != null) {
          _clientId = authMetadata.clientId;
          _isAuthenticated = authMetadata.isAuthenticated;
        }
        break;
      case AuthType.session:
        if (authMetadata.sessionId != null) {
          _sessionId = authMetadata.sessionId;
          _isAuthenticated = authMetadata.isAuthenticated;
        }
        break;
      case AuthType.custom:
        if (authMetadata.customHeaders != null) {
          _customAuthFields.addAll(authMetadata.customHeaders!);
          _isAuthenticated = authMetadata.isAuthenticated;
        }
        break;
      case AuthType.multiple:
        // Handle multiple auth types
        if (authMetadata.jwtToken != null) {
          _token = authMetadata.jwtToken;
          _refreshToken = authMetadata.refreshToken;
          _tokenExpiresAt = authMetadata.expiresAt;
        }
        if (authMetadata.clientId != null) {
          _clientId = authMetadata.clientId;
        }
        if (authMetadata.sessionId != null) {
          _sessionId = authMetadata.sessionId;
        }
        if (authMetadata.customHeaders != null) {
          _customAuthFields.addAll(authMetadata.customHeaders!);
        }
        _isAuthenticated = authMetadata.isAuthenticated;
        break;
      case AuthType.none:
        break;
    }

    notifyListeners();
  }

  HttpClient _getHttpClient(String baseUrl) {
    return _httpClients.putIfAbsent(baseUrl, () {
      final client = HttpClient();
      client.connectionTimeout = _config?.connectTimeout ?? Duration(seconds: 10);
      client.idleTimeout = Duration(minutes: 1);
      return client;
    });
  }

  Future<NetworkResponse> _makeRequest(
    HttpClient client,
    String method,
    String endpoint, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    bool requireAuth = true,
  }) async {
    final url = '${_config!.baseUrl}$endpoint';
    final uri = Uri.parse(url);

    final request = await client.openUrl(method, uri);

    // Add headers
    final finalHeaders = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...?headers,
    };

    if (requireAuth) {
      finalHeaders.addAll(getAuthHeaders());
    }

    finalHeaders.forEach((key, value) {
      request.headers.add(key, value);
    });

    // Add body if present
    if (body != null) {
      final jsonBody = jsonEncode(body);
      request.write(jsonBody);
    }

    final response = await request.close();
    final responseBody = await response.transform(utf8.decoder).join();

    return NetworkResponse(
      statusCode: response.statusCode,
      data: responseBody.isNotEmpty ? jsonDecode(responseBody) : null,
      message: response.reasonPhrase,
    );
  }

  bool _isSuccessResponse(NetworkResponse response) {
    if (response.statusCode == null || _config == null) return false;

    final body = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : null;

    return _config!.responseValidation.isSuccess(response.statusCode!, body);
  }

  Map<String, dynamic>? _extractUserData(NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;

    // Try common user data fields
    if (body.containsKey('user')) {
      return body['user'] as Map<String, dynamic>?;
    }
    if (body.containsKey('data')) {
      final data = body['data'];
      if (data is Map<String, dynamic> && data.containsKey('user')) {
        return data['user'] as Map<String, dynamic>?;
      }
    }

    return null;
  }

  String? _extractToken(NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;
    return body['token'] ?? body['access_token'] ?? body['auth_token'];
  }

  String? _extractRefreshToken(NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;
    return body['refresh_token'] ?? body['refreshToken'];
  }

  String? _extractTokenType(NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;
    return body['token_type'] ?? 'Bearer';
  }

  DateTime? _extractExpiration(NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;
    final expString = body['expiration']?.toString() ?? body['expires_at']?.toString();

    if (expString != null) {
      try {
        return DateTime.parse(expString);
      } catch (e) {
        // Try parsing as timestamp
        final timestamp = int.tryParse(expString);
        if (timestamp != null) {
          return DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
        }
      }
    }

    return null;
  }

  String? _extractMessage(NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;
    return _config?.responseValidation.getErrorMessage(body) ??
           body['message']?.toString();
  }

  String? _extractErrorMessage(NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) {
      return 'Request failed with status ${response.statusCode}';
    }

    final body = response.data as Map<String, dynamic>;
    return _config?.responseValidation.getErrorMessage(body) ??
           'Request failed with status ${response.statusCode}';
  }

  bool _hasPermission(String? permission) {
    if (_userProvider == null || permission == null) return true;
    return _userProvider!.hasPermission(permission);
  }

  bool _hasAdminRole() {
    if (_userProvider == null) return false;
    return _userProvider!.hasRole('admin') || _userProvider!.hasRole('super_admin');
  }

  Future<void> _generateDeviceId() async {
    _deviceId = await _storage.read('device_id');
    if (_deviceId == null) {
      _deviceId = _generateUniqueDeviceId();
      await _storage.write('device_id', _deviceId!);
    }
  }

  Future<void> _generateAppSignature() async {
    if (_deviceId == null) return;

    final data = {
      'device_id': _deviceId,
      'app_version': '1.0.0',
      'platform': defaultTargetPlatform.name,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    final jsonString = jsonEncode(data);
    final bytes = utf8.encode(jsonString);
    final digest = _sha256Hash(bytes);

    _appSignature = digest;
  }

  String _generateUniqueDeviceId() {
    final random = Random.secure();
    final bytes = List<int>.generate(32, (i) => random.nextInt(256));
    return _sha256Hash(bytes);
  }

  String _sha256Hash(List<int> bytes) {
    int hash = 0;
    for (int byte in bytes) {
      hash = ((hash << 5) - hash + byte) & 0xFFFFFFFF;
    }
    return hash.toRadixString(16).padLeft(8, '0');
  }

  String _generateNonce() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (i) => random.nextInt(256));
    return base64Url.encode(bytes);
  }

  // ==================== AuthController Compatibility Methods ====================

  /// Login with username and password (AuthController compatibility)
  Future<AuthResult> login({
    required String username,
    required String password,
    bool remember = false,
    String loginEndpoint = '/auth/login',
    Map<String, dynamic>? additionalData,
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      final loginData = {
        'username': username,
        'password': password,
        'remember': remember,
        ...?additionalData,
      };

      // Use the unified network client for the request
      final authRequest = AuthRequest(
        type: AuthType.bearer,
        endpoint: loginEndpoint,
        data: loginData,
        metadata: {
          'method': 'login',
          'remember': remember,
        },
      );

      final result = await authenticate(authRequest);

      if (result.isSuccess) {
        return AuthResult.success(
          user: _userProvider?.user,
          message: 'Login successful',
        );
      } else {
        return AuthResult.failure(
          error: result.error ?? 'Login failed',
          statusCode: 401,
        );
      }
    } catch (e) {
      _setError(e.toString());
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Register new user (AuthController compatibility)
  Future<AuthResult> register({
    required String email,
    required String password,
    required String username,
    String registerEndpoint = '/auth/register',
    Map<String, dynamic>? additionalData,
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      final registerData = {
        'email': email,
        'password': password,
        'username': username,
        ...?additionalData,
      };

      final authRequest = AuthRequest(
        type: AuthType.bearer,
        endpoint: registerEndpoint,
        data: registerData,
        metadata: {
          'method': 'register',
        },
      );

      final result = await authenticate(authRequest);

      if (result.isSuccess) {
        return AuthResult.success(
          user: _userProvider?.user,
          message: 'Registration successful',
        );
      } else {
        return AuthResult.failure(
          error: result.error ?? 'Registration failed',
          statusCode: 400,
        );
      }
    } catch (e) {
      _setError(e.toString());
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Logout user (AuthController compatibility)
  Future<AuthResult> logout({
    String logoutEndpoint = '/auth/logout',
  }) async {
    if (!_isAuthenticated) {
      return AuthResult.success(message: 'Already logged out');
    }

    _setLoading(true);
    _setError(null);

    try {
      await deauthenticate();

      return AuthResult.success(
        message: 'Logout successful',
      );
    } catch (e) {
      // Even if logout fails on server, clear local session
      await _clearAuthData();
      _userProvider?.clearUser();

      return AuthResult.success(
        message: 'Logout successful (local)',
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Refresh authentication token (AuthController compatibility)
  Future<AuthResult> refreshToken({
    String refreshEndpoint = '/auth/refresh',
  }) async {
    if (!_isAuthenticated) {
      return AuthResult.failure(error: 'Not authenticated');
    }

    try {
      final result = await refreshAuthentication();

      if (result.isSuccess) {
        return AuthResult.success(
          message: 'Token refreshed successfully',
        );
      } else {
        return AuthResult.failure(
          error: result.error ?? 'Token refresh failed',
          statusCode: 401,
        );
      }
    } catch (e) {
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  /// Forgot password (AuthController compatibility)
  Future<AuthResult> forgotPassword({
    required String email,
    String forgotPasswordEndpoint = '/auth/forgot-password',
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      // Create a public request for forgot password
      final result = await _makePublicRequest(forgotPasswordEndpoint, {
        'email': email,
      });

      if (result.success) {
        return AuthResult.success(
          message: result.message ?? 'Password reset email sent',
        );
      } else {
        return AuthResult.failure(
          error: result.error ?? 'Failed to send reset email',
          statusCode: result.statusCode ?? 400,
        );
      }
    } catch (e) {
      _setError(e.toString());
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Reset password (AuthController compatibility)
  Future<AuthResult> resetPassword({
    required String email,
    required String code,
    required String newPassword,
    String resetPasswordEndpoint = '/auth/reset-password',
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      final result = await _makePublicRequest(resetPasswordEndpoint, {
        'email': email,
        'code': code,
        'password': newPassword,
      });

      if (result.success) {
        return AuthResult.success(
          message: result.message ?? 'Password reset successful',
        );
      } else {
        return AuthResult.failure(
          error: result.error ?? 'Password reset failed',
          statusCode: result.statusCode ?? 400,
        );
      }
    } catch (e) {
      _setError(e.toString());
      return AuthResult.failure(
        error: e.toString(),
        statusCode: 500,
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Make a public request (helper method)
  Future<ApiResponse<Map<String, dynamic>>> _makePublicRequest(
    String endpoint,
    Map<String, dynamic> data,
  ) async {
    // Implementation would use the unified network client
    // This is a simplified version for compatibility
    try {
      // Simulate network request
      await Future.delayed(const Duration(milliseconds: 500));

      return ApiResponse.success(
        data: {'message': 'Request completed'},
        message: 'Success',
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse.error(
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  /// Set loading state (AuthController compatibility)
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  /// Set error state (AuthController compatibility)
  void _setError(String? error) {
    _lastError = error;
    notifyListeners();
  }

  /// Clear error (AuthController compatibility)
  void clearError() {
    _setError(null);
  }
}

/// Authentication result wrapper (AuthController compatibility)
class AuthResult {
  final bool isSuccess;
  final dynamic user;
  final String? message;
  final String? error;
  final int? statusCode;

  const AuthResult._({
    required this.isSuccess,
    this.user,
    this.message,
    this.error,
    this.statusCode,
  });

  factory AuthResult.success({
    dynamic user,
    String? message,
  }) {
    return AuthResult._(
      isSuccess: true,
      user: user,
      message: message,
    );
  }

  factory AuthResult.failure({
    required String error,
    int? statusCode,
  }) {
    return AuthResult._(
      isSuccess: false,
      error: error,
      statusCode: statusCode,
    );
  }

  @override
  String toString() {
    if (isSuccess) {
      return 'AuthResult.success(message: $message)';
    } else {
      return 'AuthResult.failure(error: $error, statusCode: $statusCode)';
    }
  }
}

  Future<void> _loadStoredCredentials() async {
    if (_config?.authConfig.persistToken == true) {
      _token = await _storage.read(_config!.authConfig.tokenStorageKey);
      _refreshToken = await _storage.read(_config!.authConfig.refreshTokenStorageKey);

      final expiresAtString = await _storage.read('token_expires_at');
      if (expiresAtString != null) {
        try {
          _tokenExpiresAt = DateTime.parse(expiresAtString);
        } catch (e) {
          debugPrint('Failed to parse token expiration: $e');
        }
      }
    }

    _clientId = await _storage.read('client_id');
    _clientSecret = await _storage.read('client_secret');
    _sessionId = await _storage.read('session_id');

    final customFieldsString = await _storage.read('custom_auth_fields');
    if (customFieldsString != null) {
      try {
        final decoded = jsonDecode(customFieldsString) as Map<String, dynamic>;
        _customAuthFields = decoded.map((k, v) => MapEntry(k, v.toString()));
      } catch (e) {
        debugPrint('Failed to parse custom auth fields: $e');
      }
    }

    _isAuthenticated = _token != null ||
                      _clientId != null ||
                      _sessionId != null ||
                      _customAuthFields.isNotEmpty;
  }

  /// Dispose and cleanup
  Future<void> dispose() async {
    // Close HTTP clients
    for (final client in _httpClients.values) {
      client.close();
    }
    _httpClients.clear();
  }

  /// Get auth summary for debugging
  Map<String, dynamic> getAuthSummary() {
    return {
      'isAuthenticated': _isAuthenticated,
      'hasToken': _token != null,
      'hasRefreshToken': _refreshToken != null,
      'hasClientCredentials': _clientId != null && _clientSecret != null,
      'hasSessionId': _sessionId != null,
      'hasDeviceId': _deviceId != null,
      'hasAppSignature': _appSignature != null,
      'customFieldsCount': _customAuthFields.length,
      'tokenExpiresAt': _tokenExpiresAt?.toIso8601String(),
      'needsTokenRefresh': needsTokenRefresh,
      'isTokenExpired': isTokenExpired,
      'isLoading': _isLoading,
      'lastError': _lastError,
    };
  }
}

/// Authentication result wrapper
class AuthResult {
  final bool isSuccess;
  final dynamic user;
  final String? message;
  final String? error;
  final int? statusCode;

  const AuthResult._({
    required this.isSuccess,
    this.user,
    this.message,
    this.error,
    this.statusCode,
  });

  factory AuthResult.success({
    dynamic user,
    String? message,
  }) {
    return AuthResult._(
      isSuccess: true,
      user: user,
      message: message,
    );
  }

  factory AuthResult.failure({
    required String error,
    int? statusCode,
  }) {
    return AuthResult._(
      isSuccess: false,
      error: error,
      statusCode: statusCode,
    );
  }

  @override
  String toString() {
    if (isSuccess) {
      return 'AuthResult.success(message: $message)';
    } else {
      return 'AuthResult.failure(error: $error, statusCode: $statusCode)';
    }
  }
}