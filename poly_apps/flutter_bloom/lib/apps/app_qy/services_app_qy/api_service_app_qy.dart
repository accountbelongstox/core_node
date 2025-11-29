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
    // baseUrl is http://192.168.50.2:9000 (host:port only)
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

  // User Initialization
  Future<Map<String, dynamic>> getUserInitializationStatus() async {
    return get(ApiEndpointsAppQy.userInitializationStatus);
  }

  Future<Map<String, dynamic>> initializeUser({
    required List<String> learningLanguages,
    required String occupation,
    required int dailyWordsTarget,
    required int dailyStudyTime,
    Map<String, dynamic>? preferences,
  }) async {
    return post(ApiEndpointsAppQy.userInitialize, data: {
      'learning_languages': learningLanguages,
      'occupation': occupation,
      'daily_words_target': dailyWordsTarget,
      'daily_study_time': dailyStudyTime,
      if (preferences != null) 'preferences': preferences,
    });
  }

  Future<Map<String, dynamic>> updateUserProfile({
    String? occupation,
    int? dailyWordsTarget,
    int? dailyStudyTime,
    Map<String, dynamic>? preferences,
  }) async {
    return patch(ApiEndpointsAppQy.userProfileUpdate, data: {
      if (occupation != null) 'occupation': occupation,
      if (dailyWordsTarget != null) 'daily_words_target': dailyWordsTarget,
      if (dailyStudyTime != null) 'daily_study_time': dailyStudyTime,
      if (preferences != null) 'preferences': preferences,
    });
  }

  // Memory Bank
  Future<Map<String, dynamic>> getMemoryBank({
    String? language,
    int page = 1,
    int perPage = 50,
    String? status,
  }) async {
    return get(ApiEndpointsAppQy.memoryBank, queryParameters: {
      if (language != null) 'language': language,
      'page': page,
      'per_page': perPage,
      if (status != null) 'status': status,
    });
  }

  Future<Map<String, dynamic>> addLibraryToMemoryBank({
    required int libraryId,
  }) async {
    return post(ApiEndpointsAppQy.memoryBankLibrary, data: {
      'library_id': libraryId,
    });
  }

  Future<Map<String, dynamic>> removeLibraryFromMemoryBank({
    required int libraryId,
  }) async {
    return delete(
      '${ApiEndpointsAppQy.memoryBankLibrary}/$libraryId',
    );
  }

  Future<Map<String, dynamic>> uploadFileToMemoryBank({
    required String filePath,
    String? language,
    String? extractMode,
  }) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
      if (language != null) 'language': language,
      if (extractMode != null) 'extract_mode': extractMode,
    });
    return post(ApiEndpointsAppQy.memoryBankUploadFile, data: formData);
  }

  Future<Map<String, dynamic>> uploadTextToMemoryBank({
    required String text,
    String? language,
    String? extractMode,
  }) async {
    return post(ApiEndpointsAppQy.memoryBankUploadText, data: {
      'text': text,
      if (language != null) 'language': language,
      if (extractMode != null) 'extract_mode': extractMode,
    });
  }

  Future<Map<String, dynamic>> setMemoryBankStatus({
    required String status,
    String? language,
  }) async {
    return patch(ApiEndpointsAppQy.memoryBankStatus, data: {
      'status': status,
      if (language != null) 'language': language,
    });
  }

  Future<Map<String, dynamic>> setWordStatusInMemoryBank({
    required int wordId,
    required String status,
    double? masteryLevel,
    DateTime? nextReviewAt,
  }) async {
    return patch('${ApiEndpointsAppQy.memoryBankWordStatus}/$wordId/status', data: {
      'status': status,
      if (masteryLevel != null) 'mastery_level': masteryLevel,
      if (nextReviewAt != null) 'next_review_at': nextReviewAt.toIso8601String(),
    });
  }

  // Vocabulary Libraries (Public)
  Future<Map<String, dynamic>> getRecommendedVocabularyLibraries({
    String? language,
    int limit = 10,
  }) async {
    return get(ApiEndpointsAppQy.vocabularyLibrariesRecommended, queryParameters: {
      if (language != null) 'language': language,
      'limit': limit,
    });
  }

  Future<Map<String, dynamic>> getAllVocabularyLibraries({
    int page = 1,
    int perPage = 20,
    String? language,
    String? category,
    String? difficulty,
    String? search,
  }) async {
    return get(ApiEndpointsAppQy.vocabularyLibrariesAll, queryParameters: {
      'page': page,
      'per_page': perPage,
      if (language != null) 'language': language,
      if (category != null) 'category': category,
      if (difficulty != null) 'difficulty': difficulty,
      if (search != null) 'search': search,
    });
  }

  // Reading Materials
  Future<Map<String, dynamic>> getRecommendedDailyReading({
    String? language,
    int limit = 5,
  }) async {
    return get(ApiEndpointsAppQy.readingDailyRecommended, queryParameters: {
      if (language != null) 'language': language,
      'limit': limit,
    });
  }

  Future<Map<String, dynamic>> getAllDailyReading({
    int page = 1,
    int perPage = 20,
    String? language,
    String? difficulty,
    String? search,
  }) async {
    return get(ApiEndpointsAppQy.readingDailyAll, queryParameters: {
      'page': page,
      'per_page': perPage,
      if (language != null) 'language': language,
      if (difficulty != null) 'difficulty': difficulty,
      if (search != null) 'search': search,
    });
  }

  Future<Map<String, dynamic>> getRecommendedBooks({
    String? language,
    int limit = 10,
  }) async {
    return get(ApiEndpointsAppQy.readingBooksRecommended, queryParameters: {
      if (language != null) 'language': language,
      'limit': limit,
    });
  }

  Future<Map<String, dynamic>> getAllBooks({
    int page = 1,
    int perPage = 20,
    String? language,
    String? difficulty,
    String? search,
  }) async {
    return get(ApiEndpointsAppQy.readingBooksAll, queryParameters: {
      'page': page,
      'per_page': perPage,
      if (language != null) 'language': language,
      if (difficulty != null) 'difficulty': difficulty,
      if (search != null) 'search': search,
    });
  }

  Future<Map<String, dynamic>> getReadingArticle({
    required int articleId,
  }) async {
    return get('${ApiEndpointsAppQy.readingArticle}/$articleId');
  }

  Future<Map<String, dynamic>> getBookDetails({
    required int bookId,
  }) async {
    return get('${ApiEndpointsAppQy.readingBook}/$bookId');
  }

  Future<Map<String, dynamic>> getBookChapter({
    required int bookId,
    required int chapterId,
  }) async {
    return get('${ApiEndpointsAppQy.readingBookChapter}/$bookId/chapter/$chapterId');
  }

  // AI Features
  Future<Map<String, dynamic>> getAiUsageLimit() async {
    return get(ApiEndpointsAppQy.aiUsageLimit);
  }

  Future<Map<String, dynamic>> getAiWordExplanation({
    required String word,
    String? language,
    String? context,
  }) async {
    return post(ApiEndpointsAppQy.aiWordExplanation, data: {
      'word': word,
      if (language != null) 'language': language,
      if (context != null) 'context': context,
    });
  }

  Future<Map<String, dynamic>> getAiLearningAssistant({
    required String question,
    String? context,
  }) async {
    return post(ApiEndpointsAppQy.aiLearningAssistant, data: {
      'question': question,
      if (context != null) 'context': context,
    });
  }

  // Word Search (Public)
  Future<Map<String, dynamic>> lookupWordPublic({
    required String word,
    String? language,
  }) async {
    return get('${ApiEndpointsAppQy.wordPublicLookup}/$word', queryParameters: {
      if (language != null) 'language': language,
    });
  }

  // Enhanced Word Query
  Future<Map<String, dynamic>> getEnhancedWord({
    required String word,
    String? language,
  }) async {
    return get('${ApiEndpointsAppQy.wordEnhanced}/$word/enhanced', queryParameters: {
      if (language != null) 'language': language,
    });
  }

  // Translation
  Future<Map<String, dynamic>> translateText({
    required String text,
    required String sourceLang,
    required String targetLang,
  }) async {
    return post(ApiEndpointsAppQy.translateText, data: {
      'text': text,
      'source_lang': sourceLang,
      'target_lang': targetLang,
    });
  }

  Future<Map<String, dynamic>> translateBatch({
    required List<String> texts,
    required String sourceLang,
    required String targetLang,
  }) async {
    return post(ApiEndpointsAppQy.translateBatch, data: {
      'texts': texts,
      'source_lang': sourceLang,
      'target_lang': targetLang,
    });
  }
}
