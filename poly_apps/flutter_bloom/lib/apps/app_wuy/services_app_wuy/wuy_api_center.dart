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

import 'package:flutter/foundation.dart';
import 'package:qyflutter/common/network/network_framework.dart';
import 'package:qyflutter/common/network/core/endpoint_network_models.dart' as models;
import '../config_app_wuy/app_config_app_wuy.dart';
import '../config_app_wuy/api_config_app_wuy.dart';
import '../models_app_wuy/user_model_app_wuy.dart';
import '../models_app_wuy/friend_model_app_wuy.dart';
import '../models_app_wuy/chat_message_model_app_wuy.dart';
import '../models_app_wuy/location_model_app_wuy.dart';
import 'wuy_network_manager.dart';

/// Wuy API Center
/// A global API access center for Wuy app.
/// Integrates with the common network framework and handles API calls,
/// including offline mode with fake data.
class WuyApiCenter extends AdvancedNetworkService {
  static final WuyApiCenter _instance = WuyApiCenter._internal();

  factory WuyApiCenter() => _instance;

  WuyApiCenter._internal();

  final WuyNetworkManager _networkManager = WuyNetworkManager();

  @override
  String get serviceName => AppConfigAppWuy.appId;

  @override
  ApiConfig get apiConfig => ApiConfigAppWuy.currentApiConfig;

  @override
  EndpointConfig get endpointConfig => EndpointConfig(appName: AppConfigAppWuy.appId);

  /// Check if we should use offline mode
  bool _shouldUseOfflineMode() {
    return _networkManager.shouldUseOfflineMode();
  }

  /// Generate a request ID
  String _generateRequestId() {
    return '${DateTime.now().millisecondsSinceEpoch}_${UniqueKey().toString()}';
  }

  /// Create success response
  models.NetworkResponse<T> _createSuccessResponse<T>({
    required T data,
    String? message,
    int statusCode = 200,
  }) {
    return models.NetworkResponse<T>(
      requestId: _generateRequestId(),
      statusCode: statusCode,
      data: data,
      message: message,
      isSuccess: true,
      timestamp: DateTime.now(),
    );
  }

  /// Create error response
  models.NetworkResponse<T> _createErrorResponse<T>({
    required String message,
    int statusCode = 500,
    String? errorCode,
  }) {
    return models.NetworkResponse<T>(
      requestId: _generateRequestId(),
      statusCode: statusCode,
      message: message,
      errorCode: errorCode,
      isSuccess: false,
      timestamp: DateTime.now(),
    );
  }

  /// Generic API call wrapper that handles offline mode and error handling
  Future<models.NetworkResponse<T>> _apiCall<T>({
    required String operationName,
    required T Function() offlineDataProvider,
    required Future<models.NetworkResponse<T>> Function() onlineApiCall,
    String? offlineMessage,
  }) async {
    if (_shouldUseOfflineMode()) {
      debugPrint('WuyApiCenter: Using fake data for $operationName (offline mode)');
      final data = offlineDataProvider();
      return Future.value(_createSuccessResponse(
        data: data,
        message: offlineMessage ?? '$operationName successful (offline mode)',
      ));
    }

    try {
      return await onlineApiCall();
    } catch (e) {
      return Future.value(_createErrorResponse(
        message: '$operationName failed: ${e.toString()}',
        statusCode: 500,
      ));
    }
  }

  /// Generic POST API call wrapper
  Future<models.NetworkResponse<T>> _postApiCall<T>({
    required String endpoint,
    required Map<String, dynamic> data,
    required T Function() offlineDataProvider,
    required String operationName,
    String? offlineMessage,
  }) async {
    return _apiCall<T>(
      operationName: operationName,
      offlineDataProvider: offlineDataProvider,
      onlineApiCall: () async {
        final response = await post<T>(endpoint, data: data);
        return models.NetworkResponse<T>(
          requestId: _generateRequestId(),
          statusCode: response.statusCode ?? 200,
          data: response.data,
          message: response.message,
          error: response.error != null ? models.NetworkError.server(
            statusCode: response.statusCode ?? 500,
            message: response.error!,
          ) : null,
          headers: response.headers,
          isSuccess: response.isSuccess,
          isFromCache: response.isFromCache,
          timestamp: response.timestamp,
          duration: response.latency,
          metadata: response.metadata,
        );
      },
      offlineMessage: offlineMessage,
    );
  }

  /// Generic GET API call wrapper
  Future<models.NetworkResponse<T>> _getApiCall<T>({
    required String endpoint,
    required T Function() offlineDataProvider,
    required String operationName,
    String? offlineMessage,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _apiCall<T>(
      operationName: operationName,
      offlineDataProvider: offlineDataProvider,
      onlineApiCall: () async {
        final response = await get<T>(endpoint, queryParameters: queryParameters);
        return models.NetworkResponse<T>(
          requestId: _generateRequestId(),
          statusCode: response.statusCode ?? 200,
          data: response.data,
          message: response.message,
          error: response.error != null ? models.NetworkError.server(
            statusCode: response.statusCode ?? 500,
            message: response.error!,
          ) : null,
          headers: response.headers,
          isSuccess: response.isSuccess,
          isFromCache: response.isFromCache,
          timestamp: response.timestamp,
          duration: response.latency,
          metadata: response.metadata,
        );
      },
      offlineMessage: offlineMessage,
    );
  }

  /// Generic PUT API call wrapper
  Future<models.NetworkResponse<T>> _putApiCall<T>({
    required String endpoint,
    required Map<String, dynamic> data,
    required T Function() offlineDataProvider,
    required String operationName,
    String? offlineMessage,
  }) async {
    return _apiCall<T>(
      operationName: operationName,
      offlineDataProvider: offlineDataProvider,
      onlineApiCall: () async {
        final response = await put<T>(endpoint, data: data);
        return models.NetworkResponse<T>(
          requestId: _generateRequestId(),
          statusCode: response.statusCode ?? 200,
          data: response.data,
          message: response.message,
          error: response.error != null ? models.NetworkError.server(
            statusCode: response.statusCode ?? 500,
            message: response.error!,
          ) : null,
          headers: response.headers,
          isSuccess: response.isSuccess,
          isFromCache: response.isFromCache,
          timestamp: response.timestamp,
          duration: response.latency,
          metadata: response.metadata,
        );
      },
      offlineMessage: offlineMessage,
    );
  }

  /// Generic DELETE API call wrapper
  Future<models.NetworkResponse<T>> _deleteApiCall<T>({
    required String endpoint,
    required T Function() offlineDataProvider,
    required String operationName,
    String? offlineMessage,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _apiCall<T>(
      operationName: operationName,
      offlineDataProvider: offlineDataProvider,
      onlineApiCall: () async {
        final response = await delete<T>(endpoint, queryParameters: queryParameters);
        return models.NetworkResponse<T>(
          requestId: _generateRequestId(),
          statusCode: response.statusCode ?? 200,
          data: response.data,
          message: response.message,
          error: response.error != null ? models.NetworkError.server(
            statusCode: response.statusCode ?? 500,
            message: response.error!,
          ) : null,
          headers: response.headers,
          isSuccess: response.isSuccess,
          isFromCache: response.isFromCache,
          timestamp: response.timestamp,
          duration: response.latency,
          metadata: response.metadata,
        );
      },
      offlineMessage: offlineMessage,
    );
  }

  // Authentication APIs

  /// Login user
  Future<models.NetworkResponse<Map<String, dynamic>>> login({
    required String email,
    required String password,
  }) async {
    return _postApiCall<Map<String, dynamic>>(
      endpoint: 'auth/login',
      data: {
        'email': email,
        'password': password,
      },
      offlineDataProvider: () {
        final fakeUser = UserModelAppWuy(
          id: '1',
          username: 'test_user',
          email: email,
          nickname: 'Test User',
          avatar: 'https://via.placeholder.com/100',
          phone: '+1234567890',
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );
        return {
          'user': fakeUser.toJson(),
          'token': 'fake_jwt_token_${DateTime.now().millisecondsSinceEpoch}',
        };
      },
      operationName: 'Login',
    );
  }

  /// Register user
  Future<models.NetworkResponse<Map<String, dynamic>>> register({
    required String username,
    required String email,
    required String password,
    required String confirmPassword,
  }) async {
    return _postApiCall<Map<String, dynamic>>(
      endpoint: 'auth/register',
      data: {
        'username': username,
        'email': email,
        'password': password,
        'confirm_password': confirmPassword,
      },
      offlineDataProvider: () {
        final fakeUser = UserModelAppWuy(
          id: '2',
          username: username,
          email: email,
          nickname: username,
          avatar: 'https://via.placeholder.com/100',
          phone: '+1234567890',
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );
        return {
          'user': fakeUser.toJson(),
          'token': 'fake_jwt_token_${DateTime.now().millisecondsSinceEpoch}',
        };
      },
      operationName: 'Registration',
    );
  }

  /// Logout user
  Future<models.NetworkResponse<Map<String, dynamic>>> logout() async {
    return _postApiCall<Map<String, dynamic>>(
      endpoint: 'auth/logout',
      data: {},
      offlineDataProvider: () => {'message': 'Logged out successfully'},
      operationName: 'Logout',
    );
  }

  // User APIs

  /// Get user profile
  Future<models.NetworkResponse<UserModelAppWuy>> getUserProfile() async {
    return _getApiCall<UserModelAppWuy>(
      endpoint: 'user/profile',
      offlineDataProvider: () => UserModelAppWuy(
        id: '1',
        username: 'test_user',
        email: 'test@example.com',
        nickname: 'Test User',
        avatar: 'https://via.placeholder.com/100',
        phone: '+1234567890',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
      operationName: 'Get user profile',
    );
  }

  /// Update user profile
  Future<models.NetworkResponse<UserModelAppWuy>> updateUserProfile({
    required String nickname,
    String? avatar,
    String? phone,
  }) async {
    return _putApiCall<UserModelAppWuy>(
      endpoint: 'user/profile',
      data: {
        'nickname': nickname,
        'avatar': avatar,
        'phone': phone,
      },
      offlineDataProvider: () => UserModelAppWuy(
        id: '1',
        username: 'test_user',
        email: 'test@example.com',
        nickname: nickname,
        avatar: avatar ?? 'https://via.placeholder.com/100',
        phone: phone ?? '+1234567890',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
      operationName: 'Update user profile',
    );
  }

  // Friend APIs

  /// Get friends list
  Future<models.NetworkResponse<List<FriendModelAppWuy>>> getFriends() async {
    return _getApiCall<List<FriendModelAppWuy>>(
      endpoint: 'friend/list',
      offlineDataProvider: () => [
        FriendModelAppWuy(
          id: '1',
          username: 'friend1',
          displayName: 'Friend One',
          avatarUrl: 'https://via.placeholder.com/100',
          isOnline: true,
          lastSeen: DateTime.now(),
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        ),
        FriendModelAppWuy(
          id: '2',
          username: 'friend2',
          displayName: 'Friend Two',
          avatarUrl: 'https://via.placeholder.com/100',
          isOnline: false,
          lastSeen: DateTime.now().subtract(const Duration(hours: 2)),
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        ),
      ],
      operationName: 'Get friends list',
    );
  }

  /// Add a friend
  Future<models.NetworkResponse<FriendModelAppWuy>> addFriend({
    required String username,
  }) async {
    return _postApiCall<FriendModelAppWuy>(
      endpoint: 'friend/add',
      data: {'username': username},
      offlineDataProvider: () => FriendModelAppWuy(
        id: '3',
        username: username,
        displayName: username,
        avatarUrl: 'https://via.placeholder.com/100',
        isOnline: true,
        lastSeen: DateTime.now(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
      operationName: 'Add friend',
    );
  }

  /// Get friend info
  Future<models.NetworkResponse<FriendModelAppWuy>> getFriendInfo({
    required String friendId,
  }) async {
    return _getApiCall<FriendModelAppWuy>(
      endpoint: 'friend/info',
      queryParameters: {'id': friendId},
      offlineDataProvider: () => FriendModelAppWuy(
        id: friendId,
        username: 'friend_$friendId',
        displayName: 'Friend $friendId',
        avatarUrl: 'https://via.placeholder.com/100',
        isOnline: true,
        lastSeen: DateTime.now(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
      operationName: 'Get friend info',
    );
  }

  /// Remove a friend
  Future<models.NetworkResponse<Map<String, dynamic>>> removeFriend({
    required String friendId,
  }) async {
    return _deleteApiCall<Map<String, dynamic>>(
      endpoint: 'friend/remove',
      queryParameters: {'id': friendId},
      offlineDataProvider: () => {'message': 'Friend removed successfully'},
      operationName: 'Remove friend',
    );
  }

  // Chat APIs

  /// Get chat history
  Future<models.NetworkResponse<List<ChatMessageModelAppWuy>>> getChatHistory({
    required String friendId,
  }) async {
    return _getApiCall<List<ChatMessageModelAppWuy>>(
      endpoint: 'chat/history/$friendId',
      offlineDataProvider: () => [
        ChatMessageModelAppWuy(
          id: 'msg1',
          chatId: 'chat_$friendId',
          senderId: friendId,
          receiverId: 'current_user',
          content: 'Hello from friend $friendId!',
          messageType: 'text',
          isRead: true,
          createdAt: DateTime.now().subtract(const Duration(minutes: 10)),
        ),
        ChatMessageModelAppWuy(
          id: 'msg2',
          chatId: 'chat_$friendId',
          senderId: 'current_user',
          receiverId: friendId,
          content: 'Hi there!',
          messageType: 'text',
          isRead: false,
          createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
        ),
      ],
      operationName: 'Get chat history',
    );
  }

  /// Send message
  Future<models.NetworkResponse<ChatMessageModelAppWuy>> sendMessage({
    required String chatId,
    required String receiverId,
    required String content,
    String messageType = 'text',
  }) async {
    return _postApiCall<ChatMessageModelAppWuy>(
      endpoint: 'chat/send',
      data: {
        'chat_id': chatId,
        'receiver_id': receiverId,
        'content': content,
        'message_type': messageType,
      },
      offlineDataProvider: () => ChatMessageModelAppWuy(
        id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
        chatId: chatId,
        senderId: 'current_user',
        receiverId: receiverId,
        content: content,
        messageType: messageType,
        isRead: false,
        createdAt: DateTime.now(),
      ),
      operationName: 'Send message',
    );
  }

  /// Delete message
  Future<models.NetworkResponse<Map<String, dynamic>>> deleteMessage({
    required String messageId,
  }) async {
    return _deleteApiCall<Map<String, dynamic>>(
      endpoint: 'chat/delete/$messageId',
      offlineDataProvider: () => {'message': 'Message deleted successfully'},
      operationName: 'Delete message',
    );
  }

  /// Mark message as read
  Future<models.NetworkResponse<Map<String, dynamic>>> markAsRead({
    required String messageId,
  }) async {
    return _putApiCall<Map<String, dynamic>>(
      endpoint: 'chat/read/$messageId',
      data: {},
      offlineDataProvider: () => {'message': 'Message marked as read successfully'},
      operationName: 'Mark message as read',
    );
  }

  // Location APIs

  /// Get user location
  Future<models.NetworkResponse<LocationModelAppWuy>> getUserLocation() async {
    return _getApiCall<LocationModelAppWuy>(
      endpoint: 'location/current',
      offlineDataProvider: () => LocationModelAppWuy(
        id: 'loc1',
        userId: 'current_user',
        latitude: 39.9042,
        longitude: 116.4074,
        address: 'Beijing, China',
        timestamp: DateTime.now(),
      ),
      operationName: 'Get user location',
    );
  }

  /// Update user location
  Future<models.NetworkResponse<LocationModelAppWuy>> updateUserLocation({
    required double latitude,
    required double longitude,
    String? address,
  }) async {
    return _postApiCall<LocationModelAppWuy>(
      endpoint: 'location/update',
      data: {
        'latitude': latitude,
        'longitude': longitude,
        'address': address,
      },
      offlineDataProvider: () => LocationModelAppWuy(
        id: 'loc1',
        userId: 'current_user',
        latitude: latitude,
        longitude: longitude,
        address: address ?? 'Unknown Address',
        timestamp: DateTime.now(),
      ),
      operationName: 'Update user location',
    );
  }

  // Device APIs

  /// Register device
  Future<models.NetworkResponse<Map<String, dynamic>>> registerDevice({
    required String deviceToken,
    required String deviceType,
  }) async {
    return _postApiCall<Map<String, dynamic>>(
      endpoint: 'device/register',
      data: {
        'device_token': deviceToken,
        'device_type': deviceType,
      },
      offlineDataProvider: () => {'message': 'Device registered successfully'},
      operationName: 'Register device',
    );
  }

  /// Unregister device
  Future<models.NetworkResponse<Map<String, dynamic>>> unregisterDevice({
    required String deviceToken,
  }) async {
    return _deleteApiCall<Map<String, dynamic>>(
      endpoint: 'device/unregister',
      queryParameters: {'device_token': deviceToken},
      offlineDataProvider: () => {'message': 'Device unregistered successfully'},
      operationName: 'Unregister device',
    );
  }

  /// Get device list
  Future<models.NetworkResponse<List<Map<String, dynamic>>>> getDeviceList() async {
    return _getApiCall<List<Map<String, dynamic>>>(
      endpoint: 'device/list',
      offlineDataProvider: () => [
        {
          'id': 'dev1',
          'device_token': 'token1',
          'device_type': 'android',
          'last_used': DateTime.now().toIso8601String(),
        },
        {
          'id': 'dev2',
          'device_token': 'token2',
          'device_type': 'ios',
          'last_used': DateTime.now().subtract(const Duration(days: 1)).toIso8601String(),
        },
      ],
      operationName: 'Get device list',
    );
  }

  /// Update device
  Future<models.NetworkResponse<Map<String, dynamic>>> updateDevice({
    required String deviceId,
    String? deviceToken,
    String? deviceType,
  }) async {
    return _putApiCall<Map<String, dynamic>>(
      endpoint: 'device/update',
      data: {
        'device_id': deviceId,
        'device_token': deviceToken,
        'device_type': deviceType,
      },
      offlineDataProvider: () => {'message': 'Device updated successfully'},
      operationName: 'Update device',
    );
  }
}