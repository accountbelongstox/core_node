import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config_app_codemart/api_config_app_codemart.dart';
import '../models_app_codemart/codemart_types.dart';

class CodeMartApiBase {
  final String baseUrl;
  final String namespace;
  String? _token;

  CodeMartApiBase({
    this.baseUrl = ApiConfigAppCodemart.baseUrl,
    this.namespace = ApiConfigAppCodemart.namespace,
  });

  void setToken(String? token) {
    _token = token;
  }

  String? get token => _token;

  Map<String, String> _getHeaders({bool includeContentType = true}) {
    final headers = <String, String>{
      'X-App-Namespace': namespace,
    };

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';
    }

    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }

    return headers;
  }

  Future<ApiResponse<T>> _request<T>({
    required String method,
    required String endpoint,
    Map<String, dynamic>? queryParams,
    Map<String, dynamic>? body,
    T Function(dynamic)? fromJson,
  }) async {
    try {
      String url = '$baseUrl$endpoint';

      if (queryParams != null && queryParams.isNotEmpty) {
        final queryString = Uri(queryParameters: queryParams.map((key, value) => MapEntry(key, value.toString()))).query;
        url = '$url?$queryString';
      }

      final uri = Uri.parse(url);
      http.Response response;

      switch (method.toUpperCase()) {
        case 'GET':
          response = await http.get(uri, headers: _getHeaders());
          break;
        case 'POST':
          response = await http.post(
            uri,
            headers: _getHeaders(),
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'PUT':
          response = await http.put(
            uri,
            headers: _getHeaders(),
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'PATCH':
          response = await http.patch(
            uri,
            headers: _getHeaders(),
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'DELETE':
          response = await http.delete(uri, headers: _getHeaders());
          break;
        default:
          throw Exception('Unsupported HTTP method: $method');
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final jsonResponse = jsonDecode(response.body) as Map<String, dynamic>;

        return ApiResponse<T>(
          success: jsonResponse['success'] as bool? ?? true,
          code: jsonResponse['code'] as int? ?? response.statusCode,
          message: jsonResponse['message'] as String? ?? 'Success',
          data: fromJson != null && jsonResponse['data'] != null ? fromJson(jsonResponse['data']) : null,
          timestamp: jsonResponse['timestamp'] as String? ?? DateTime.now().toIso8601String(),
        );
      } else {
        final jsonResponse = jsonDecode(response.body) as Map<String, dynamic>;
        return ApiResponse<T>(
          success: false,
          code: response.statusCode,
          message: jsonResponse['message'] as String? ?? 'Request failed',
          error: jsonResponse['error'] as String?,
          timestamp: DateTime.now().toIso8601String(),
        );
      }
    } catch (e) {
      return ApiResponse<T>(
        success: false,
        code: 500,
        message: 'API Error: ${e.toString()}',
        error: e.toString(),
        timestamp: DateTime.now().toIso8601String(),
      );
    }
  }

  Future<ApiResponse<T>> get<T>({
    required String endpoint,
    Map<String, dynamic>? queryParams,
    T Function(dynamic)? fromJson,
  }) {
    return _request<T>(
      method: 'GET',
      endpoint: endpoint,
      queryParams: queryParams,
      fromJson: fromJson,
    );
  }

  Future<ApiResponse<T>> post<T>({
    required String endpoint,
    Map<String, dynamic>? body,
    T Function(dynamic)? fromJson,
  }) {
    return _request<T>(
      method: 'POST',
      endpoint: endpoint,
      body: body,
      fromJson: fromJson,
    );
  }

  Future<ApiResponse<T>> put<T>({
    required String endpoint,
    Map<String, dynamic>? body,
    T Function(dynamic)? fromJson,
  }) {
    return _request<T>(
      method: 'PUT',
      endpoint: endpoint,
      body: body,
      fromJson: fromJson,
    );
  }

  Future<ApiResponse<T>> patch<T>({
    required String endpoint,
    Map<String, dynamic>? body,
    T Function(dynamic)? fromJson,
  }) {
    return _request<T>(
      method: 'PATCH',
      endpoint: endpoint,
      body: body,
      fromJson: fromJson,
    );
  }

  Future<ApiResponse<T>> delete<T>({
    required String endpoint,
    T Function(dynamic)? fromJson,
  }) {
    return _request<T>(
      method: 'DELETE',
      endpoint: endpoint,
      fromJson: fromJson,
    );
  }

  Map<String, dynamic> buildQuery({
    Map<String, dynamic> filters = const {},
    int? page,
    int? pageSize,
    String? sort,
    String? order,
  }) {
    final query = <String, dynamic>{};

    filters.forEach((key, value) {
      if (value != null && value != '') {
        query[key] = value;
      }
    });

    if (page != null) query['page'] = page;
    if (pageSize != null) query['pageSize'] = pageSize;
    if (sort != null) query['sort'] = sort;
    if (order != null) query['order'] = order;

    return query;
  }
}
