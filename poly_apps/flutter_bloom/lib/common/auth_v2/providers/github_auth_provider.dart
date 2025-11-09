
/// GitHub authentication provider implementation
/// Supports GitHub OAuth with access token and user info retrieval
library;

import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import '../auth_interface.dart';
import '../auth_models.dart';
import '../auth_config.dart';

/// GitHub authentication provider
class GitHubAuthProvider extends IAuthProvider {
  GitHubAuthConfig? _config;
  bool _isInitialized = false;
  AuthUser? _currentUser;
  AuthToken? _currentToken;
  StreamController<AuthResult?>? _authStateController;

  @override
  AuthProvider get providerType => AuthProvider.github;

  @override
  bool get isInitialized => _isInitialized;

  @override
  Future<bool> get isAvailable async {
    // GitHub authentication is always available (web-based)
    return true;
  }

  @override
  Future<void> initialize(AuthConfig config) async {
    if (config is! GitHubAuthConfig) {
      throw ArgumentError('GitHubAuthConfig required for GitHub provider');
    }

    _config = config;
    _authStateController = StreamController<AuthResult?>.broadcast();
    _isInitialized = true;
  }

  @override
  Future<AuthResult> authenticate({
    Map<String, dynamic>? additionalParameters,
  }) async {
    if (!_isInitialized || _config == null) {
      return AuthResult.failure(
        errorMessage: 'GitHub provider not initialized',
        errorCode: AuthError.providerNotConfigured,
      );
    }

    try {
      // Generate GitHub OAuth URL
      final authUrl = _buildAuthUrl(additionalParameters);

      // Launch URL in external browser or web view
      final launched = await launchUrl(
        authUrl,
        mode: LaunchMode.externalApplication,
      );

      if (!launched) {
        return AuthResult.failure(
          errorMessage: 'Failed to launch GitHub authentication',
          errorCode: AuthError.providerNotAvailable,
        );
      }

      // Wait for callback (this would typically be handled by a deep link)
      // For now, we'll implement a simplified version
      return await _handleOAuthCallback();
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'GitHub authentication error: ${e.toString()}',
        errorCode: AuthError.unknownError,
      );
    }
  }

  @override
  Future<void> signOut() async {
    _currentUser = null;
    _currentToken = null;
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
        Uri.parse('https://github.com/login/oauth/access_token'),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: {
          'client_id': _config!.clientId,
          'client_secret': _config!.clientSecret,
          'grant_type': 'refresh_token',
          'refresh_token': refreshToken,
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
        refreshToken: data['refresh_token'] as String?,
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

    if (_currentToken == null) {
      return null;
    }

    final userResult = await _getUserInfo(_currentToken!.accessToken);
    if (userResult.success && userResult.user != null) {
      _currentUser = userResult.user;
      return _currentUser;
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
    if (_currentToken == null) {
      return false;
    }

    try {
      // Update user name and bio if provided
      final Map<String, dynamic> patchData = {};

      if (profile.containsKey('name')) {
        patchData['name'] = profile['name'];
      }

      if (profile.containsKey('bio')) {
        patchData['bio'] = profile['bio'];
      }

      if (patchData.isEmpty) {
        return true;
      }

      final response = await http.patch(
        Uri.parse('https://api.github.com/user'),
        headers: {
          'Authorization': 'Bearer ${_currentToken!.accessToken}',
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(patchData),
      );

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  @override
  Future<AuthResult> linkAdditionalProvider(
    AuthProvider provider,
    AuthConfig config,
  ) async {
    // GitHub doesn't support linking additional providers through OAuth
    return AuthResult.failure(
      errorMessage: 'GitHub does not support linking additional providers',
      errorCode: AuthError.accountNotLinked,
    );
  }

  @override
  Future<bool> unlinkProvider(AuthProvider provider) async {
    // GitHub doesn't support unlinking providers through OAuth
    return false;
  }

  @override
  Future<List<AuthProvider>> getLinkedProviders() async {
    // GitHub doesn't support linked providers through OAuth
    return [];
  }

  /// Get authentication state stream
  Stream<AuthResult?> get authStateStream {
    return _authStateController?.stream ?? Stream.empty();
  }

  @override
  void dispose() {
    _currentUser = null;
    _currentToken = null;
    _config = null;
    _isInitialized = false;
    _authStateController?.close();
    _authStateController = null;
  }

  /// Build GitHub OAuth authorization URL
  Uri _buildAuthUrl(Map<String, dynamic>? additionalParameters) {
    final params = <String, String>{
      'client_id': _config!.clientId ?? '',
      'scope': _config!.scopes,
      'allow_signup': _config!.allowSignup.toString(),
    };

    if (_config!.redirectUri != null) {
      params['redirect_uri'] = _config!.redirectUri!;
    }

    // Add custom parameters
    if (additionalParameters != null) {
      additionalParameters.forEach((key, value) {
        if (value is String) {
          params[key] = value;
        }
      });
    }

    return Uri.parse('https://github.com/login/oauth/authorize').replace(
      queryParameters: params,
    );
  }

  /// Handle OAuth callback (simplified implementation)
  Future<AuthResult> _handleOAuthCallback() async {
    // In a real implementation, this would handle the deep link callback
    // For now, we'll return a failure indicating manual handling needed
    return AuthResult.failure(
      errorMessage: 'GitHub OAuth callback handling requires deep link integration',
      errorCode: AuthError.unknownError,
    );
  }

  /// Exchange authorization code for access token
  Future<AuthResult> _exchangeCodeForToken(String code) async {
    if (_config == null) {
      return AuthResult.failure(
        errorMessage: 'GitHub provider not configured',
        errorCode: AuthError.providerNotConfigured,
      );
    }

    try {
      final response = await http.post(
        Uri.parse('https://github.com/login/oauth/access_token'),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: {
          'client_id': _config!.clientId,
          'client_secret': _config!.clientSecret,
          'code': code,
        },
      );

      if (response.statusCode != 200) {
        return AuthResult.failure(
          errorMessage: 'Failed to exchange code for token',
          errorCode: AuthError.networkError,
        );
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (data.containsKey('error')) {
        return AuthResult.failure(
          errorMessage: data['error_description'] as String? ?? 'Token exchange failed',
          errorCode: _mapGitHubError(data['error'] as String?),
        );
      }

      final accessToken = data['access_token'] as String?;
      final refreshToken = data['refresh_token'] as String?;
      final tokenType = data['token_type'] as String?;
      final scope = data['scope'] as String?;

      if (accessToken == null) {
        return AuthResult.failure(
          errorMessage: 'Invalid token response',
          errorCode: AuthError.invalidResponse,
        );
      }

      final token = AuthToken(
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenType: tokenType ?? 'Bearer',
        scope: scope,
      );

      // Get user info with the access token
      final userResult = await _getUserInfo(accessToken);
      if (!userResult.success || userResult.user == null) {
        return AuthResult.failure(
          errorMessage: 'Failed to get user info',
          errorCode: userResult.errorCode ?? AuthError.unknownError,
        );
      }

      _currentToken = token;
      _currentUser = userResult.user;

      return AuthResult.success(
        user: userResult.user!,
        token: token,
      );
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'Token exchange error: ${e.toString()}',
        errorCode: AuthError.networkError,
      );
    }
  }

  /// Get user information from GitHub API
  Future<AuthResult> _getUserInfo(String accessToken) async {
    try {
      // Get basic user info
      final userResponse = await http.get(
        Uri.parse('https://api.github.com/user'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Accept': 'application/vnd.github.v3+json',
        },
      );

      if (userResponse.statusCode != 200) {
        return AuthResult.failure(
          errorMessage: 'Failed to get user info',
          errorCode: AuthError.networkError,
        );
      }

      final userData = jsonDecode(userResponse.body) as Map<String, dynamic>;

      // Get user emails if needed
      List<String> emails = [];
      try {
        final emailResponse = await http.get(
          Uri.parse('https://api.github.com/user/emails'),
          headers: {
            'Authorization': 'Bearer $accessToken',
            'Accept': 'application/vnd.github.v3+json',
          },
        );

        if (emailResponse.statusCode == 200) {
          final emailData = jsonDecode(emailResponse.body) as List;
          emails = emailData
              .where((item) => item['verified'] == true && item['primary'] == true)
              .map((item) => item['email'] as String)
              .toList();
        }
      } catch (e) {
        // Ignore email error and continue
      }

      final user = AuthUser(
        id: userData['id'].toString(),
        provider: AuthProvider.github,
        email: emails.isNotEmpty ? emails.first : null,
        username: userData['login'] as String?,
        displayName: userData['name'] as String? ?? userData['login'] as String,
        avatar: userData['avatar_url'] as String?,
        profile: userData,
        lastLoginAt: DateTime.now(),
        isVerified: userData['verified'] as bool? ?? false,
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

  /// Map GitHub OAuth errors to AuthError
  AuthError _mapGitHubError(String? error) {
    if (error == null) return AuthError.unknownError;

    switch (error) {
      case 'invalid_client':
        return AuthError.providerNotConfigured;
      case 'invalid_grant':
        return AuthError.invalidCredentials;
      case 'unauthorized_client':
        return AuthError.providerNotConfigured;
      case 'unsupported_grant_type':
        return AuthError.invalidRequest;
      case 'invalid_scope':
        return AuthError.invalidRequest;
      case 'access_denied':
        return AuthError.userCancelled;
      case 'redirect_uri_mismatch':
        return AuthError.providerNotConfigured;
      default:
        return AuthError.unknownError;
    }
  }

  /// Check if token is valid by testing GitHub API
  Future<bool> validateToken(String accessToken) async {
    try {
      final response = await http.get(
        Uri.parse('https://api.github.com/user'),
        headers: {
          'Authorization': 'Bearer $accessToken',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  /// Get user's repositories
  Future<List<Map<String, dynamic>>> getUserRepositories(String accessToken) async {
    try {
      final response = await http.get(
        Uri.parse('https://api.github.com/user/repos'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Accept': 'application/vnd.github.v3+json',
        },
      );

      if (response.statusCode != 200) {
        return [];
      }

      final data = jsonDecode(response.body) as List;
      return data.cast<Map<String, dynamic>>();
    } catch (e) {
      return [];
    }
  }
}