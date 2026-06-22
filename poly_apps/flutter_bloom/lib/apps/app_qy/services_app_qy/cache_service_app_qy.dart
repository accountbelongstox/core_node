/// Cache service for app_qy data persistence
library;

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../../common/auth_v2/auth_v2.dart';

class CacheServiceAppQy {
  static const String _userKey = 'app_qy_user';
  static const String _tokenKey = 'app_qy_token';
  static const String _sessionKey = 'app_qy_session';
  static const String _preferencesKey = 'app_qy_preferences';

  /// Save user data to cache
  Future<void> saveUser(AuthUser user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userJson = user.toJson();
      await prefs.setString(_userKey, jsonEncode(userJson));
    } catch (e) {
      throw Exception('Failed to save user data: $e');
    }
  }

  /// Get user data from cache
  Future<AuthUser?> getUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userString = prefs.getString(_userKey);

      if (userString != null) {
        final userJson = jsonDecode(userString) as Map<String, dynamic>;
        return AuthUser.fromJson(userJson);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Clear user data from cache
  Future<void> clearUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_userKey);
    } catch (e) {
      throw Exception('Failed to clear user data: $e');
    }
  }

  /// Save token data to cache
  Future<void> saveToken(AuthToken token) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final tokenJson = token.toJson();
      await prefs.setString(_tokenKey, jsonEncode(tokenJson));
    } catch (e) {
      throw Exception('Failed to save token data: $e');
    }
  }

  /// Get token data from cache
  Future<AuthToken?> getToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final tokenString = prefs.getString(_tokenKey);

      if (tokenString != null) {
        final tokenJson = jsonDecode(tokenString) as Map<String, dynamic>;
        final token = AuthToken.fromJson(tokenJson);

        // Check if token is expired
        if (token.isExpired) {
          await clearToken();
          return null;
        }

        return token;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Clear token data from cache
  Future<void> clearToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_tokenKey);
    } catch (e) {
      throw Exception('Failed to clear token data: $e');
    }
  }

  /// Save session data to cache
  Future<void> saveSession(AuthSession session) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final sessionJson = session.toJson();
      await prefs.setString(_sessionKey, jsonEncode(sessionJson));
    } catch (e) {
      throw Exception('Failed to save session data: $e');
    }
  }

  /// Get session data from cache
  Future<AuthSession?> getSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final sessionString = prefs.getString(_sessionKey);

      if (sessionString != null) {
        final sessionJson = jsonDecode(sessionString) as Map<String, dynamic>;
        final session = AuthSession.fromJson(sessionJson);

        // Check if session is expired
        if (session.isExpired) {
          await clearSession();
          return null;
        }

        return session;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Clear session data from cache
  Future<void> clearSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_sessionKey);
    } catch (e) {
      throw Exception('Failed to clear session data: $e');
    }
  }

  /// Save user preferences
  Future<void> savePreferences(Map<String, dynamic> preferences) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_preferencesKey, jsonEncode(preferences));
    } catch (e) {
      throw Exception('Failed to save preferences: $e');
    }
  }

  /// Get user preferences
  Future<Map<String, dynamic>?> getPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final preferencesString = prefs.getString(_preferencesKey);

      if (preferencesString != null) {
        return jsonDecode(preferencesString) as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Clear all cached data
  Future<void> clearAll() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await Future.wait([
        prefs.remove(_userKey),
        prefs.remove(_tokenKey),
        prefs.remove(_sessionKey),
        prefs.remove(_preferencesKey),
      ]);
    } catch (e) {
      throw Exception('Failed to clear cached data: $e');
    }
  }

  /// Check if user has cached data
  Future<bool> hasCachedData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.containsKey(_userKey) && prefs.containsKey(_tokenKey);
    } catch (e) {
      return false;
    }
  }
}