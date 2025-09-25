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

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../../common/network/api_client.dart';
import '../../../common/network/models/api_response.dart';
import '../../../common/network/models/enhanced_api_response.dart';
import '../../../common/cache/cache_manager.dart';
import '../models/chat_models.dart';
import '../models/user_models.dart';
import '../models/message_models.dart';

/// Extended API client for AChat with caching and enhanced features
class AChatApiClient extends ApiClient {
  static const String baseUrl = 'https://api.achat.enterprise.com/v1';

  final CacheManager _cacheManager = CacheManager.instance;

  AChatApiClient({required super.context}) {
    _initializeCache();
  }

  void _initializeCache() {
    _cacheManager.registerCacheConfig('conversations', const CacheConfig(
      defaultTtl: Duration(minutes: 2),
      maxSize: 100,
      persistToDisk: true,
      customBoxName: 'achat_conversations',
    ));

    _cacheManager.registerCacheConfig('messages', const CacheConfig(
      defaultTtl: Duration(minutes: 5),
      maxSize: 500,
      persistToDisk: true,
      customBoxName: 'achat_messages',
    ));

    _cacheManager.registerCacheConfig('user_profile', const CacheConfig(
      defaultTtl: Duration(minutes: 5),
      maxSize: 10,
      persistToDisk: true,
      customBoxName: 'achat_users',
    ));

    _cacheManager.registerCacheConfig('search_results', const CacheConfig(
      defaultTtl: Duration(minutes: 1),
      maxSize: 50,
      persistToDisk: false,
    ));
  }

  /// Authentication APIs
  Future<EnhancedApiResponse<AChatAuthResponse>> login({
    required String email,
    required String password,
    required AChatDeviceInfo deviceInfo,
    bool rememberMe = false,
  }) async {
    final response = await postData(
      '$baseUrl/auth/login',
      {
        'email': email,
        'password': password,
        'device_info': deviceInfo.toJson(),
        'remember_me': rememberMe,
      },
    );

    return _parseEnhancedResponse<AChatAuthResponse>(
      response,
      (data) => AChatAuthResponse.fromJson(data),
    );
  }

  Future<EnhancedApiResponse<AChatTokenResponse>> refreshToken({
    required String refreshToken,
    required String deviceId,
  }) async {
    final response = await postData(
      '$baseUrl/auth/refresh',
      {
        'refresh_token': refreshToken,
        'device_id': deviceId,
      },
    );

    return _parseEnhancedResponse<AChatTokenResponse>(
      response,
      (data) => AChatTokenResponse.fromJson(data),
    );
  }

  /// User Profile APIs with caching
  Future<EnhancedApiResponse<AChatUser>> getUserProfile({bool forceRefresh = false}) async {
    const cacheKey = 'current_user_profile';

    if (!forceRefresh) {
      final cachedUser = await _cacheManager.get<AChatUser>(
        'user_profile',
        cacheKey,
        fromJson: (data) => AChatUser.fromJson(data),
      );

      if (cachedUser != null) {
        return EnhancedApiResponse<AChatUser>(
          success: true,
          data: cachedUser,
          message: 'Profile loaded from cache',
          timestamp: DateTime.now(),
          cacheInfo: CacheInfo(cacheable: true, ttl: 300),
        );
      }
    }

    final response = await getData('$baseUrl/users/profile');
    final parsedResponse = _parseEnhancedResponse<AChatUser>(
      response,
      (data) => AChatUser.fromJson(data),
    );

    if (parsedResponse.success && parsedResponse.data != null) {
      await _cacheManager.put(
        'user_profile',
        cacheKey,
        parsedResponse.data!,
        ttl: Duration(minutes: 5),
        etag: parsedResponse.cacheInfo?.etag,
      );
    }

    return parsedResponse;
  }

  Future<EnhancedApiResponse<AChatUser>> updateUserProfile({
    required Map<String, dynamic> updates,
  }) async {
    final response = await putData('$baseUrl/users/profile', updates);
    final parsedResponse = _parseEnhancedResponse<AChatUser>(
      response,
      (data) => AChatUser.fromJson(data),
    );

    if (parsedResponse.success) {
      await _cacheManager.remove('user_profile', 'current_user_profile');
    }

    return parsedResponse;
  }

  /// Chat/Conversation APIs with caching
  Future<EnhancedApiResponse<List<AChatConversation>>> getConversations({
    int page = 1,
    int perPage = 20,
    String? search,
    String? filter,
    bool forceRefresh = false,
  }) async {
    final cacheKey = 'conversations_page_${page}_${perPage}_${search ?? ''}_${filter ?? ''}';

    if (!forceRefresh) {
      final cachedConversations = await _cacheManager.get<List<AChatConversation>>(
        'conversations',
        cacheKey,
      );

      if (cachedConversations != null) {
        return EnhancedApiResponse<List<AChatConversation>>(
          success: true,
          data: cachedConversations,
          message: 'Conversations loaded from cache',
          timestamp: DateTime.now(),
          cacheInfo: CacheInfo(cacheable: true, ttl: 120),
        );
      }
    }

    final queryParams = <String, String>{
      'page': page.toString(),
      'per_page': perPage.toString(),
    };
    if (search != null) queryParams['search'] = search;
    if (filter != null) queryParams['filter'] = filter;

    final uri = Uri.parse('$baseUrl/chats').replace(queryParameters: queryParams);
    final response = await getData(uri.toString());

    final parsedResponse = _parseEnhancedResponse<List<AChatConversation>>(
      response,
      (data) => (data as List).map((item) => AChatConversation.fromJson(item)).toList(),
    );

    if (parsedResponse.success && parsedResponse.data != null) {
      await _cacheManager.put(
        'conversations',
        cacheKey,
        parsedResponse.data!,
        ttl: Duration(minutes: 2),
        etag: parsedResponse.cacheInfo?.etag,
      );
    }

    return parsedResponse;
  }

  Future<EnhancedApiResponse<AChatConversation>> createConversation({
    required String type,
    required List<String> participantIds,
    String? name,
    String? description,
    AChatMessage? initialMessage,
  }) async {
    final body = <String, dynamic>{
      'type': type,
      'participants': participantIds,
    };

    if (name != null) body['name'] = name;
    if (description != null) body['description'] = description;
    if (initialMessage != null) body['initial_message'] = initialMessage.toJson();

    final response = await postData('$baseUrl/chats', body);
    final parsedResponse = _parseEnhancedResponse<AChatConversation>(
      response,
      (data) => AChatConversation.fromJson(data),
    );

    if (parsedResponse.success) {
      await _cacheManager.clear('conversations');
    }

    return parsedResponse;
  }

  /// Message APIs with caching
  Future<EnhancedApiResponse<List<AChatMessage>>> getMessages({
    required String chatId,
    int page = 1,
    int perPage = 50,
    String? beforeMessageId,
    String? afterMessageId,
    bool forceRefresh = false,
  }) async {
    final cacheKey = 'messages_${chatId}_page_${page}_${perPage}_${beforeMessageId ?? ''}_${afterMessageId ?? ''}';

    if (!forceRefresh) {
      final cachedMessages = await _cacheManager.get<List<AChatMessage>>(
        'messages',
        cacheKey,
      );

      if (cachedMessages != null) {
        return EnhancedApiResponse<List<AChatMessage>>(
          success: true,
          data: cachedMessages,
          message: 'Messages loaded from cache',
          timestamp: DateTime.now(),
          cacheInfo: CacheInfo(cacheable: true, ttl: 300),
        );
      }
    }

    final queryParams = <String, String>{
      'page': page.toString(),
      'per_page': perPage.toString(),
    };
    if (beforeMessageId != null) queryParams['before'] = beforeMessageId;
    if (afterMessageId != null) queryParams['after'] = afterMessageId;

    final uri = Uri.parse('$baseUrl/chats/$chatId/messages').replace(queryParameters: queryParams);
    final response = await getData(uri.toString());

    final parsedResponse = _parseEnhancedResponse<List<AChatMessage>>(
      response,
      (data) => (data as List).map((item) => AChatMessage.fromJson(item)).toList(),
    );

    if (parsedResponse.success && parsedResponse.data != null) {
      await _cacheManager.put(
        'messages',
        cacheKey,
        parsedResponse.data!,
        ttl: Duration(minutes: 5),
        etag: parsedResponse.cacheInfo?.etag,
      );
    }

    return parsedResponse;
  }

  Future<EnhancedApiResponse<AChatMessage>> sendMessage({
    required String chatId,
    required String content,
    required String type,
    String? replyToMessageId,
    List<String>? attachmentIds,
    String? clientId,
    bool encrypt = false,
    Map<String, dynamic>? metadata,
  }) async {
    final body = <String, dynamic>{
      'content': content,
      'type': type,
    };

    if (replyToMessageId != null) body['reply_to'] = replyToMessageId;
    if (attachmentIds != null) body['attachments'] = attachmentIds;
    if (clientId != null) body['client_id'] = clientId;
    if (encrypt) body['encrypt'] = encrypt;
    if (metadata != null) body['metadata'] = metadata;

    final response = await postData('$baseUrl/chats/$chatId/messages', body);
    final parsedResponse = _parseEnhancedResponse<AChatMessage>(
      response,
      (data) => AChatMessage.fromJson(data),
    );

    if (parsedResponse.success) {
      await _cacheManager.clear('conversations');
      final chatCachePattern = 'messages_${chatId}_';
      // Clear related message cache entries
      await _clearCachePattern('messages', chatCachePattern);
    }

    return parsedResponse;
  }

  Future<EnhancedApiResponse<AChatMessage>> editMessage({
    required String messageId,
    required String newContent,
    String? editReason,
  }) async {
    final body = <String, dynamic>{
      'content': newContent,
    };

    if (editReason != null) body['edit_reason'] = editReason;

    final response = await putData('$baseUrl/messages/$messageId', body);
    final parsedResponse = _parseEnhancedResponse<AChatMessage>(
      response,
      (data) => AChatMessage.fromJson(data),
    );

    if (parsedResponse.success) {
      await _clearCachePattern('messages', 'messages_');
    }

    return parsedResponse;
  }

  /// Real-time operations
  Future<EnhancedApiResponse<Map<String, dynamic>>> sendTypingIndicator({
    required String chatId,
    required bool isTyping,
    int typingTimeout = 5000,
  }) async {
    final response = await postData('$baseUrl/chats/$chatId/typing', {
      'is_typing': isTyping,
      'typing_timeout': typingTimeout,
    });

    return _parseEnhancedResponse<Map<String, dynamic>>(
      response,
      (data) => data as Map<String, dynamic>,
    );
  }

  Future<EnhancedApiResponse<Map<String, dynamic>>> markConversationAsRead({
    required String chatId,
    String? lastReadMessageId,
    bool readAll = true,
  }) async {
    final body = <String, dynamic>{
      'read_all': readAll,
    };

    if (lastReadMessageId != null) body['last_read_message_id'] = lastReadMessageId;

    final response = await postData('$baseUrl/chats/$chatId/mark-read', body);
    final parsedResponse = _parseEnhancedResponse<Map<String, dynamic>>(
      response,
      (data) => data as Map<String, dynamic>,
    );

    if (parsedResponse.success) {
      await _cacheManager.clear('conversations');
    }

    return parsedResponse;
  }

  /// File upload with progress
  Future<EnhancedApiResponse<AChatFileInfo>> uploadFile({
    required File file,
    required String type,
    String? chatId,
    bool compress = true,
    bool encrypt = false,
    String thumbnailSize = 'medium',
    Function(int progress)? onProgress,
  }) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/files/upload'),
      );

      refreshUpdateHeader();
      request.headers.addAll(_mainHeaders);

      request.fields.addAll({
        'type': type,
        'compress': compress.toString(),
        'encrypt': encrypt.toString(),
        'thumbnail_size': thumbnailSize,
      });

      if (chatId != null) {
        request.fields['chat_id'] = chatId;
      }

      final multipartFile = await http.MultipartFile.fromPath(
        'file',
        file.path,
        filename: file.path.split('/').last,
      );

      request.files.add(multipartFile);

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      final mockResponse = Response(
        body: json.decode(response.body),
        statusCode: response.statusCode,
        headers: response.headers,
        bodyString: response.body,
      );

      return _parseEnhancedResponse<AChatFileInfo>(
        mockResponse,
        (data) => AChatFileInfo.fromJson(data),
      );
    } catch (e) {
      return EnhancedApiResponse<AChatFileInfo>(
        success: false,
        error: 'File upload failed: $e',
        timestamp: DateTime.now(),
      );
    }
  }

  /// Search APIs with caching
  Future<EnhancedApiResponse<AChatSearchResults>> search({
    required String query,
    String type = 'all',
    String? chatId,
    int limit = 20,
    int offset = 0,
    DateTime? dateFrom,
    DateTime? dateTo,
  }) async {
    final cacheKey = 'search_${query}_${type}_${chatId ?? ''}_${limit}_${offset}';

    final cachedResults = await _cacheManager.get<AChatSearchResults>(
      'search_results',
      cacheKey,
    );

    if (cachedResults != null) {
      return EnhancedApiResponse<AChatSearchResults>(
        success: true,
        data: cachedResults,
        message: 'Search results loaded from cache',
        timestamp: DateTime.now(),
        cacheInfo: CacheInfo(cacheable: true, ttl: 60),
      );
    }

    final queryParams = <String, String>{
      'query': query,
      'type': type,
      'limit': limit.toString(),
      'offset': offset.toString(),
    };

    if (chatId != null) queryParams['chat_id'] = chatId;
    if (dateFrom != null) queryParams['date_from'] = dateFrom.toIso8601String();
    if (dateTo != null) queryParams['date_to'] = dateTo.toIso8601String();

    final uri = Uri.parse('$baseUrl/search').replace(queryParameters: queryParams);
    final response = await getData(uri.toString());

    final parsedResponse = _parseEnhancedResponse<AChatSearchResults>(
      response,
      (data) => AChatSearchResults.fromJson(data),
    );

    if (parsedResponse.success && parsedResponse.data != null) {
      await _cacheManager.put(
        'search_results',
        cacheKey,
        parsedResponse.data!,
        ttl: Duration(minutes: 1),
      );
    }

    return parsedResponse;
  }

  /// Helper methods
  EnhancedApiResponse<T> _parseEnhancedResponse<T>(
    Response response,
    T Function(dynamic) fromJsonT,
  ) {
    if (response.statusCode == 200 && response.body != null) {
      try {
        final jsonData = response.body as Map<String, dynamic>;
        return EnhancedApiResponse.fromJson<T>(jsonData, fromJsonT);
      } catch (e) {
        return EnhancedApiResponse<T>(
          success: false,
          error: 'Response parsing failed: $e',
          timestamp: DateTime.now(),
        );
      }
    } else {
      return EnhancedApiResponse<T>(
        success: false,
        error: response.statusText ?? 'Unknown error',
        statusCode: response.statusCode,
        timestamp: DateTime.now(),
      );
    }
  }

  Future<void> _clearCachePattern(String cacheType, String pattern) async {
    // Implementation to clear cache entries matching a pattern
    // This would require extending the cache manager
    await _cacheManager.clear(cacheType);
  }

  /// Cache management methods
  Future<void> clearCache({String? cacheType}) async {
    if (cacheType != null) {
      await _cacheManager.clear(cacheType);
    } else {
      await _cacheManager.clearAll();
    }
  }

  Future<Map<String, dynamic>> getCacheStats() async {
    return await _cacheManager.getStats();
  }
}