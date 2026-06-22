import 'codemart_api_base.dart';
import '../config_app_codemart/api_config_app_codemart.dart';
import '../models_app_codemart/codemart_types.dart';
import '../models_app_codemart/codemart_enums.dart';

class AuthApiServiceAppCodemart extends CodeMartApiBase {
  AuthApiServiceAppCodemart({super.baseUrl, super.namespace});

  Future<ApiResponse<Map<String, dynamic>>> login({
    required String email,
    required String password,
  }) async {
    return await post<Map<String, dynamic>>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.login}',
      body: {
        'email': email,
        'password': password,
      },
      fromJson: (data) => data as Map<String, dynamic>,
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> register({
    required String username,
    required String email,
    required String password,
    String? name,
    String? nickname,
    UserRoleType? roleType,
  }) async {
    return await post<Map<String, dynamic>>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.register}',
      body: {
        'username': username,
        'email': email,
        'password': password,
        'name': name ?? username,
        'nickname': nickname,
        if (roleType != null) 'roleType': roleType.name,
      },
      fromJson: (data) => data as Map<String, dynamic>,
    );
  }

  Future<ApiResponse<void>> logout() async {
    return await post<void>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.logout}',
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> refreshToken() async {
    return await post<Map<String, dynamic>>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.refreshToken}',
      fromJson: (data) => data as Map<String, dynamic>,
    );
  }

  Future<ApiResponse<void>> sendEmailVerification() async {
    return await post<void>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.sendEmailVerification}',
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> verifyEmail({
    required String token,
  }) async {
    return await post<Map<String, dynamic>>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.verifyEmail}',
      body: {'token': token},
      fromJson: (data) => data as Map<String, dynamic>,
    );
  }

  Future<ApiResponse<void>> sendPhoneVerification({
    required String phone,
  }) async {
    return await post<void>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.sendPhoneVerification}',
      body: {'phone': phone},
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> verifyPhone({
    required String phone,
    required String otp,
  }) async {
    return await post<Map<String, dynamic>>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.verifyPhone}',
      body: {
        'phone': phone,
        'otp': otp,
      },
      fromJson: (data) => data as Map<String, dynamic>,
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> submitKyc({
    required String idType,
    required String idNumber,
    required String idFrontImage,
    required String idBackImage,
  }) async {
    return await post<Map<String, dynamic>>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.submitKyc}',
      body: {
        'idType': idType,
        'idNumber': idNumber,
        'idFrontImage': idFrontImage,
        'idBackImage': idBackImage,
      },
      fromJson: (data) => data as Map<String, dynamic>,
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> checkKycStatus() async {
    return await get<Map<String, dynamic>>(
      endpoint: '${ApiConfigAppCodemart.authEndpoint}${ApiEndpointsAppCodemart.checkKycStatus}',
      fromJson: (data) => data as Map<String, dynamic>,
    );
  }
}
