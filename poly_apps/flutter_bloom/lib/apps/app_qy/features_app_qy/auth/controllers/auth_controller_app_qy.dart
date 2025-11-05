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

/// Authentication controller for QY App - manages authentication state
library;

import 'package:flutter/material.dart';
import '../domain/model/auth_model.dart';
import '../domain/service/auth_service.dart';

enum LoginMethod {
  phone,
  wechat,
  weibo,
  qq,
  qyAccount,
}

class AuthControllerAppQy extends ChangeNotifier {
  final AuthService _authService;
  bool _isLoading;
  bool _isLoggedIn;
  String? _errorMessage;
  String? _accessToken;
  String? _userId;
  bool _agreedToTerms;
  int _countdown;
  bool _canSendCode;

  AuthControllerAppQy({
    required AuthService authService,
  })  : _authService = authService,
        _isLoading = false,
        _isLoggedIn = false,
        _agreedToTerms = false,
        _countdown = 0,
        _canSendCode = true;

  bool get isLoading => _isLoading;
  bool get isLoggedIn => _isLoggedIn;
  String? get errorMessage => _errorMessage;
  String? get accessToken => _accessToken;
  String? get userId => _userId;
  bool get agreedToTerms => _agreedToTerms;
  int get countdown => _countdown;
  bool get canSendCode => _canSendCode;

  void setAgreedToTerms(bool agreed) {
    _agreedToTerms = agreed;
    notifyListeners();
  }

  Future<bool> sendVerificationCode(String phoneNumber) async {
    if (!_canSendCode) return false;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final request = VerificationCodeRequestModel(
        phoneNumber: phoneNumber,
        purpose: 'login',
      );

      final response = await _authService.sendVerificationCode(request);

      if (response.success) {
        _startCountdown(response.expiresIn ?? 60);
        return true;
      } else {
        _errorMessage = response.message;
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void _startCountdown(int seconds) {
    _countdown = seconds;
    _canSendCode = false;
    notifyListeners();

    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (_countdown > 0) {
        _countdown--;
        notifyListeners();
        return true;
      } else {
        _canSendCode = true;
        notifyListeners();
        return false;
      }
    });
  }

  Future<bool> loginWithPhone({
    required String phoneNumber,
    required String verificationCode,
  }) async {
    if (!_agreedToTerms) {
      _errorMessage = 'Please agree to terms and conditions';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _authService.loginWithPhone(
        phoneNumber: phoneNumber,
        verificationCode: verificationCode,
      );

      _accessToken = response.accessToken;
      _userId = response.userId;
      _isLoggedIn = true;

      return true;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> loginWithWechat() async {
    if (!_agreedToTerms) {
      _errorMessage = 'Please agree to terms and conditions';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // TODO: Get WeChat auth code from SDK
      final authCode = 'mock_wechat_code';

      final response = await _authService.loginWithWechat(authCode: authCode);

      _accessToken = response.accessToken;
      _userId = response.userId;
      _isLoggedIn = true;

      return true;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> loginWithWeibo() async {
    if (!_agreedToTerms) {
      _errorMessage = 'Please agree to terms and conditions';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // TODO: Get Weibo auth code from SDK
      final authCode = 'mock_weibo_code';

      final response = await _authService.loginWithWeibo(authCode: authCode);

      _accessToken = response.accessToken;
      _userId = response.userId;
      _isLoggedIn = true;

      return true;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> loginWithQQ() async {
    if (!_agreedToTerms) {
      _errorMessage = 'Please agree to terms and conditions';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // TODO: Get QQ auth code from SDK
      final authCode = 'mock_qq_code';

      final response = await _authService.loginWithQQ(authCode: authCode);

      _accessToken = response.accessToken;
      _userId = response.userId;
      _isLoggedIn = true;

      return true;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> loginWithQyAccount({
    required String identifier,
    required String password,
  }) async {
    if (!_agreedToTerms) {
      _errorMessage = 'Please agree to terms and conditions';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _authService.loginWithQyAccount(
        identifier: identifier,
        password: password,
      );

      _accessToken = response.accessToken;
      _userId = response.userId;
      _isLoggedIn = true;

      return true;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _authService.logout();

      _accessToken = null;
      _userId = null;
      _isLoggedIn = false;
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    super.dispose();
  }
}
