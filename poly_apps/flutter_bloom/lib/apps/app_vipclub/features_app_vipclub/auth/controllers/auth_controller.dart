import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/user_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_auth_api_service.dart';

class VipClubAuthController extends ChangeNotifier {
  final VipClubAuthApiService _authApi;

  bool _isLoading = false;
  String? _errorMessage;
  VipClubUserModel? _currentUser;

  VipClubAuthController(this._authApi);

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  VipClubUserModel? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;

  Future<bool> login({
    required String email,
    required String password,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _authApi.login(
        email: email,
        password: password,
      );

      if (result['success']) {
        _currentUser = result['user'] as VipClubUserModel;
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = result['error'] as String;
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Login failed: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String fullName,
    required String phone,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _authApi.register(
        email: email,
        password: password,
        fullName: fullName,
        phone: phone,
      );

      if (result['success']) {
        _currentUser = result['user'] as VipClubUserModel;
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = result['error'] as String;
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Registration failed: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _authApi.logout();
      _currentUser = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> checkLoginStatus() async {
    final isLoggedIn = await _authApi.isLoggedIn();
    if (isLoggedIn) {
      _currentUser = await _authApi.getUserInfo();
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
