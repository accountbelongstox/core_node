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
import 'package:flutter/foundation.dart';
// Fix: Use new unified network client architecture
import '../../../common/network/network_framework.dart';
// Fix: Add prefix to avoid CacheManager conflict with network_types.dart
import '../../../common/cache_manager/cache_manager.dart' as cache;
import '../config_app_achat/api_config_achat.dart';
import '../models/chat_models.dart';
import '../models/user_models.dart';
import '../models/message_models.dart';

/// Extended API client for AChat connecting to BankV1 backend
/// 
/// REFACTOR: Now uses UnifiedNetworkClient instead of legacy ApiClient
/// Cross-app data consistency implementation with BankV1 backend
class AChatApiClient {
  final UnifiedNetworkClient _client;
  final cache.CacheManager _cacheManager = cache.CacheManager.instance;
  bool _isInitialized = false;

  AChatApiClient._({
    required UnifiedNetworkClient client,
  }) : _client = client;

  /// Factory: Create AChat API client with config
  factory AChatApiClient.create({
    ApiConfig? config,
  }) {
    final apiConfig = config ?? ApiConfigAChat.testApiConfig;
    final client = UnifiedNetworkClient.create(
      config: apiConfig,
      instanceKey: 'achat_api_client',
    );
    
    return AChatApiClient._(client: client);
  }

  /// Initialize client and cache configurations
  Future<void> initialize() async {
    if (_isInitialized) return;

    _cacheManager.registerCacheConfig('conversations', const cache.CacheConfig(
      defaultTtl: Duration(minutes: 2),
      maxSize: 100,
      persistToDisk: true,
      customBoxName: 'achat_conversations',
    ));

    _cacheManager.registerCacheConfig('messages', const cache.CacheConfig(
      defaultTtl: Duration(minutes: 5),
      maxSize: 500,
      persistToDisk: true,
      customBoxName: 'achat_messages',
    ));

    _cacheManager.registerCacheConfig('user_profile', const cache.CacheConfig(
      defaultTtl: Duration(minutes: 5),
      maxSize: 10,
      persistToDisk: true,
      customBoxName: 'achat_users',
    ));

    _cacheManager.registerCacheConfig('search_results', const cache.CacheConfig(
      defaultTtl: Duration(minutes: 1),
      maxSize: 50,
      persistToDisk: false,
    ));

    _isInitialized = true;
    
    if (kDebugMode) {
      debugPrint('[AChatApiClient] Initialized successfully');
    }
  }

  /// Helper: Build NetworkRequest for common operations
  /// Fix: Use RequestMethod enum and correct parameter names
  NetworkRequest _buildRequest({
    required String endpoint,
    required RequestMethod method,
    Map<String, dynamic>? body,
    Map<String, dynamic>? queryParameters,
  }) {
    return NetworkRequest(
      endpoint: endpoint,
      method: method,
      body: body,
      parameters: queryParameters,
      priority: RequestPriority.normal,
    );
  }

  /// Authentication APIs
  Future<NetworkResponse<AChatAuthResponse>> login({
    required String email,
    required String password,
    required AChatDeviceInfo deviceInfo,
    bool rememberMe = false,
  }) async {
    final request = _buildRequest(
      endpoint: ApiEndpointsAChat.appOpen,
      method: RequestMethod.post,
      body: {
        'email': email,
        'password': password,
        'device_info': deviceInfo.toJson(),
        'remember_me': rememberMe,
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    return NetworkResponse<AChatAuthResponse>(
      statusCode: response.statusCode,
      data: response.data != null ? AChatAuthResponse.fromJson(response.data!) : null,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<AChatTokenResponse>> refreshToken({
    required String refreshToken,
    required String deviceId,
  }) async {
    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/auth/refresh',
      method: RequestMethod.post,
      body: {
        'refresh_token': refreshToken,
        'device_id': deviceId,
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    return NetworkResponse<AChatTokenResponse>(
      statusCode: response.statusCode,
      data: response.data != null ? AChatTokenResponse.fromJson(response.data!) : null,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<bool>> logout({
    required String deviceId,
  }) async {
    final request = _buildRequest(
      endpoint: ApiEndpointsAChat.appClose,
      method: RequestMethod.post,
      body: {
        'device_id': deviceId,
        'timestamp': AChatDeviceInfo.currentTimestamp,
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    return NetworkResponse<bool>(
      statusCode: response.statusCode,
      data: response.statusCode == 200,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// User Management APIs
  Future<NetworkResponse<AChatUser>> getUserProfile({
    required String userId,
    bool useCache = true,
  }) async {
    final cacheKey = 'user_profile_$userId';

    if (useCache) {
      // Fix: await cache.get() as it returns Future<T?>
      final cached = await _cacheManager.get<AChatUser>('user_profile', cacheKey);
      if (cached != null) {
        if (kDebugMode) {
          debugPrint('[AChatApiClient] User profile loaded from cache: $userId');
        }
        return NetworkResponse<AChatUser>(
          statusCode: 200,
          data: cached,
          message: 'From cache',
          timestamp: DateTime.now(),
        );
      }
    }

    final request = _buildRequest(
      endpoint: '${ApiEndpointsAChat.userProfile}/$userId',
      method: RequestMethod.get,
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    final user = response.data != null ? AChatUser.fromJson(response.data!) : null;
    
    if (user != null && useCache) {
      await _cacheManager.put('user_profile', cacheKey, user);
    }

    return NetworkResponse<AChatUser>(
      statusCode: response.statusCode,
      data: user,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<AChatUser>> updateUserProfile({
    required String userId,
    String? fullName,
    String? bio,
    String? avatar,
    Map<String, dynamic>? additionalData,
  }) async {
    final updateData = <String, dynamic>{
      'updated_at': DateTime.now().toIso8601String(),
    };

    if (fullName != null) updateData['full_name'] = fullName;
    if (bio != null) updateData['bio'] = bio;
    if (avatar != null) updateData['avatar'] = avatar;
    if (additionalData != null) updateData.addAll(additionalData);

    final request = _buildRequest(
      endpoint: '${ApiEndpointsAChat.updateProfile}/$userId',
      method: RequestMethod.put,
      body: updateData,
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    final user = response.data != null ? AChatUser.fromJson(response.data!) : null;
    
    if (user != null) {
      await _cacheManager.put('user_profile', 'user_profile_$userId', user);
    }

    return NetworkResponse<AChatUser>(
      statusCode: response.statusCode,
      data: user,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<List<AChatUser>>> searchUsers({
    required String query,
    int page = 1,
    int limit = 20,
  }) async {
    final cacheKey = 'search_${query}_${page}_$limit';
    // Fix: await cache.get() as it returns Future<T?>
    final cached = await _cacheManager.get<List<AChatUser>>('search_results', cacheKey);
    
    if (cached != null) {
      return NetworkResponse<List<AChatUser>>(
        statusCode: 200,
        data: cached,
        message: 'From cache',
        timestamp: DateTime.now(),
      );
    }

    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/users/search',
      method: RequestMethod.get,
      queryParameters: {
        'q': query,
        'page': page.toString(),
        'limit': limit.toString(),
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    List<AChatUser>? users;
    if (response.data != null && response.data!['users'] is List) {
      users = (response.data!['users'] as List)
          .map((json) => AChatUser.fromJson(json as Map<String, dynamic>))
          .toList();
      await _cacheManager.put('search_results', cacheKey, users);
    }

    return NetworkResponse<List<AChatUser>>(
      statusCode: response.statusCode,
      data: users,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// Conversation APIs
  Future<NetworkResponse<List<AChatConversation>>> getConversations({
    int page = 1,
    int limit = 20,
    bool useCache = true,
  }) async {
    final cacheKey = 'conversations_${page}_$limit';

    if (useCache) {
      // Fix: await cache.get() as it returns Future<T?>
      final cached = await _cacheManager.get<List<AChatConversation>>('conversations', cacheKey);
      if (cached != null) {
        return NetworkResponse<List<AChatConversation>>(
          statusCode: 200,
          data: cached,
          message: 'From cache',
          timestamp: DateTime.now(),
        );
      }
    }

    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/conversations',
      method: RequestMethod.get,
      queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    List<AChatConversation>? conversations;
    if (response.data != null && response.data!['conversations'] is List) {
      conversations = (response.data!['conversations'] as List)
          .map((json) => AChatConversation.fromJson(json as Map<String, dynamic>))
          .toList();
      
      if (useCache) {
        await _cacheManager.put('conversations', cacheKey, conversations);
      }
    }

    return NetworkResponse<List<AChatConversation>>(
      statusCode: response.statusCode,
      data: conversations,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<AChatConversation>> getConversation({
    required String conversationId,
    bool useCache = true,
  }) async {
    final cacheKey = 'conversation_$conversationId';

    if (useCache) {
      // Fix: await cache.get() as it returns Future<T?>
      final cached = await _cacheManager.get<AChatConversation>('conversations', cacheKey);
      if (cached != null) {
        return NetworkResponse<AChatConversation>(
          statusCode: 200,
          data: cached,
          message: 'From cache',
          timestamp: DateTime.now(),
        );
      }
    }

    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/conversations/$conversationId',
      method: RequestMethod.get,
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    final conversation = response.data != null ? AChatConversation.fromJson(response.data!) : null;
    
    if (conversation != null && useCache) {
      await _cacheManager.put('conversations', cacheKey, conversation);
    }

    return NetworkResponse<AChatConversation>(
      statusCode: response.statusCode,
      data: conversation,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<AChatConversation>> createConversation({
    required String participantId,
    String? initialMessage,
    AChatConversationType type = AChatConversationType.direct,
  }) async {
    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/conversations',
      method: RequestMethod.post,
      body: {
        'participant_id': participantId,
        'type': type.toString().split('.').last,
        if (initialMessage != null) 'initial_message': initialMessage,
        'created_at': DateTime.now().toIso8601String(),
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    final conversation = response.data != null ? AChatConversation.fromJson(response.data!) : null;
    
    if (conversation != null) {
      _cacheManager.clear('conversations');
    }

    return NetworkResponse<AChatConversation>(
      statusCode: response.statusCode,
      data: conversation,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// Message APIs
  Future<NetworkResponse<List<AChatMessage>>> getMessages({
    required String conversationId,
    int page = 1,
    int limit = 50,
    bool useCache = true,
  }) async {
    final cacheKey = 'messages_${conversationId}_${page}_$limit';

    if (useCache) {
      // Fix: await cache.get() as it returns Future<T?>
      final cached = await _cacheManager.get<List<AChatMessage>>('messages', cacheKey);
      if (cached != null) {
        return NetworkResponse<List<AChatMessage>>(
          statusCode: 200,
          data: cached,
          message: 'From cache',
          timestamp: DateTime.now(),
        );
      }
    }

    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/conversations/$conversationId/messages',
      method: RequestMethod.get,
      queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    List<AChatMessage>? messages;
    if (response.data != null && response.data!['messages'] is List) {
      messages = (response.data!['messages'] as List)
          .map((json) => AChatMessage.fromJson(json as Map<String, dynamic>))
          .toList();
      
      if (useCache) {
        await _cacheManager.put('messages', cacheKey, messages);
      }
    }

    return NetworkResponse<List<AChatMessage>>(
      statusCode: response.statusCode,
      data: messages,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<AChatMessage>> sendMessage({
    required String conversationId,
    required String content,
    AChatMessageType type = AChatMessageType.text,
    List<AChatAttachment>? attachments,
    Map<String, dynamic>? metadata,
  }) async {
    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/conversations/$conversationId/messages',
      method: RequestMethod.post,
      body: {
        'content': content,
        'type': type.toString().split('.').last,
        if (attachments != null) 'attachments': attachments.map((a) => a.toJson()).toList(),
        if (metadata != null) 'metadata': metadata,
        'sent_at': DateTime.now().toIso8601String(),
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    final message = response.data != null ? AChatMessage.fromJson(response.data!) : null;
    
    if (message != null) {
      _cacheManager.clear('messages');
    }

    return NetworkResponse<AChatMessage>(
      statusCode: response.statusCode,
      data: message,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<bool>> markMessageAsRead({
    required String conversationId,
    required String messageId,
  }) async {
    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/conversations/$conversationId/messages/$messageId/read',
      method: RequestMethod.put,
      body: {
        'read_at': DateTime.now().toIso8601String(),
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    return NetworkResponse<bool>(
      statusCode: response.statusCode,
      data: response.statusCode == 200,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<bool>> deleteMessage({
    required String conversationId,
    required String messageId,
  }) async {
    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/conversations/$conversationId/messages/$messageId',
      method: RequestMethod.delete,
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    if (response.statusCode == 200) {
      _cacheManager.clear('messages');
    }

    return NetworkResponse<bool>(
      statusCode: response.statusCode,
      data: response.statusCode == 200,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// Group Chat APIs
  Future<NetworkResponse<AChatGroup>> createGroup({
    required String name,
    required List<String> memberIds,
    String? description,
    String? avatar,
  }) async {
    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/groups',
      method: RequestMethod.post,
      body: {
        'name': name,
        'member_ids': memberIds,
        if (description != null) 'description': description,
        if (avatar != null) 'avatar': avatar,
        'created_at': DateTime.now().toIso8601String(),
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    final group = response.data != null ? AChatGroup.fromJson(response.data!) : null;

    return NetworkResponse<AChatGroup>(
      statusCode: response.statusCode,
      data: group,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<AChatGroup>> updateGroup({
    required String groupId,
    String? name,
    String? description,
    String? avatar,
  }) async {
    final updateData = <String, dynamic>{
      'updated_at': DateTime.now().toIso8601String(),
    };

    if (name != null) updateData['name'] = name;
    if (description != null) updateData['description'] = description;
    if (avatar != null) updateData['avatar'] = avatar;

    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/groups/$groupId',
      method: RequestMethod.put,
      body: updateData,
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    final group = response.data != null ? AChatGroup.fromJson(response.data!) : null;

    return NetworkResponse<AChatGroup>(
      statusCode: response.statusCode,
      data: group,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<bool>> addGroupMember({
    required String groupId,
    required String userId,
  }) async {
    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/groups/$groupId/members',
      method: RequestMethod.post,
      body: {
        'user_id': userId,
        'added_at': DateTime.now().toIso8601String(),
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);

    return NetworkResponse<bool>(
      statusCode: response.statusCode,
      data: response.statusCode == 200,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  Future<NetworkResponse<bool>> removeGroupMember({
    required String groupId,
    required String userId,
  }) async {
    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/groups/$groupId/members/$userId',
      method: RequestMethod.delete,
    );

    final response = await _client.request<Map<String, dynamic>>(request);

    return NetworkResponse<bool>(
      statusCode: response.statusCode,
      data: response.statusCode == 200,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// File Upload APIs
  Future<NetworkResponse<AChatFileInfo>> uploadFile({
    required String filePath,
    required String fileName,
    String? mimeType,
    Function(int sent, int total)? onProgress,
  }) async {
    // Note: File upload would require multipart handling
    // This is a simplified version
    final request = _buildRequest(
      endpoint: '${ApiConfigAChat.basePath}/files/upload',
      method: RequestMethod.post,
      body: {
        'file_path': filePath,
        'file_name': fileName,
        if (mimeType != null) 'mime_type': mimeType,
        'uploaded_at': DateTime.now().toIso8601String(),
      },
    );

    final response = await _client.request<Map<String, dynamic>>(request);
    
    final fileInfo = response.data != null ? AChatFileInfo.fromJson(response.data!) : null;

    return NetworkResponse<AChatFileInfo>(
      statusCode: response.statusCode,
      data: fileInfo,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// Device & Session Management APIs
  Future<NetworkResponse<bool>> sendHeartbeat({
    required String deviceId,
    int? sessionDuration,
  }) async {
    final request = _buildRequest(
      endpoint: ApiEndpointsAChat.appHeartbeat,
      method: RequestMethod.post,
      body: AChatApiModels.heartbeatRequest(
        timestamp: AChatDeviceInfo.currentTimestamp,
        sessionDuration: sessionDuration,
      ),
    );

    final response = await _client.request<Map<String, dynamic>>(request);

    return NetworkResponse<bool>(
      statusCode: response.statusCode,
      data: response.statusCode == 200,
      error: response.error,
      message: response.message,
      timestamp: response.timestamp,
    );
  }

  /// Cache Management
  void clearAllCache() {
    _cacheManager.clear('conversations');
    _cacheManager.clear('messages');
    _cacheManager.clear('user_profile');
    _cacheManager.clear('search_results');
    
    if (kDebugMode) {
      debugPrint('[AChatApiClient] All caches cleared');
    }
  }

  void clearCache(String cacheType) {
    _cacheManager.clear(cacheType);
    
    if (kDebugMode) {
      debugPrint('[AChatApiClient] Cache cleared: $cacheType');
    }
  }

  /// Dispose
  void dispose() {
    // UnifiedNetworkClient manages its own lifecycle
    if (kDebugMode) {
      debugPrint('[AChatApiClient] Disposed');
    }
  }
}

/// Response type definitions for type-safe API responses

class AChatAuthResponse {
  final String accessToken;
  final String refreshToken;
  final String tokenType;
  final int expiresIn;
  final AChatUser user;

  AChatAuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.tokenType,
    required this.expiresIn,
    required this.user,
  });

  factory AChatAuthResponse.fromJson(Map<String, dynamic> json) {
    return AChatAuthResponse(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
      tokenType: json['token_type'] as String? ?? 'Bearer',
      expiresIn: json['expires_in'] as int,
      user: AChatUser.fromJson(json['user'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'access_token': accessToken,
      'refresh_token': refreshToken,
      'token_type': tokenType,
      'expires_in': expiresIn,
      'user': user.toJson(),
    };
  }
}

class AChatTokenResponse {
  final String accessToken;
  final String tokenType;
  final int expiresIn;

  AChatTokenResponse({
    required this.accessToken,
    required this.tokenType,
    required this.expiresIn,
  });

  factory AChatTokenResponse.fromJson(Map<String, dynamic> json) {
    return AChatTokenResponse(
      accessToken: json['access_token'] as String,
      tokenType: json['token_type'] as String? ?? 'Bearer',
      expiresIn: json['expires_in'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'access_token': accessToken,
      'token_type': tokenType,
      'expires_in': expiresIn,
    };
  }
}

class AChatDeviceInfo {
  final String deviceId;
  final String platform;
  final String appVersion;
  final String osVersion;

  AChatDeviceInfo({
    required this.deviceId,
    required this.platform,
    required this.appVersion,
    required this.osVersion,
  });

  Map<String, dynamic> toJson() {
    return {
      'device_id': deviceId,
      'platform': platform,
      'app_version': appVersion,
      'os_version': osVersion,
    };
  }

  static int get currentTimestamp => DateTime.now().millisecondsSinceEpoch;
}
