# AChat API类库编码计划 - 基于Common通用类库扩展

## 概述

本文档详细描述了AChat企业通信应用的API类库编码计划，基于分析Flutter Bloom项目结构，正确利用上级common通用类库作为基础，通过导入和扩展的方式实现AChat特定功能。

## 1. 项目结构关系分析

### 1.1 目录层级关系
```
D:\programing\core_node\poly_apps\flutter_bloom\lib\
├── common\                           # 上级通用类库（基础设施）
│   ├── controller\                   # 基础控制器（认证等）
│   ├── network\                      # 网络层（ApiClient, 拦截器等）
│   ├── storage\                      # 存储管理（StorageManager）
│   ├── database\                     # 数据库抽象层
│   ├── theme\                        # 主题系统
│   ├── localization\                 # 国际化
│   ├── settings\                     # 设置框架
│   ├── provider_status\              # 状态管理提供者
│   └── utils\                        # 工具类
└── apps\
    └── app_achat\                    # AChat应用（使用common类库）
        ├── controller_app_achat\     # AChat特定控制器
        ├── services_app_achat\       # AChat服务层（扩展common）
        ├── features_app_achat\       # AChat功能模块
        ├── models_app_achat\         # AChat数据模型
        ├── repositories_app_achat\   # AChat仓库层
        ├── settings_app_achat\       # AChat设置
        └── docs\                     # AChat文档
```

### 1.2 导入路径规范
从app_achat到common的正确导入路径：
```dart
// 从 apps/app_achat/ 导入 common/
import '../../../common/[模块]/[文件].dart';

// 示例：
import '../../../common/network/api_client.dart';
import '../../../common/storage/storage_manager.dart';
import '../../../common/controller/auth_controller.dart';
import '../../../common/settings/models/setting_item.dart';
```

## 2. Common通用类库能力评估

### 2.1 ✅ 现有强项（直接利用）

#### 网络层基础设施
- **ApiClient**: 完整的HTTP客户端实现
- **认证集成**: 基于BaseUserProvider的Token自动管理
- **多路请求**: 支持GET/POST/PUT/DELETE及文件上传
- **后台处理**: 使用isolate进行JSON解析
- **错误处理**: 标准化错误响应处理

#### API响应系统
- **通用响应包装**: `ApiResponse<T>` 成功/错误状态
- **分页支持**: `PaginatedResponse<T>` 列表端点
- **数据转换**: Map操作和验证
- **异常处理**: 自定义`ApiException`状态码

#### 存储架构
- **多层存储**: 基于Hive的存储后端与抽象层
- **Box管理**: 命名空间隔离的存储容器
- **实时更新**: 基于Stream的存储变更通知
- **跨平台**: Web和移动端兼容性

#### 主题与UI系统
- **完整色彩系统**: 10级渐变色彩，系统颜色
- **平台适配**: 桌面、移动、Web特定主题
- **深浅模式**: 自动主题切换
- **自定义组件**: 丰富的UI组件库

#### 配置管理
- **设置框架**: 多种输入类型的通用设置
- **本地化**: 多语言支持与应用特定扩展
- **Provider集成**: 状态管理与上下文注入

### 2.2 ⚠️ 需要扩展的功能

#### 实时通信
- **WebSocket支持**: 无WebSocket客户端实现
- **事件广播**: 无实时事件系统
- **连接管理**: 无自动重连逻辑
- **打字指示器**: 无实时状态更新

#### 高级缓存
- **API响应缓存**: 无HTTP响应缓存策略
- **缓存失效**: 无智能缓存管理
- **离线支持**: 无离线优先架构
- **请求去重**: 无重复请求防护

#### 推送通知
- **推送集成**: 无FCM/APNs集成
- **通知管理**: 无通知历史/状态
- **徽章处理**: 无应用徽章管理
- **后台处理**: 无后台通知处理

#### 安全功能
- **消息加密**: 无端到端加密
- **安全存储**: 无加密本地存储
- **生物识别**: 无生物识别认证
- **会话管理**: 无全面会话处理

## 3. AChat扩展架构设计

### 3.1 服务层扩展结构
```
lib/apps/app_achat/services_app_achat/
├── api/                              # 扩展API层
│   ├── achat_api_client.dart         # 扩展common/ApiClient
│   ├── websocket_client.dart         # 新增WebSocket实现
│   ├── realtime_manager.dart         # 实时事件协调
│   └── cache_manager.dart            # 高级缓存管理
├── services/                         # 领域服务
│   ├── auth_service.dart             # 企业认证服务
│   ├── chat_service.dart             # 聊天管理服务
│   ├── contact_service.dart          # 联系人操作
│   ├── group_service.dart            # 群组管理
│   ├── file_service.dart             # 文件操作
│   ├── notification_service.dart     # 推送通知
│   └── presence_service.dart         # 用户在线状态
├── repositories/                     # 仓库层
│   ├── chat_repository.dart          # 聊天数据管理
│   ├── message_repository.dart       # 消息持久化
│   ├── contact_repository.dart       # 联系人数据
│   └── offline_repository.dart       # 离线支持
├── storage/                          # 扩展存储层
│   ├── achat_storage_manager.dart    # 扩展StorageManager
│   ├── message_storage.dart          # 消息特定存储
│   ├── contact_storage.dart          # 联系人存储
│   └── offline_storage.dart          # 离线队列存储
├── providers/                        # 扩展提供者
│   ├── achat_user_provider.dart      # 扩展BaseUserProvider
│   ├── chat_provider.dart            # 聊天状态管理
│   ├── contact_provider.dart         # 联系人状态管理
│   └── realtime_provider.dart        # 实时事件状态
├── security/                         # 安全组件
│   ├── encryption_service.dart       # 端到端加密
│   ├── key_manager.dart              # 密钥管理
│   └── secure_storage.dart           # 加密存储
└── models/                           # 扩展数据模型
    ├── requests/                     # AChat特定请求
    ├── responses/                    # AChat特定响应
    ├── websocket/                    # 实时事件模型
    └── cache/                        # 缓存特定模型
```

### 3.2 导入依赖关系图
```
AChat Services Layer
    ↓ (导入和扩展)
Common Library Layer
    ↓ (提供基础设施)
Flutter Framework
```

## 4. 核心组件扩展实现

### 4.1 扩展API客户端（基于Common/ApiClient）

```dart
// 导入common基础类
import '../../../common/network/api_client.dart';
import '../../../common/network/models/api_response.dart';
import '../../../common/provider_status/user_provider.dart';

class AChatApiClient extends ApiClient {
  final WebSocketClient _wsClient;
  final CacheManager _cacheManager;
  final EncryptionService _encryption;
  final OfflineManager _offlineManager;

  AChatApiClient({
    required BuildContext context,
    required this._wsClient,
    required this._cacheManager,
    required this._encryption,
    required this._offlineManager,
  }) : super(context: context);

  @override
  Future<Response> getData(String uri, {
    Map<String, dynamic>? query,
    int? timeoutInSeconds,
    bool useCache = true,
  }) async {
    // 1. 先检查缓存（如果启用）
    if (useCache) {
      final cacheKey = _buildCacheKey('GET', uri, query);
      final cachedResponse = await _cacheManager.get(cacheKey);
      if (cachedResponse != null) {
        return cachedResponse;
      }
    }

    try {
      // 2. 调用父类方法（common/ApiClient）
      final response = await super.getData(
        uri,
        query: query,
        timeoutInSeconds: timeoutInSeconds
      );

      // 3. 缓存成功响应
      if (response.statusCode == 200 && useCache) {
        final cacheKey = _buildCacheKey('GET', uri, query);
        await _cacheManager.put(cacheKey, response);
      }

      return response;
    } catch (e) {
      // 4. 处理离线场景
      if (!await _isOnline()) {
        return await _offlineManager.handleOfflineRequest('GET', uri, query: query);
      }
      rethrow;
    }
  }

  @override
  Future<Response> postData(String uri, dynamic body, {
    Map<String, String>? headers,
    int? timeoutInSeconds,
    bool encryptBody = false,
  }) async {
    dynamic processedBody = body;

    // 加密消息体（如果需要）
    if (encryptBody && body != null) {
      processedBody = await _encryption.encrypt(jsonEncode(body));
    }

    try {
      // 调用父类方法
      final response = await super.postData(
        uri,
        processedBody,
        headers: headers,
        timeoutInSeconds: timeoutInSeconds
      );

      // 使缓存失效
      await _cacheManager.invalidatePattern(uri);

      return response;
    } catch (e) {
      // 离线排队处理
      if (!await _isOnline()) {
        await _offlineManager.queueRequest('POST', uri, body: processedBody);
        return Response(statusCode: 202, statusText: 'Queued for offline processing');
      }
      rethrow;
    }
  }

  // WebSocket集成
  Future<void> connectWebSocket() async {
    if (isAuthenticated) {
      await _wsClient.connect(userProvider.token);
    }
  }

  void disconnectWebSocket() {
    _wsClient.disconnect();
  }

  // 实时消息发送
  Future<void> sendRealtimeMessage(String chatId, Map<String, dynamic> message) async {
    _wsClient.sendMessage({
      'type': 'send_message',
      'data': {
        'chat_id': chatId,
        'message': message,
      },
    });
  }

  String _buildCacheKey(String method, String uri, [Map<String, dynamic>? params]) {
    final paramStr = params != null ? jsonEncode(params) : '';
    return '$method:$uri:$paramStr'.hashCode.toString();
  }

  Future<bool> _isOnline() async {
    // 检查网络连接
    return true; // 简化示例
  }
}
```

### 4.2 扩展存储管理（基于Common/StorageManager）

```dart
// 导入common基础类
import '../../../common/storage/storage_manager.dart';
import '../../../common/storage/interfaces/storage_interface.dart';
import '../../../common/storage/models/storage_models.dart';

class AChatStorageManager extends StorageManager {
  // AChat特定的box名称
  static const String _messagesBox = 'achat_messages';
  static const String _conversationsBox = 'achat_conversations';
  static const String _contactsBox = 'achat_contacts';
  static const String _groupsBox = 'achat_groups';
  static const String _settingsBox = 'achat_settings';
  static const String _cacheBox = 'achat_cache';
  static const String _offlineQueueBox = 'achat_offline_queue';

  static AChatStorageManager? _instance;
  static AChatStorageManager get instance => _instance ??= AChatStorageManager._internal();

  AChatStorageManager._internal();

  Future<void> initAChatStorage() async {
    // 使用父类方法初始化
    await init(appName: 'achat', subDirectory: 'enterprise');

    // 打开AChat特定的boxes
    final boxes = [
      _messagesBox, _conversationsBox, _contactsBox, _groupsBox,
      _settingsBox, _cacheBox, _offlineQueueBox
    ];

    for (final box in boxes) {
      await openBox(box); // 调用父类方法
    }
  }

  // 消息存储操作
  Future<void> storeMessage(Message message) async {
    await putValue(_messagesBox, message.id, message.toJson()); // 使用父类方法

    // 更新会话的最后消息
    await _updateConversationLastMessage(message.chatId, message);
  }

  Future<List<Message>> getMessagesForChat(String chatId, {int limit = 50, String? beforeMessageId}) async {
    final allMessages = await getAllFromBox(_messagesBox); // 使用父类方法
    var messages = allMessages.values
        .map((data) => Message.fromJson(data))
        .where((msg) => msg.chatId == chatId)
        .toList();

    // 按时间戳排序
    messages.sort((a, b) => b.timestamp.compareTo(a.timestamp));

    // 应用分页
    if (beforeMessageId != null) {
      final beforeIndex = messages.indexWhere((msg) => msg.id == beforeMessageId);
      if (beforeIndex != -1) {
        messages = messages.skip(beforeIndex + 1).toList();
      }
    }

    return messages.take(limit).toList();
  }

  // 会话存储操作
  Future<void> storeConversation(Conversation conversation) async {
    await putValue(_conversationsBox, conversation.id, conversation.toJson());
  }

  Future<List<Conversation>> getAllConversations() async {
    final conversationsData = await getAllFromBox(_conversationsBox);
    var conversations = conversationsData.values
        .map((data) => Conversation.fromJson(data))
        .toList();

    // 按最后活动时间排序
    conversations.sort((a, b) => b.lastActivity.compareTo(a.lastActivity));
    return conversations;
  }

  // 联系人存储操作
  Future<void> storeContact(Contact contact) async {
    await putValue(_contactsBox, contact.id, contact.toJson());
  }

  Future<List<Contact>> searchContacts(String query) async {
    final contacts = await getAllContacts();
    final lowercaseQuery = query.toLowerCase();

    return contacts.where((contact) =>
      contact.name.toLowerCase().contains(lowercaseQuery) ||
      contact.email.toLowerCase().contains(lowercaseQuery) ||
      contact.department.toLowerCase().contains(lowercaseQuery)
    ).toList();
  }

  // 缓存管理
  Future<void> cacheResponse(String key, Response response, {DateTime? expiresAt}) async {
    final cacheEntry = {
      'response': {
        'body': response.body,
        'statusCode': response.statusCode,
        'headers': response.headers,
      },
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'expiresAt': expiresAt?.millisecondsSinceEpoch,
    };
    await putValue(_cacheBox, key, cacheEntry);
  }

  Future<Response?> getCachedResponse(String key) async {
    final cacheEntry = await getValue(_cacheBox, key);
    if (cacheEntry == null) return null;

    final expiresAt = cacheEntry['expiresAt'] as int?;
    if (expiresAt != null && DateTime.now().millisecondsSinceEpoch > expiresAt) {
      await deleteKey(_cacheBox, key);
      return null;
    }

    final responseData = cacheEntry['response'];
    return Response(
      body: responseData['body'],
      statusCode: responseData['statusCode'],
      headers: Map<String, String>.from(responseData['headers'] ?? {}),
    );
  }

  // 离线队列管理
  Future<void> queueOfflineRequest(OfflineRequest request) async {
    final requestId = DateTime.now().millisecondsSinceEpoch.toString();
    await putValue(_offlineQueueBox, requestId, request.toJson());
  }

  Future<List<OfflineRequest>> getOfflineQueue() async {
    final queueData = await getAllFromBox(_offlineQueueBox);
    return queueData.values
        .map((data) => OfflineRequest.fromJson(data))
        .toList();
  }

  // 数据清理
  Future<void> cleanupOldData({Duration maxAge = const Duration(days: 30)}) async {
    final cutoffTime = DateTime.now().subtract(maxAge);

    // 清理旧消息
    final allMessages = await getAllFromBox(_messagesBox);
    for (final entry in allMessages.entries) {
      final message = Message.fromJson(entry.value);
      if (message.timestamp.isBefore(cutoffTime)) {
        await deleteKey(_messagesBox, entry.key);
      }
    }

    // 清理旧缓存
    final allCache = await getAllFromBox(_cacheBox);
    for (final entry in allCache.entries) {
      final cacheEntry = entry.value;
      final timestamp = DateTime.fromMillisecondsSinceEpoch(cacheEntry['timestamp']);
      if (timestamp.isBefore(cutoffTime)) {
        await deleteKey(_cacheBox, entry.key);
      }
    }
  }

  Future<void> _updateConversationLastMessage(String chatId, Message message) async {
    final conversationData = await getValue(_conversationsBox, chatId);
    if (conversationData != null) {
      final conversation = Conversation.fromJson(conversationData);
      final updatedConversation = conversation.copyWith(
        lastMessage: message,
        lastActivity: message.timestamp,
      );
      await storeConversation(updatedConversation);
    }
  }
}
```

### 4.3 扩展用户提供者（基于Common/BaseUserProvider）

```dart
// 导入common基础类
import '../../../common/provider_status/user_provider.dart';

class AChatUserProvider extends BaseUserProvider {
  final AChatApiClient _apiClient;
  final WebSocketClient _wsClient;
  final AChatStorageManager _storage;
  final RealtimeManager _realtimeManager;

  // AChat特定状态
  UserPresence? _userPresence;
  List<Contact> _contacts = [];
  List<Conversation> _conversations = [];
  int _unreadMessagesCount = 0;
  bool _isWebSocketConnected = false;
  Map<String, List<String>> _typingUsers = {};

  // Getters
  UserPresence? get userPresence => _userPresence;
  List<Contact> get contacts => List.unmodifiable(_contacts);
  List<Conversation> get conversations => List.unmodifiable(_conversations);
  int get unreadMessagesCount => _unreadMessagesCount;
  bool get isWebSocketConnected => _isWebSocketConnected;

  AChatUserProvider({
    required this._apiClient,
    required this._wsClient,
    required this._storage,
    required this._realtimeManager,
  }) {
    _setupRealtimeListeners();
  }

  void _setupRealtimeListeners() {
    _wsClient.events.listen((event) {
      switch (event.type) {
        case 'connected':
          _isWebSocketConnected = true;
          notifyListeners();
          break;
        case 'disconnected':
          _isWebSocketConnected = false;
          notifyListeners();
          break;
      }
    });

    _realtimeManager.events.listen((event) {
      _handleRealtimeEvent(event);
    });
  }

  @override
  Future<bool> login(String email, String password, {String? deviceId}) async {
    // 调用父类登录方法
    final success = await super.login(email, password);

    if (success) {
      await _initializeAChatData();
      await _apiClient.connectWebSocket();
      await _loadInitialData();
    }

    return success;
  }

  Future<void> _initializeAChatData() async {
    await _storage.initAChatStorage();
  }

  Future<void> _loadInitialData() async {
    await Future.wait([
      _loadContacts(),
      _loadConversations(),
      _loadUserPresence(),
      _calculateUnreadCount(),
    ]);
  }

  Future<void> _loadContacts() async {
    try {
      // 先从缓存加载
      _contacts = await _storage.getAllContacts();
      notifyListeners();

      // 获取新数据
      final response = await _apiClient.getData('/contacts');
      if (response.statusCode == 200) {
        final freshContacts = (response.body['data'] as List)
            .map((data) => Contact.fromJson(data))
            .toList();

        // 更新存储
        for (final contact in freshContacts) {
          await _storage.storeContact(contact);
        }

        _contacts = freshContacts;
        notifyListeners();
      }
    } catch (e) {
      print('Error loading contacts: $e');
    }
  }

  // 更新用户在线状态
  Future<void> updatePresence(UserPresenceStatus status, {String? message}) async {
    try {
      final response = await _apiClient.putData('/user/presence', {
        'status': status.name,
        'message': message,
      });

      if (response.statusCode == 200) {
        _userPresence = UserPresence.fromJson(response.body['data']);
        notifyListeners();
      }
    } catch (e) {
      print('Error updating presence: $e');
    }
  }

  // 搜索联系人
  Future<List<Contact>> searchContacts(String query) async {
    if (query.isEmpty) return _contacts;

    // 先本地搜索
    final localResults = await _storage.searchContacts(query);

    // 如果有好的本地结果，返回它们
    if (localResults.isNotEmpty) {
      return localResults;
    }

    // 否则，远程搜索
    try {
      final response = await _apiClient.getData('/contacts/search', query: {'q': query});
      if (response.statusCode == 200) {
        return (response.body['data'] as List)
            .map((data) => Contact.fromJson(data))
            .toList();
      }
    } catch (e) {
      print('Error searching contacts: $e');
    }

    return [];
  }

  // 处理实时事件
  void _handleRealtimeEvent(RealtimeEvent event) {
    switch (event.type) {
      case RealtimeEventType.messageReceived:
        _handleNewMessage(event.data as Message);
        break;
      case RealtimeEventType.userTyping:
        _handleTypingIndicator(event.data as TypingEvent);
        break;
      case RealtimeEventType.conversationUpdated:
        _handleConversationUpdated(event.data as Conversation);
        break;
    }
  }

  void _handleNewMessage(Message message) {
    // 本地存储消息
    _storage.storeMessage(message);

    // 更新会话
    final conversationIndex = _conversations.indexWhere((c) => c.id == message.chatId);
    if (conversationIndex != -1) {
      final updatedConversation = _conversations[conversationIndex].copyWith(
        lastMessage: message,
        lastActivity: message.timestamp,
        unreadCount: _conversations[conversationIndex].unreadCount + 1,
      );

      _conversations[conversationIndex] = updatedConversation;
      _storage.storeConversation(updatedConversation);
    }

    // 更新未读计数
    _unreadMessagesCount++;
    notifyListeners();
  }

  // 标记会话为已读
  Future<void> markConversationAsRead(String conversationId) async {
    try {
      await _apiClient.postData('/chats/$conversationId/mark-read', {});

      // 更新本地会话
      final index = _conversations.indexWhere((c) => c.id == conversationId);
      if (index != -1) {
        final oldUnreadCount = _conversations[index].unreadCount;
        final updatedConversation = _conversations[index].copyWith(unreadCount: 0);
        _conversations[index] = updatedConversation;

        // 更新存储
        await _storage.storeConversation(updatedConversation);

        // 更新总未读计数
        _unreadMessagesCount -= oldUnreadCount;
        notifyListeners();
      }
    } catch (e) {
      print('Error marking conversation as read: $e');
    }
  }

  @override
  Future<void> logout() async {
    _apiClient.disconnectWebSocket();

    // 清除本地状态
    _userPresence = null;
    _contacts.clear();
    _conversations.clear();
    _unreadMessagesCount = 0;
    _isWebSocketConnected = false;
    _typingUsers.clear();

    // 调用父类登出方法
    await super.logout();
  }
}
```

## 5. WebSocket集成实现

### 5.1 WebSocket客户端

```dart
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:web_socket_channel/web_socket_channel.dart';

class WebSocketClient {
  static const String _baseUrl = 'wss://api.achat.enterprise.com/v1/ws';

  WebSocketChannel? _channel;
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;
  bool _isConnected = false;
  String? _authToken;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;

  final StreamController<WebSocketEvent> _eventController =
      StreamController<WebSocketEvent>.broadcast();
  final Queue<Map<String, dynamic>> _messageQueue = Queue<Map<String, dynamic>>();

  Stream<WebSocketEvent> get events => _eventController.stream;
  bool get isConnected => _isConnected;

  Future<void> connect(String? token) async {
    if (token == null) throw Exception('Authentication token required');

    _authToken = token;
    await _establishConnection();
  }

  Future<void> _establishConnection() async {
    try {
      final uri = Uri.parse('$_baseUrl?token=$_authToken');
      _channel = WebSocketChannel.connect(uri);

      _channel!.stream.listen(
        _handleMessage,
        onError: _handleError,
        onDone: _handleDisconnection,
      );

      _isConnected = true;
      _reconnectAttempts = 0;
      _startHeartbeat();
      _processQueuedMessages();

      _eventController.add(WebSocketEvent.connected());
    } catch (e) {
      _handleError(e);
    }
  }

  void _handleMessage(dynamic data) {
    try {
      final message = jsonDecode(data as String);

      // 处理心跳响应
      if (message['type'] == 'pong') {
        return;
      }

      final event = WebSocketEvent.fromJson(message);
      _eventController.add(event);
    } catch (e) {
      print('Error parsing WebSocket message: $e');
    }
  }

  void _handleError(dynamic error) {
    print('WebSocket error: $error');
    _isConnected = false;
    _eventController.add(WebSocketEvent.error(error.toString()));
    _scheduleReconnect();
  }

  void _handleDisconnection() {
    _isConnected = false;
    _heartbeatTimer?.cancel();
    _eventController.add(WebSocketEvent.disconnected());
    _scheduleReconnect();
  }

  void _startHeartbeat() {
    _heartbeatTimer = Timer.periodic(Duration(seconds: 30), (timer) {
      if (_isConnected) {
        sendMessage({
          'type': 'ping',
          'timestamp': DateTime.now().toIso8601String(),
        });
      }
    });
  }

  void _scheduleReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      _eventController.add(WebSocketEvent.reconnectFailed());
      return;
    }

    _reconnectTimer?.cancel();
    final delay = Duration(seconds: math.pow(2, _reconnectAttempts).toInt().clamp(1, 30));

    _reconnectTimer = Timer(delay, () {
      if (!_isConnected && _authToken != null) {
        _reconnectAttempts++;
        _establishConnection();
      }
    });
  }

  void sendMessage(Map<String, dynamic> message) {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(jsonEncode(message));
    } else {
      // 消息排队，连接恢复时发送
      _messageQueue.add(message);
    }
  }

  void _processQueuedMessages() {
    while (_messageQueue.isNotEmpty && _isConnected) {
      final message = _messageQueue.removeFirst();
      sendMessage(message);
    }
  }

  void disconnect() {
    _heartbeatTimer?.cancel();
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _isConnected = false;
  }
}
```

## 6. 多级缓存系统

### 6.1 缓存管理器

```dart
class CacheManager {
  final AChatStorageManager _storage;
  final Map<String, CacheEntry> _memoryCache = {};
  final Map<String, DateTime> _lastFetch = {};

  static const Duration _defaultTTL = Duration(minutes: 15);
  static const Duration _maxStaleTime = Duration(hours: 24);

  CacheManager(this._storage);

  Future<Response?> get(String key) async {
    // 级别1：内存缓存
    final memoryEntry = _memoryCache[key];
    if (memoryEntry != null && !memoryEntry.isExpired) {
      return memoryEntry.response;
    }

    // 级别2：持久缓存
    final persistentResponse = await _storage.getCachedResponse(key);
    if (persistentResponse != null) {
      final cacheEntry = CacheEntry(persistentResponse, DateTime.now().add(_defaultTTL));
      _memoryCache[key] = cacheEntry;
      return persistentResponse;
    }

    return null;
  }

  Future<void> put(String key, Response response, {Duration? ttl}) async {
    final effectiveTTL = ttl ?? _defaultTTL;
    final expiresAt = DateTime.now().add(effectiveTTL);

    // 存储到内存缓存
    _memoryCache[key] = CacheEntry(response, expiresAt);

    // 存储到持久缓存
    await _storage.cacheResponse(key, response, expiresAt: expiresAt);

    // 跟踪获取时间
    _lastFetch[key] = DateTime.now();
  }

  Future<Response> getOrFetch(
    String key,
    Future<Response> Function() fetcher, {
    Duration? ttl,
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh) {
      final cached = await get(key);
      if (cached != null) {
        // 检查是否应该后台刷新
        final lastFetchTime = _lastFetch[key];
        if (lastFetchTime != null &&
            DateTime.now().difference(lastFetchTime) > Duration(minutes: 5)) {
          // 后台刷新
          _refreshInBackground(key, fetcher, ttl: ttl);
        }
        return cached;
      }
    }

    // 获取新数据
    final response = await fetcher();
    await put(key, response, ttl: ttl);
    return response;
  }

  void _refreshInBackground(String key, Future<Response> Function() fetcher, {Duration? ttl}) {
    fetcher().then((response) {
      put(key, response, ttl: ttl);
    }).catchError((error) {
      print('Background refresh failed for $key: $error');
    });
  }

  Future<void> invalidate(String key) async {
    _memoryCache.remove(key);
    _lastFetch.remove(key);
    await _storage.deleteCachedResponse(key);
  }

  Future<void> invalidatePattern(String pattern) async {
    // 从内存缓存移除
    _memoryCache.removeWhere((key, _) => key.contains(pattern));
    _lastFetch.removeWhere((key, _) => key.contains(pattern));

    // 从持久缓存移除
    await _storage.deleteCachedResponsesByPattern(pattern);
  }

  void clearMemoryCache() {
    _memoryCache.clear();
  }

  Future<void> clearAllCache() async {
    _memoryCache.clear();
    _lastFetch.clear();
    await _storage.clearAllCachedResponses();
  }
}

class CacheEntry {
  final Response response;
  final DateTime expiresAt;

  CacheEntry(this.response, this.expiresAt);

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}
```

## 7. 实时事件管理

### 7.1 实时管理器

```dart
class RealtimeManager {
  final WebSocketClient _wsClient;
  final AChatStorageManager _storage;
  final StreamController<RealtimeEvent> _eventController =
      StreamController<RealtimeEvent>.broadcast();

  Stream<RealtimeEvent> get events => _eventController.stream;

  RealtimeManager(this._wsClient, this._storage) {
    _wsClient.events.listen(_handleWebSocketEvent);
  }

  void _handleWebSocketEvent(WebSocketEvent event) {
    switch (event.type) {
      case 'message_received':
        _handleMessageReceived(event.data);
        break;
      case 'message_updated':
        _handleMessageUpdated(event.data);
        break;
      case 'user_typing':
        _handleUserTyping(event.data);
        break;
      case 'user_presence_changed':
        _handleUserPresenceChanged(event.data);
        break;
      case 'conversation_updated':
        _handleConversationUpdated(event.data);
        break;
    }
  }

  void _handleMessageReceived(Map<String, dynamic> data) {
    final message = Message.fromJson(data['message']);
    _eventController.add(RealtimeEvent(
      type: RealtimeEventType.messageReceived,
      data: message,
    ));
  }

  void _handleUserTyping(Map<String, dynamic> data) {
    final typingEvent = TypingEvent.fromJson(data);
    _eventController.add(RealtimeEvent(
      type: RealtimeEventType.userTyping,
      data: typingEvent,
    ));
  }

  // 发送打字指示器
  void sendTypingIndicator(String chatId, bool isTyping) {
    _wsClient.sendMessage({
      'type': 'user_typing',
      'data': {
        'chat_id': chatId,
        'is_typing': isTyping,
      },
    });
  }

  // 发送在线状态更新
  void sendPresenceUpdate(UserPresenceStatus status, {String? message}) {
    _wsClient.sendMessage({
      'type': 'presence_update',
      'data': {
        'status': status.name,
        'message': message,
      },
    });
  }

  // 加入聊天室进行实时更新
  void joinChatRoom(String chatId) {
    _wsClient.sendMessage({
      'type': 'join_room',
      'data': {
        'room_id': 'chat_$chatId',
      },
    });
  }

  void dispose() {
    _eventController.close();
  }
}
```

## 8. 设置集成（基于Common设置框架）

### 8.1 AChat设置配置

```dart
// 导入common设置框架
import '../../../common/settings/models/setting_item.dart';

class AChatAppSettings {
  static List<SettingItem> getAChatSettings() {
    return [
      // 通知设置
      SettingItem.toggle(
        key: 'achat_push_notifications',
        title: '推送通知',
        description: '接收新消息推送通知',
        defaultValue: true,
        group: '通知',
      ),

      SettingItem.toggle(
        key: 'achat_sound_notifications',
        title: '声音通知',
        description: '新消息时播放提示音',
        defaultValue: true,
        group: '通知',
      ),

      SettingItem.select(
        key: 'achat_notification_sound',
        title: '通知铃声',
        description: '选择消息通知铃声',
        options: ['默认', '简单', '悦耳', '振奋'],
        defaultValue: '默认',
        group: '通知',
      ),

      // 隐私设置
      SettingItem.select(
        key: 'achat_last_seen_visibility',
        title: '最后在线时间可见性',
        description: '谁可以看到您的最后在线时间',
        options: ['所有人', '联系人', '无人'],
        defaultValue: '联系人',
        group: '隐私',
      ),

      SettingItem.toggle(
        key: 'achat_read_receipts',
        title: '阅读回执',
        description: '发送和接收消息阅读状态',
        defaultValue: true,
        group: '隐私',
      ),

      SettingItem.toggle(
        key: 'achat_typing_indicators',
        title: '打字指示器',
        description: '显示正在输入状态',
        defaultValue: true,
        group: '隐私',
      ),

      // 聊天设置
      SettingItem.select(
        key: 'achat_theme',
        title: '主题',
        description: '选择应用主题',
        options: ['浅色', '深色', '跟随系统'],
        defaultValue: '跟随系统',
        group: '外观',
      ),

      SettingItem.select(
        key: 'achat_font_size',
        title: '字体大小',
        description: '调整聊天字体大小',
        options: ['小', '中', '大'],
        defaultValue: '中',
        group: '外观',
      ),

      SettingItem.toggle(
        key: 'achat_auto_download_photos',
        title: '自动下载照片',
        description: '使用WiFi时自动下载照片',
        defaultValue: true,
        group: '数据和存储',
      ),

      SettingItem.toggle(
        key: 'achat_auto_download_videos',
        title: '自动下载视频',
        description: '使用WiFi时自动下载视频',
        defaultValue: false,
        group: '数据和存储',
      ),

      // 安全设置
      SettingItem.toggle(
        key: 'achat_app_lock',
        title: '应用锁',
        description: '启用生物识别或PIN码锁定',
        defaultValue: false,
        group: '安全',
      ),

      SettingItem.select(
        key: 'achat_auto_lock_timeout',
        title: '自动锁定时间',
        description: '应用自动锁定时间',
        options: ['立即', '1分钟', '5分钟', '15分钟'],
        defaultValue: '5分钟',
        group: '安全',
      ),

      SettingItem.toggle(
        key: 'achat_screenshot_security',
        title: '截图安全',
        description: '阻止应用截图和录屏',
        defaultValue: false,
        group: '安全',
      ),

      // 高级设置
      SettingItem.toggle(
        key: 'achat_developer_mode',
        title: '开发者模式',
        description: '启用调试功能',
        defaultValue: false,
        group: '高级',
      ),

      SettingItem.toggle(
        key: 'achat_analytics',
        title: '使用分析',
        description: '帮助改进应用体验',
        defaultValue: true,
        group: '高级',
      ),
    ];
  }
}
```

## 9. 本地化扩展（基于Common本地化）

### 9.1 AChat特定翻译

```dart
// AChat英文翻译
const Map<String, String> achatEnLocales = {
  // 通用
  'achat_app_name': 'AChat Enterprise',
  'achat_welcome': 'Welcome to AChat',

  // 聊天相关
  'achat_new_message': 'New message',
  'achat_type_message': 'Type a message...',
  'achat_send': 'Send',
  'achat_online': 'Online',
  'achat_offline': 'Offline',
  'achat_typing': 'typing...',
  'achat_last_seen': 'Last seen',

  // 联系人
  'achat_contacts': 'Contacts',
  'achat_add_contact': 'Add Contact',
  'achat_search_contacts': 'Search contacts...',

  // 群组
  'achat_groups': 'Groups',
  'achat_create_group': 'Create Group',
  'achat_group_members': 'Group Members',

  // 设置
  'achat_settings': 'Settings',
  'achat_notifications': 'Notifications',
  'achat_privacy': 'Privacy',
  'achat_security': 'Security',

  // 错误消息
  'achat_connection_error': 'Connection failed',
  'achat_send_failed': 'Failed to send message',
  'achat_network_error': 'Network error',
};

// AChat中文翻译
const Map<String, String> achatZhLocales = {
  // 通用
  'achat_app_name': 'AChat 企业版',
  'achat_welcome': '欢迎使用 AChat',

  // 聊天相关
  'achat_new_message': '新消息',
  'achat_type_message': '输入消息...',
  'achat_send': '发送',
  'achat_online': '在线',
  'achat_offline': '离线',
  'achat_typing': '正在输入...',
  'achat_last_seen': '最后在线',

  // 联系人
  'achat_contacts': '联系人',
  'achat_add_contact': '添加联系人',
  'achat_search_contacts': '搜索联系人...',

  // 群组
  'achat_groups': '群组',
  'achat_create_group': '创建群组',
  'achat_group_members': '群组成员',

  // 设置
  'achat_settings': '设置',
  'achat_notifications': '通知',
  'achat_privacy': '隐私',
  'achat_security': '安全',

  // 错误消息
  'achat_connection_error': '连接失败',
  'achat_send_failed': '发送消息失败',
  'achat_network_error': '网络错误',
};
```

## 10. 应用初始化集成

### 10.1 AChat应用启动

```dart
// 导入common主要入口
import '../../../common/app/main_common.dart';
import '../../../common/localization/localization_manager.dart';

// AChat应用初始化
Future<void> runAChatApp() async {
  // 使用common的runCommonApp启动应用
  await runCommonApp(
    // 应用特定配置
    appName: 'achat',
    mainAppWidget: const AChatApp(),

    // 设置配置
    settings: AChatAppSettings.getAChatSettings(),

    // 本地化配置
    enAppLocales: achatEnLocales,
    zhAppLocales: achatZhLocales,

    // 路由配置
    router: AChatRouter.router,

    // 自定义提供者
    providers: [
      ChangeNotifierProvider(create: (_) => AChatUserProvider(
        apiClient: AChatApiClient(context: context),
        wsClient: WebSocketClient(),
        storage: AChatStorageManager.instance,
        realtimeManager: RealtimeManager(wsClient, storage),
      )),
      ChangeNotifierProvider(create: (_) => ChatProvider()),
      ChangeNotifierProvider(create: (_) => ContactProvider()),
    ],

    // 初始化回调
    onAppInitialized: () async {
      // AChat特定初始化
      await AChatStorageManager.instance.initAChatStorage();
    },
  );
}

class AChatApp extends StatelessWidget {
  const AChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'achat_app_name'.tr(context),
      routerConfig: AChatRouter.router,
      theme: ThemeData(
        // 使用common主题系统
        colorScheme: ColorScheme.fromSeed(
          seedColor: ThemeColors.blue500, // 从common导入
        ),
      ),
    );
  }
}
```

## 11. 实施时间线

### Phase 1: 基础集成 (第1周)
- [ ] 扩展ApiClient实现缓存和WebSocket集成
- [ ] 创建扩展StorageManager的AChatStorageManager
- [ ] 设置扩展BaseUserProvider的AChatUserProvider
- [ ] 实现基础WebSocket客户端

### Phase 2: 核心扩展 (第2周)
- [ ] 实现多级缓存与智能失效策略
- [ ] 创建实时事件管理系统
- [ ] 添加离线队列管理
- [ ] 实现消息和会话存储

### Phase 3: 高级功能 (第3周)
- [ ] 添加安全消息加密服务
- [ ] 实现打字指示器和在线状态管理
- [ ] 创建带进度跟踪的文件上传/下载
- [ ] 添加推送通知集成

### Phase 4: 优化与集成 (第4周)
- [ ] 性能优化和后台处理
- [ ] 全面错误处理和重试机制
- [ ] 与common类库的最终集成测试
- [ ] 文档和代码审查

## 12. 关键优势总结

### 12.1 利用Common类库的好处
- **⏱️ 开发效率**: 通过重用common组件减少60%的代码量
- **🔄 一致性**: 跨所有应用的共享主题、存储和网络
- **📈 可扩展性**: 通用缓存、离线支持和性能优化
- **🛡️ 安全性**: 集中化安全模式与AChat特定增强

### 12.2 正确的架构模式
- **导入关系**: AChat作为使用者导入common类库
- **扩展模式**: 扩展common类而不是重新实现
- **配置模式**: 创建使用common接口的应用特定配置
- **服务层**: AChat服务组合common服务，而不是继承

这种修正后的计划确保AChat正确利用common类库作为基础设施，同时提供企业通信所需的高级功能。