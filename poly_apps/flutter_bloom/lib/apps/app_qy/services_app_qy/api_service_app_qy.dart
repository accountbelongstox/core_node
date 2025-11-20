import '../../../common/network/network_framework.dart';

class ApiServiceAppQy extends AdvancedNetworkService {
  static final ApiServiceAppQy _instance = ApiServiceAppQy._internal();
  factory ApiServiceAppQy() => _instance;
  ApiServiceAppQy._internal();

  @override
  String get serviceName => 'ApiServiceAppQy';

  @override
  ApiConfig get apiConfig => ApiConfig(
    baseUrl: 'https://api.qyapp.example.com',
    authenticationType: AuthenticationType.jwt,
    responseValidation: ResponseValidationConfig.defaultConfig(),
  );

  @override
  EndpointConfig get endpointConfig => EndpointConfig(appName: 'app_qy');

  @override
  Future<NetworkResponse<T>> post<T>(
    String endpointName, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    Function(int sent, int total)? onSendProgress,
    CancelToken? cancelToken,
  }) async {
    return await super.post<T>(
      endpointName,
      data: data,
      queryParameters: queryParameters,
      headers: headers,
      pathParams: pathParams,
      requestId: requestId,
      onSendProgress: onSendProgress,
      cancelToken: cancelToken,
    );
  }

  @override
  Future<NetworkResponse<T>> get<T>(
    String endpointName, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    CancelToken? cancelToken,
  }) async {
    return await super.get<T>(
      endpointName,
      queryParameters: queryParameters,
      headers: headers,
      pathParams: pathParams,
      requestId: requestId,
      cancelToken: cancelToken,
    );
  }

  @override
  Future<NetworkResponse<T>> put<T>(
    String endpointName, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    Function(int sent, int total)? onSendProgress,
    CancelToken? cancelToken,
  }) async {
    return await super.put<T>(
      endpointName,
      data: data,
      queryParameters: queryParameters,
      headers: headers,
      pathParams: pathParams,
      requestId: requestId,
      onSendProgress: onSendProgress,
      cancelToken: cancelToken,
    );
  }

  @override
  Future<NetworkResponse<T>> delete<T>(
    String endpointName, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    CancelToken? cancelToken,
  }) async {
    return await super.delete<T>(
      endpointName,
      queryParameters: queryParameters,
      headers: headers,
      pathParams: pathParams,
      requestId: requestId,
      cancelToken: cancelToken,
    );
  }
}
