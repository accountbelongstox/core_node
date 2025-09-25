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

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/network/api_client.dart';
import 'package:qyflutter/common/constants/app_constants.dart';
import 'package:qyflutter/apps/app_example/model_app_example/user_model.dart';
import 'package:qyflutter/common/network/laravel_apis.dart';
import 'package:qyflutter/common/network/laravel_auth_apis.dart';
import 'package:qyflutter/common/provider_status/user_provider.dart';
import 'package:qyflutter/apps/app_example/config_app_example/storage_app_example.dart';
import 'package:qyflutter/apps/app_example/services_app_example/auth_api_app_example_service.dart';

/// Authentication controller for app_example using unified storage and new API services
class AuthControllerAppExample extends ChangeNotifier {
  final BuildContext context;
  bool _isLoading = false;
  late final StorageAppExample _storage;
  late final AuthApiAppExampleService _authService;

  AuthControllerAppExample(this.context) {
    _storage = StorageAppExample.instance;
    _authService = AuthApiAppExampleService(context: context);
  }

  bool get isLoading => _isLoading;

  ApiClient get _apiClient => ApiClient(context: context);
  BaseUserProvider get _userProvider =>
      Provider.of<BaseUserProvider>(context, listen: false);

  // Login function using new auth service
  Future<Response> login(String username, String password, bool remember) async {
    _isLoading = true;
    notifyListeners();

    try {
      // Use new auth service for login
      final authResult = await _authService.login(
        username: username,
        password: password,
        remember: remember,
      );

      if (authResult.isSuccess) {
        // Update user provider with new user data
        final userInfo = _authService.getQyUserInfo();
        if (userInfo != null) {
          final userModel = UserModel.fromJson(userInfo);
          _userProvider.setUser(userModel);
        }

        // Create successful response
        final response = Response(
          body: {
            'success': true,
            'message': authResult.message,
            'user': userInfo,
            'token': _authService.getUserToken(),
          },
          bodyString: '',
          statusCode: 200,
          headers: {},
          method: 'POST',
        );

        _isLoading = false;
        notifyListeners();
        return response;
      } else {
        // Create error response
        final response = Response(
          body: {
            'success': false,
            'message': authResult.error,
            'errors': authResult.error,
          },
          bodyString: '',
          statusCode: authResult.statusCode ?? 400,
          headers: {},
          method: 'POST',
        );

        _isLoading = false;
        notifyListeners();
        return response;
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      
      return Response(
        body: {
          'success': false,
          'message': 'Login failed: $e',
          'errors': e.toString(),
        },
        bodyString: '',
        statusCode: 500,
        headers: {},
        method: 'POST',
      );
    }
  }

  // Register function using new auth service
  Future<Response> register({
    required String email,
    required String password,
    required String username,
    String? firstName,
    String? lastName,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final authResult = await _authService.register(
        email: email,
        password: password,
        username: username,
        firstName: firstName,
        lastName: lastName,
      );

      if (authResult.isSuccess) {
        final userInfo = _authService.getQyUserInfo();
        if (userInfo != null) {
          final userModel = UserModel.fromJson(userInfo);
          _userProvider.setUser(userModel);
        }

        final response = Response(
          body: {
            'success': true,
            'message': authResult.message,
            'user': userInfo,
            'token': _authService.getUserToken(),
          },
          bodyString: '',
          statusCode: 201,
          headers: {},
          method: 'POST',
        );

        _isLoading = false;
        notifyListeners();
        return response;
      } else {
        final response = Response(
          body: {
            'success': false,
            'message': authResult.error,
            'errors': authResult.error,
          },
          bodyString: '',
          statusCode: authResult.statusCode ?? 400,
          headers: {},
          method: 'POST',
        );

        _isLoading = false;
        notifyListeners();
        return response;
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      
      return Response(
        body: {
          'success': false,
          'message': 'Registration failed: $e',
          'errors': e.toString(),
        },
        bodyString: '',
        statusCode: 500,
        headers: {},
        method: 'POST',
      );
    }
  }

  // Logout function using new auth service
  Future<Response> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      final authResult = await _authService.logout();
      
      // Clear user provider
      _userProvider.clearUser();

      final response = Response(
        body: {
          'success': authResult.isSuccess,
          'message': authResult.message ?? 'Logged out successfully',
        },
        bodyString: '',
        statusCode: authResult.isSuccess ? 200 : 400,
        headers: {},
        method: 'POST',
      );

      _isLoading = false;
      notifyListeners();
      return response;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      
      return Response(
        body: {
          'success': false,
          'message': 'Logout failed: $e',
          'errors': e.toString(),
        },
        bodyString: '',
        statusCode: 500,
        headers: {},
        method: 'POST',
      );
    }
  }

  // Check if user is logged in
  bool isLoggedIn() {
    return _authService.isLoggedIn();
  }

  // Get current user info
  UserModel? getCurrentUser() {
    final userInfo = _authService.getQyUserInfo();
    if (userInfo != null) {
      return UserModel.fromJson(userInfo);
    }
    return null;
  }

  // Get auth token
  String? getAuthToken() {
    return _authService.getUserToken();
  }

  // Change password
  Future<Response> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final authResult = await _authService.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

      final response = Response(
        body: {
          'success': authResult.isSuccess,
          'message': authResult.message,
        },
        bodyString: '',
        statusCode: authResult.isSuccess ? 200 : 400,
        headers: {},
        method: 'POST',
      );

      _isLoading = false;
      notifyListeners();
      return response;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      
      return Response(
        body: {
          'success': false,
          'message': 'Password change failed: $e',
          'errors': e.toString(),
        },
        bodyString: '',
        statusCode: 500,
        headers: {},
        method: 'POST',
      );
    }
  }

  // Clear authentication data
  Future<void> clearAuth() async {
    await _storage.clearAuth();
    _userProvider.clearUser();
    notifyListeners();
  }

  // Get authentication status
  Map<String, dynamic> getAuthStatus() {
    return {
      'isLoggedIn': isLoggedIn(),
      'username': _authService.getUsername(),
      'userEmail': _authService.getUserEmail(),
      'tokenExpiration': _authService.getLoginExpiration()?.toIso8601String(),
      'isExpired': _authService.isLoginExpired(),
    };
  }
}
