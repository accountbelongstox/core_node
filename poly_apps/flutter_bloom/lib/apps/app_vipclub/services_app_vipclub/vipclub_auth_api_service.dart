import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:qyflutter/apps/app_vipclub/config_app_vipclub/app_config.dart';
import 'package:qyflutter/apps/app_vipclub/config_app_vipclub/constants.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/user_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_storage_service.dart';

class VipClubAuthApiService {
  final String baseUrl;
  final VipClubStorageService _storage = VipClubStorageService();
  String? _authToken;

  VipClubAuthApiService({String? baseUrl})
      : baseUrl = baseUrl ?? VipClubAppConfig.apiBaseUrl;

  Map<String, String> get _headers {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (_authToken != null) {
      headers['Authorization'] = 'Bearer $_authToken';
    }

    return headers;
  }

  Future<void> _loadToken() async {
    _authToken = await _storage.getString(VipClubConstants.storageKeyAuthToken);
  }

  Future<void> _saveToken(String token) async {
    _authToken = token;
    await _storage.setString(VipClubConstants.storageKeyAuthToken, token);
  }

  Future<void> _clearToken() async {
    _authToken = null;
    await _storage.remove(VipClubConstants.storageKeyAuthToken);
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/auth/login'),
        headers: _headers,
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final token = data['token'] as String;
        await _saveToken(token);

        final user = VipClubUserModel.fromJson(
          data['user'] as Map<String, dynamic>,
        );
        await _storage.setString(
          VipClubConstants.storageKeyUserProfile,
          jsonEncode(user.toJson()),
        );

        return {
          'success': true,
          'user': user,
          'token': token,
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'error': error['message'] ?? 'Login failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Network error: ${e.toString()}',
      };
    }
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String fullName,
    required String phone,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/auth/register'),
        headers: _headers,
        body: jsonEncode({
          'email': email,
          'password': password,
          'full_name': fullName,
          'phone': phone,
        }),
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final token = data['token'] as String;
        await _saveToken(token);

        final user = VipClubUserModel.fromJson(
          data['user'] as Map<String, dynamic>,
        );
        await _storage.setString(
          VipClubConstants.storageKeyUserProfile,
          jsonEncode(user.toJson()),
        );

        return {
          'success': true,
          'user': user,
          'token': token,
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'error': error['message'] ?? 'Registration failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Network error: ${e.toString()}',
      };
    }
  }

  Future<void> logout() async {
    try {
      await _loadToken();

      await http.post(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/auth/logout'),
        headers: _headers,
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));
    } catch (e) {
      // Ignore logout errors
    } finally {
      await _clearToken();
      await _storage.remove(VipClubConstants.storageKeyUserProfile);
      await _storage.remove(VipClubConstants.storageKeyMemberCard);
    }
  }

  Future<bool> isLoggedIn() async {
    await _loadToken();
    return _authToken != null && _authToken!.isNotEmpty;
  }

  Future<VipClubUserModel?> getUserInfo() async {
    try {
      final userJson = await _storage.getString(
        VipClubConstants.storageKeyUserProfile,
      );

      if (userJson == null) return null;

      return VipClubUserModel.fromJson(
        jsonDecode(userJson) as Map<String, dynamic>,
      );
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>> refreshUserInfo() async {
    try {
      await _loadToken();

      final response = await http.get(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/auth/profile'),
        headers: _headers,
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final user = VipClubUserModel.fromJson(data);

        await _storage.setString(
          VipClubConstants.storageKeyUserProfile,
          jsonEncode(user.toJson()),
        );

        return {
          'success': true,
          'user': user,
        };
      } else {
        return {
          'success': false,
          'error': 'Failed to fetch user info',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Network error: ${e.toString()}',
      };
    }
  }

  Future<Map<String, dynamic>> postRequest(
    String endpoint,
    Map<String, dynamic> data,
  ) async {
    try {
      await _loadToken();

      final response = await http.post(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/$endpoint'),
        headers: _headers,
        body: jsonEncode(data),
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          'success': true,
          'data': jsonDecode(response.body),
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'error': error['message'] ?? 'Request failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Network error: ${e.toString()}',
      };
    }
  }

  Future<Map<String, dynamic>> getRequest(String endpoint) async {
    try {
      await _loadToken();

      final response = await http.get(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/$endpoint'),
        headers: _headers,
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          'success': true,
          'data': jsonDecode(response.body),
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'error': error['message'] ?? 'Request failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Network error: ${e.toString()}',
      };
    }
  }

  Future<Map<String, dynamic>> putRequest(
    String endpoint,
    Map<String, dynamic> data,
  ) async {
    try {
      await _loadToken();

      final response = await http.put(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/$endpoint'),
        headers: _headers,
        body: jsonEncode(data),
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          'success': true,
          'data': jsonDecode(response.body),
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'error': error['message'] ?? 'Request failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Network error: ${e.toString()}',
      };
    }
  }

  Future<Map<String, dynamic>> deleteRequest(String endpoint) async {
    try {
      await _loadToken();

      final response = await http.delete(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/$endpoint'),
        headers: _headers,
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          'success': true,
          'data': jsonDecode(response.body),
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'error': error['message'] ?? 'Request failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Network error: ${e.toString()}',
      };
    }
  }
}
