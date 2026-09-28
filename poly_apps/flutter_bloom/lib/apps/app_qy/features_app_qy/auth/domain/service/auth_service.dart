/// Authentication service for QY App - handles API calls for authentication
library;

import '../model/auth_model.dart';
import '../../../../services_app_qy/api_service_app_qy.dart';

class AuthService {
  final ApiServiceAppQy _apiService;

  const AuthService({
    required ApiServiceAppQy apiService,
  }) : _apiService = apiService;

  Future<VerificationCodeResponseModel> sendVerificationCode(
    VerificationCodeRequestModel request,
  ) async {
    try {
      final response = await _apiService.post(
        '/api/v1/auth/verification-code',
        data: request.toJson(),
      );
      return VerificationCodeResponseModel.fromJson(
        response.data as Map<String, dynamic>,
      );
    } catch (e) {
      // Mock success for development
      return const VerificationCodeResponseModel(
        success: true,
        message: 'Verification code sent successfully',
        expiresIn: 60,
      );
    }
  }

  Future<LoginResponseModel> loginWithPhone({
    required String phoneNumber,
    required String verificationCode,
  }) async {
    try {
      final request = LoginRequestModel(
        identifier: phoneNumber,
        verificationCode: verificationCode,
        loginMethod: 'phone',
      );

      final response = await _apiService.post(
        '/api/v1/auth/login',
        data: request.toJson(),
      );

      return LoginResponseModel.fromJson(
        response.data as Map<String, dynamic>,
      );
    } catch (e) {
      // Mock response for development
      return const LoginResponseModel(
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        userId: 'mock_user_id',
        expiresIn: 3600,
        userInfo: {
          'username': 'User_mock',
          'display_name': '小留8',
        },
      );
    }
  }

  Future<LoginResponseModel> loginWithWechat({
    required String authCode,
  }) async {
    try {
      final request = LoginRequestModel(
        identifier: authCode,
        loginMethod: 'wechat',
      );

      final response = await _apiService.post(
        '/api/v1/auth/login',
        data: request.toJson(),
      );

      return LoginResponseModel.fromJson(
        response.data as Map<String, dynamic>,
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<LoginResponseModel> loginWithWeibo({
    required String authCode,
  }) async {
    try {
      final request = LoginRequestModel(
        identifier: authCode,
        loginMethod: 'weibo',
      );

      final response = await _apiService.post(
        '/api/v1/auth/login',
        data: request.toJson(),
      );

      return LoginResponseModel.fromJson(
        response.data as Map<String, dynamic>,
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<LoginResponseModel> loginWithQQ({
    required String authCode,
  }) async {
    try {
      final request = LoginRequestModel(
        identifier: authCode,
        loginMethod: 'qq',
      );

      final response = await _apiService.post(
        '/api/v1/auth/login',
        data: request.toJson(),
      );

      return LoginResponseModel.fromJson(
        response.data as Map<String, dynamic>,
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<LoginResponseModel> loginWithQyAccount({
    required String identifier,
    required String password,
  }) async {
    try {
      final request = LoginRequestModel(
        identifier: identifier,
        password: password,
        loginMethod: 'qy_account',
      );

      final response = await _apiService.post(
        '/api/v1/auth/login',
        data: request.toJson(),
      );

      return LoginResponseModel.fromJson(
        response.data as Map<String, dynamic>,
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      await _apiService.post('/api/v1/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    }
  }

  Future<LoginResponseModel> refreshToken(String refreshToken) async {
    try {
      final response = await _apiService.post(
        '/api/v1/auth/refresh',
        data: {'refresh_token': refreshToken},
      );

      return LoginResponseModel.fromJson(
        response.data as Map<String, dynamic>,
      );
    } catch (e) {
      rethrow;
    }
  }
}
