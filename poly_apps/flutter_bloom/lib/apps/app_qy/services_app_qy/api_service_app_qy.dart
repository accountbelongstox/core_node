import 'package:dio/dio.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/api_config_app_qy.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/api_endpoints_app_qy.dart';
import 'package:qyflutter/common/network/core/multi_endpoint_discovery.dart';

class ApiServiceAppQy {
  static final ApiServiceAppQy _instance = ApiServiceAppQy._internal();
  factory ApiServiceAppQy() => _instance;

  late final Dio _dio;
  String? _authToken;

  ApiServiceAppQy._internal() {
    _initializeWithDiscoveredEndpoint();
  }

  /// Initialize with discovered endpoint or fallback to default
  void _initializeWithDiscoveredEndpoint() {
    // Prefer the endpoint selected by MultiEndpointDiscovery (lazy-loaded).
    // If discovery has not completed yet, start with empty base URL and let
    // the async discovery later call updateBaseUrl(). This avoids triggering
    // ApiConfigAppQy.defaultBaseUrl (and its warning) before detection runs.
    final discovery = MultiEndpointDiscovery();
    final selected = discovery.selectedEndpoint;
    // Base URL should be just host:port; endpoints include /api/... segments.
    final baseUrl = selected?.buildFullUrl() ?? '';

    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: Duration(seconds: ApiConfigAppQy.mainApi.timeoutSeconds),
      receiveTimeout: Duration(seconds: ApiConfigAppQy.mainApi.timeoutSeconds),
      headers: ApiConfigAppQy.mainApi.defaultHeaders,
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_authToken != null) {
          options.headers['Authorization'] = 'Bearer $_authToken';
        }
        return handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          _authToken = null;
        }
        return handler.next(error);
      },
    ));
  }

  void setAuthToken(String? token) {
    _authToken = token;
  }

  bool get isAuthenticated => _authToken != null;

  Future<Map<String, dynamic>> post(
    String endpoint, {
    Map<String, dynamic>? data,
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.post(
        endpoint,
        data: data,
        queryParameters: queryParameters,
        options: Options(headers: headers),
      );
      return _handleResponse(response);
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  Future<Map<String, dynamic>> get(
    String endpoint, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.get(
        endpoint,
        queryParameters: queryParameters,
        options: Options(headers: headers),
      );
      return _handleResponse(response);
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  Future<Map<String, dynamic>> put(
    String endpoint, {
    Map<String, dynamic>? data,
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.put(
        endpoint,
        data: data,
        queryParameters: queryParameters,
        options: Options(headers: headers),
      );
      return _handleResponse(response);
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  Future<Map<String, dynamic>> delete(
    String endpoint, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.delete(
        endpoint,
        queryParameters: queryParameters,
        options: Options(headers: headers),
      );
      return _handleResponse(response);
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  Future<Map<String, dynamic>> patch(
    String endpoint, {
    Map<String, dynamic>? data,
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.patch(
        endpoint,
        data: data,
        queryParameters: queryParameters,
        options: Options(headers: headers),
      );
      return _handleResponse(response);
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  Map<String, dynamic> _handleResponse(Response response) {
    if (response.data is Map<String, dynamic>) {
      return response.data;
    }
    return {
      'success': true,
      'data': response.data,
    };
  }

  Map<String, dynamic> _handleError(DioException e) {
    String errorMessage = 'Network error occurred';

    if (e.response?.data is Map<String, dynamic>) {
      errorMessage = e.response!.data['message'] ??
          e.response!.data['error'] ??
          errorMessage;
    } else if (e.type == DioExceptionType.connectionTimeout) {
      errorMessage = 'Connection timeout';
    } else if (e.type == DioExceptionType.receiveTimeout) {
      errorMessage = 'Receive timeout';
    } else if (e.type == DioExceptionType.connectionError) {
      errorMessage = 'Connection error - check network';
    }

    return {
      'success': false,
      'error': errorMessage,
      'statusCode': e.response?.statusCode,
    };
  }

  Future<Map<String, dynamic>> login({
    required String phone,
    required String code,
  }) async {
    return post(ApiEndpointsAppQy.authVerifyCode, data: {
      'phone': phone,
      'code': code,
    });
  }

  Future<Map<String, dynamic>> sendVerificationCode(String phone) async {
    return post(ApiEndpointsAppQy.authSendCode, data: {
      'phone': phone,
    });
  }

  Future<Map<String, dynamic>> getUserProfile() async {
    return get(ApiEndpointsAppQy.authGetCurrentUser);
  }

  Future<Map<String, dynamic>> getUserLanguages() async {
    return get(ApiEndpointsAppQy.userGetLanguages);
  }

  Future<Map<String, dynamic>> setUserLanguages({
    required List<String> learningLanguages,
    String? nativeLanguage,
  }) async {
    return post(ApiEndpointsAppQy.userSetLanguages, data: {
      'learning_languages': learningLanguages,
      if (nativeLanguage != null) 'native_language': nativeLanguage,
    });
  }

  Future<Map<String, dynamic>> getVocabularyLibraries(
      {String? langCode}) async {
    return get(ApiEndpointsAppQy.vocabularyLibraries, queryParameters: {
      if (langCode != null) 'lang_code': langCode,
    });
  }

  Future<Map<String, dynamic>> selectVocabularyLibrary({
    required int collectionId,
    required String langCode,
    required String action,
  }) async {
    return post(ApiEndpointsAppQy.vocabularySelect, data: {
      'collection_id': collectionId,
      'lang_code': langCode,
      'action': action,
    });
  }

  Future<Map<String, dynamic>> getWordCards({
    required String langCode,
    int limit = 100,
  }) async {
    return get(ApiEndpointsAppQy.vocabularyWords, queryParameters: {
      'lang_code': langCode,
      'limit': limit,
    });
  }

  Future<Map<String, dynamic>> updateLearningProgress({
    required int progressId,
    required bool correct,
  }) async {
    return post(ApiEndpointsAppQy.vocabularyProgress, data: {
      'progress_id': progressId,
      'correct': correct,
    });
  }

  Future<Map<String, dynamic>> getLearningStats({String? langCode}) async {
    return get(ApiEndpointsAppQy.userStats, queryParameters: {
      if (langCode != null) 'lang_code': langCode,
    });
  }

  Future<Map<String, dynamic>> getSupportedLanguages() async {
    return get(ApiEndpointsAppQy.systemLanguages);
  }

  Future<Map<String, dynamic>> getLanguageByCode(String code) async {
    return get(
        ApiEndpointsAppQy.systemLanguageByCode.replaceAll('{code}', code));
  }

  Future<Map<String, dynamic>> generateTts({
    required String text,
    required String langCode,
    String textType = 'word',
    String rate = '+0%',
  }) async {
    // Use main service, TTS endpoints share the same base URL
    return post(ApiEndpointsAppQy.ttsGenerate, data: {
      'text': text,
      'language': langCode,
      'type': textType,
      'options': {'rate': rate},
    });
  }

  String getTtsAudioUrl(String audioPath) {
    // ApiEndpointsAppQy.ttsAudio is /api/app_qy_v1/ai_tools/tts/audio
    // baseUrl is http://192.168.50.2:9000/api
    // Result: http://192.168.50.2:9000/api/app_qy_v1/ai_tools/tts/audio/{audioPath}
    return '${_dio.options.baseUrl}${ApiEndpointsAppQy.ttsAudio}/$audioPath';
  }

  /// Update base URL when endpoint discovery completes
  void updateBaseUrl(String baseUrl) {
    _dio.options.baseUrl = baseUrl;
  }

  /// Get current base URL
  String get currentBaseUrl => _dio.options.baseUrl;

  Future<Map<String, dynamic>> queryDictionary({
    required String word,
    required String langCode,
  }) async {
    return get(ApiEndpointsAppQy.dictionaryQuery, queryParameters: {
      'word': word,
      'lang_code': langCode,
    });
  }

  Future<Map<String, dynamic>> getWordGroups() async {
    return get(ApiEndpointsAppQy.wordGroupList);
  }

  Future<Map<String, dynamic>> createWordGroup({
    required String name,
    required String langCode,
    String? description,
  }) async {
    return post(ApiEndpointsAppQy.wordGroupCreate, data: {
      'name': name,
      'lang_code': langCode,
      if (description != null) 'description': description,
    });
  }
}
