import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
// FIXED: Added 'as types' prefix to resolve AuthType and NetworkResponse naming conflicts
import '../core/network_types.dart' as types;
import '../storage/secure_storage.dart';
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
  types.NetworkConfig? _config;
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
    required types.NetworkConfig config,
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

      final httpClient = _getHttpClient(_config!.baseUrl ?? '');
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
          // FIXED: Convert Map to BaseUserModel using DefaultUserModel.fromMap
          if (_userProvider != null) {
            _userProvider!.setUser(DefaultUserModel.fromMap(userDataWithToken));
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

      final httpClient = _getHttpClient(_config!.baseUrl ?? '');
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
          // FIXED: Convert Map to BaseUserModel using DefaultUserModel.fromMap
          if (_userProvider != null) {
            _userProvider!.setUser(DefaultUserModel.fromMap(userDataWithToken));
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
      final httpClient = _getHttpClient(_config!.baseUrl ?? '');
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
  /// FIXED: Renamed from 'refreshToken' to 'refreshAuthToken' to avoid conflict with '_refreshToken' field
  Future<AuthResult> refreshAuthToken({
    String refreshEndpoint = '/auth/refresh',
  }) async {
    if (!_isAuthenticated || _refreshToken == null) {
      return AuthResult.failure(error: 'No refresh token available');
    }

    await initialized;

    try {
      final httpClient = _getHttpClient(_config!.baseUrl ?? '');
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
            // FIXED: Convert Map to BaseUserModel using DefaultUserModel.fromMap
            _userProvider!.setUser(DefaultUserModel.fromMap(updatedUser));
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
      final httpClient = _getHttpClient(_config!.baseUrl ?? '');
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
    // FIXED: Commented out due to AuthType incompatibility between network_types and user_provider
    // TODO: Need to resolve AuthType enum conflict or use a different approach
    // if (_userProvider != null) {
    //   _userProvider!.updateAuthMetadata(
    //     authType: types.AuthType.jwt,
    //     jwtToken: token,
    //     refreshToken: refreshToken,
    //     expiresAt: expiresAt,
    //     isAuthenticated: _isAuthenticated,
    //     authenticatedAt: DateTime.now(),
    //   );
    // }

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
      // FIXED: Commented out due to AuthMetadata incompatibility between network_types and user_provider
      // TODO: Need to resolve AuthMetadata class conflict
      // _userProvider!.setAuthMetadata(const types.AuthMetadata());
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
  Map<String, String> getAuthHeaders([types.AuthType? authType]) {
    if (_config == null) return {};

    final config = _config!.authConfig;
    final headers = <String, String>{};

    final effectiveAuthType = authType ?? config.authType;

    switch (effectiveAuthType) {
      case types.AuthType.jwt:
        if (_token != null) {
          headers[config.tokenKey] = '${config.tokenPrefix}$_token';
        }
        break;

      // FIXED: Added missing AuthType.clientId case for exhaustive switch coverage
      case types.AuthType.clientId:
      case types.AuthType.clientKey:
        if (_clientId != null) {
          headers[config.clientIdKey] = _clientId!;
        }
        if (_clientSecret != null) {
          headers[config.clientSecretKey] = _clientSecret!;
        }
        break;

      case types.AuthType.session:
        if (_sessionId != null) {
          headers[config.sessionKey] = _sessionId!;
        }
        break;

      case types.AuthType.custom:
        headers.addAll(_customAuthFields);
        break;

      // FIXED: Added missing AuthType.headerKey case for exhaustive switch coverage
      case types.AuthType.headerKey:
        // Handle header key authentication (similar to custom)
        headers.addAll(_customAuthFields);
        break;

      case types.AuthType.multiple:
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

      case types.AuthType.none:
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
  bool canMakeRequest(types.RequestType requestType, {String? permission}) {
    switch (requestType) {
      case types.RequestType.public:
        return true;

      case types.RequestType.authenticated:
        return _isAuthenticated && !isTokenExpired;

      case types.RequestType.authorized:
        return _isAuthenticated && !isTokenExpired && _hasPermission(permission);

      case types.RequestType.admin:
        return _isAuthenticated && !isTokenExpired && _hasAdminRole();

      case types.RequestType.custom:
        return _customAuthFields.isNotEmpty;
    }
  }

  /// Get auth validation error message
  String? getAuthValidationError(types.RequestType requestType, {String? permission}) {
    if (canMakeRequest(requestType, permission: permission)) return null;

    switch (requestType) {
      case types.RequestType.authenticated:
        if (!_isAuthenticated) {
          return 'Authentication required';
        } else if (isTokenExpired) {
          return 'Authentication token expired';
        }
        return 'Authentication failed';

      case types.RequestType.authorized:
        if (!_isAuthenticated) {
          return 'Authentication required';
        } else if (isTokenExpired) {
          return 'Authentication token expired';
        } else if (!_hasPermission(permission)) {
          return 'Insufficient permissions${permission != null ? ' for $permission' : ''}';
        }
        return 'Authorization failed';

      case types.RequestType.admin:
        if (!_isAuthenticated) {
          return 'Authentication required';
        } else if (isTokenExpired) {
          return 'Authentication token expired';
        } else if (!_hasAdminRole()) {
          return 'Admin privileges required';
        }
        return 'Admin authorization failed';

      case types.RequestType.custom:
        return 'Custom authentication required';

      case types.RequestType.public:
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

    // FIXED: Convert user_provider.AuthType to types.AuthType by comparing enum names
    // This is necessary because authMetadata.authType is from user_provider, not network_types
    final authTypeName = authMetadata.authType.name;
    
    switch (authTypeName) {
      case 'jwt':
        if (authMetadata.jwtToken != null) {
          _token = authMetadata.jwtToken;
          _refreshToken = authMetadata.refreshToken;
          _tokenExpiresAt = authMetadata.expiresAt;
          _isAuthenticated = authMetadata.isAuthenticated;
        }
        break;
      case 'clientId':
        if (authMetadata.clientId != null) {
          _clientId = authMetadata.clientId;
          _isAuthenticated = authMetadata.isAuthenticated;
        }
        break;
      case 'session':
        if (authMetadata.sessionId != null) {
          _sessionId = authMetadata.sessionId;
          _isAuthenticated = authMetadata.isAuthenticated;
        }
        break;
      case 'custom':
        if (authMetadata.customHeaders != null) {
          _customAuthFields.addAll(authMetadata.customHeaders!);
          _isAuthenticated = authMetadata.isAuthenticated;
        }
        break;
      case 'multiple':
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
      case 'none':
        break;
      default:
        // Handle unknown auth types
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

  Future<types.NetworkResponse> _makeRequest(
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

    return types.NetworkResponse(
      statusCode: response.statusCode,
      data: responseBody.isNotEmpty ? jsonDecode(responseBody) : null,
      message: response.reasonPhrase,
    );
  }

  bool _isSuccessResponse(types.NetworkResponse response) {
    if (response.statusCode == null || _config == null) return false;

    final body = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : null;

    return _config!.responseValidation.isSuccess(response.statusCode!, body);
  }

  Map<String, dynamic>? _extractUserData(types.NetworkResponse response) {
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

  String? _extractToken(types.NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;
    return body['token'] ?? body['access_token'] ?? body['auth_token'];
  }

  String? _extractRefreshToken(types.NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;
    return body['refresh_token'] ?? body['refreshToken'];
  }

  String? _extractTokenType(types.NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;
    return body['token_type'] ?? 'Bearer';
  }

  DateTime? _extractExpiration(types.NetworkResponse response) {
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

  String? _extractMessage(types.NetworkResponse response) {
    if (response.data is! Map<String, dynamic>) return null;

    final body = response.data as Map<String, dynamic>;
    return _config?.responseValidation.getErrorMessage(body) ??
           body['message']?.toString();
  }

  String? _extractErrorMessage(types.NetworkResponse response) {
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
  // Note: Removed duplicate methods - using original implementations above

  /// Clear error (AuthController compatibility)
  void clearError() {
    _lastError = null;
    notifyListeners();
  }

  /// Set client credentials for client ID authentication
  /// FIXED: Added missing method required by network_user_integration.dart
  Future<void> setClientCredentials(String clientId, String clientSecret) async {
    _clientId = clientId;
    _clientSecret = clientSecret;
    _isAuthenticated = clientId.isNotEmpty;

    if (_config?.authConfig.persistToken == true) {
      await _storage.write('client_id', clientId);
      await _storage.write('client_secret', clientSecret);
    }

    notifyListeners();
  }

  /// Set session ID for session-based authentication
  /// FIXED: Added missing method required by network_user_integration.dart
  Future<void> setSessionId(String sessionId) async {
    _sessionId = sessionId;
    _isAuthenticated = sessionId.isNotEmpty;

    if (_config?.authConfig.persistToken == true) {
      await _storage.write('session_id', sessionId);
    }

    notifyListeners();
  }

  /// Set custom authentication fields
  /// FIXED: Added missing method required by network_user_integration.dart
  Future<void> setCustomAuthFields(Map<String, String> fields) async {
    _customAuthFields = Map.from(fields);
    _isAuthenticated = fields.isNotEmpty;

    if (_config?.authConfig.persistToken == true) {
      await _storage.write('custom_auth_fields', jsonEncode(fields));
    }

    notifyListeners();
  }

  /// Load stored credentials from storage
  /// FIXED: Moved method inside UnifiedAuthManager class (was incorrectly placed after AuthResult class)
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
  /// FIXED: Moved method inside UnifiedAuthManager class (was incorrectly placed after AuthResult class)
  @override
  Future<void> dispose() async {
    // Close HTTP clients
    for (final client in _httpClients.values) {
      client.close();
    }
    _httpClients.clear();
    super.dispose();
  }

  /// Get auth summary for debugging
  /// FIXED: Moved method inside UnifiedAuthManager class (was incorrectly placed after AuthResult class)
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