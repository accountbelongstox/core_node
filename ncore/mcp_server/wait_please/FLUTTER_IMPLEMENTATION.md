# Flutter 移动端实现指南

## 项目概述

Flutter 移动端应用是寸止系统的用户交互界面，负责接收 MCP 请求通知、显示交互界面、收集用户响应并发送回 Laravel 后端。

## 技术栈

- **框架**: Flutter 3.x
- **状态管理**: Riverpod
- **网络请求**: Dio + Retrofit
- **WebSocket**: socket_io_client
- **推送通知**: firebase_messaging / flutter_local_notifications
- **本地存储**: Hive / SharedPreferences
- **UI 组件**: Material Design 3

## 项目结构

```
src/flutter_app/
├── lib/
│   ├── core/                    # 核心功能
│   │   ├── api/                 # API 客户端
│   │   ├── config/              # 配置管理
│   │   ├── constants/           # 常量定义
│   │   ├── exceptions/          # 异常处理
│   │   ├── network/             # 网络层
│   │   └── utils/               # 工具类
│   ├── data/                    # 数据层
│   │   ├── datasources/         # 数据源
│   │   ├── models/              # 数据模型
│   │   ├── repositories/        # 仓库实现
│   │   └── services/            # 服务类
│   ├── domain/                  # 业务层
│   │   ├── entities/            # 实体类
│   │   ├── repositories/        # 仓库接口
│   │   └── usecases/            # 用例
│   ├── presentation/            # 表现层
│   │   ├── pages/               # 页面
│   │   ├── widgets/             # 组件
│   │   ├── providers/           # 状态管理
│   │   └── theme/               # 主题配置
│   └── main.dart                # 应用入口
├── android/                     # Android 配置
├── ios/                         # iOS 配置
├── pubspec.yaml                 # 依赖配置
└── README.md                    # 项目说明
```

## 依赖配置

### pubspec.yaml

```yaml
name: cunzhi_flutter
description: 寸止 Flutter 移动端应用

version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'
  flutter: ">=3.10.0"

dependencies:
  flutter:
    sdk: flutter
  
  # 状态管理
  flutter_riverpod: ^2.4.0
  riverpod_annotation: ^2.3.0
  
  # 网络请求
  dio: ^5.3.0
  retrofit: ^4.0.0
  json_annotation: ^4.8.0
  
  # WebSocket
  socket_io_client: ^2.0.0
  
  # 推送通知
  firebase_messaging: ^14.6.0
  flutter_local_notifications: ^15.1.0
  
  # 本地存储
  hive: ^2.2.0
  hive_flutter: ^1.1.0
  shared_preferences: ^2.2.0
  
  # UI 组件
  material_color_utilities: ^0.5.0
  dynamic_color: ^1.6.0
  
  # 工具类
  equatable: ^2.0.0
  freezed_annotation: ^2.4.0
  logger: ^2.0.0
  intl: ^0.18.0
  
  # 权限管理
  permission_handler: ^11.0.0
  
  # 设备信息
  device_info_plus: ^9.1.0
  package_info_plus: ^4.2.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  
  # 代码生成
  build_runner: ^2.4.0
  riverpod_generator: ^2.3.0
  retrofit_generator: ^7.0.0
  json_serializable: ^6.7.0
  freezed: ^2.4.0
  hive_generator: ^2.0.0
  
  # 代码质量
  flutter_lints: ^3.0.0
  very_good_analysis: ^5.1.0

flutter:
  uses-material-design: true
  
  assets:
    - assets/images/
    - assets/icons/
    - assets/sounds/
  
  fonts:
    - family: Roboto
      fonts:
        - asset: assets/fonts/Roboto-Regular.ttf
        - asset: assets/fonts/Roboto-Bold.ttf
          weight: 700
```

## 核心功能实现

### 1. API 客户端

**lib/core/api/api_client.dart**
```dart
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import 'package:json_annotation/json_annotation.dart';

part 'api_client.g.dart';

@RestApi()
abstract class ApiClient {
  factory ApiClient(Dio dio, {String baseUrl}) = _ApiClient;

  // 健康检查
  @GET('/api/health')
  Future<HealthResponse> getHealth();

  // MCP 服务状态
  @GET('/api/mcp/status')
  Future<McpStatusResponse> getMcpStatus();

  // 客户端状态
  @GET('/api/clients/status')
  Future<ClientStatusResponse> getClientStatus();

  // 提交 MCP 响应
  @POST('/api/mcp/response')
  Future<ApiResponse> submitMcpResponse(@Body() McpResponseRequest request);

  // 获取活跃请求
  @GET('/api/mcp/requests')
  Future<ActiveRequestsResponse> getActiveRequests();

  // 取消请求
  @DELETE('/api/mcp/requests/{id}')
  Future<ApiResponse> cancelRequest(@Path('id') String requestId);

  // 配置管理
  @GET('/api/app/config')
  Future<AppConfigResponse> getAppConfig();

  @POST('/api/app/config')
  Future<ApiResponse> updateAppConfig(@Body() AppConfigRequest request);

  // 用户认证
  @POST('/api/auth/register')
  Future<AuthResponse> register(@Body() RegisterRequest request);

  @POST('/api/auth/login')
  Future<AuthResponse> login(@Body() LoginRequest request);

  @POST('/api/auth/logout')
  Future<ApiResponse> logout();

  @GET('/api/auth/me')
  Future<UserResponse> getCurrentUser();
}
```

### 2. WebSocket 服务

**lib/data/services/websocket_service.dart**
```dart
import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

class WebSocketService {
  static const String _defaultUrl = 'http://localhost:8000';
  
  IO.Socket? _socket;
  final Logger _logger = Logger();
  final StreamController<McpPopupEvent> _mcpPopupController = StreamController.broadcast();
  final StreamController<ConfigChangedEvent> _configChangedController = StreamController.broadcast();
  final StreamController<NotificationEvent> _notificationController = StreamController.broadcast();
  final StreamController<ConnectionStatus> _connectionController = StreamController.broadcast();

  // 事件流
  Stream<McpPopupEvent> get mcpPopupStream => _mcpPopupController.stream;
  Stream<ConfigChangedEvent> get configChangedStream => _configChangedController.stream;
  Stream<NotificationEvent> get notificationStream => _notificationController.stream;
  Stream<ConnectionStatus> get connectionStream => _connectionController.stream;

  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect({String? url, String? token}) async {
    try {
      final socketUrl = url ?? _defaultUrl;
      
      _socket = IO.io(socketUrl, IO.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .setExtraHeaders({'Authorization': 'Bearer ${token ?? ''}'})
          .build());

      _setupEventHandlers();
      
      _socket!.connect();
      _logger.i('WebSocket 连接中: $socketUrl');
    } catch (e) {
      _logger.e('WebSocket 连接失败: $e');
      _connectionController.add(ConnectionStatus.error(e.toString()));
    }
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _logger.i('WebSocket 已断开');
  }

  void _setupEventHandlers() {
    if (_socket == null) return;

    // 连接事件
    _socket!.onConnect((_) {
      _logger.i('WebSocket 连接成功');
      _connectionController.add(ConnectionStatus.connected());
      
      // 发送认证信息
      _socket!.emit('auth', {
        'client_type': 'flutter_app',
        'device_info': _getDeviceInfo(),
      });
    });

    _socket!.onDisconnect((_) {
      _logger.w('WebSocket 连接断开');
      _connectionController.add(ConnectionStatus.disconnected());
    });

    _socket!.onError((error) {
      _logger.e('WebSocket 错误: $error');
      _connectionController.add(ConnectionStatus.error(error.toString()));
    });

    // 业务事件
    _socket!.on('mcp.popup', (data) {
      _logger.d('收到 MCP 弹窗请求: $data');
      final event = McpPopupEvent.fromJson(data);
      _mcpPopupController.add(event);
    });

    _socket!.on('config.changed', (data) {
      _logger.d('配置已更新: $data');
      final event = ConfigChangedEvent.fromJson(data);
      _configChangedController.add(event);
    });

    _socket!.on('notification', (data) {
      _logger.d('收到通知: $data');
      final event = NotificationEvent.fromJson(data);
      _notificationController.add(event);
    });

    // 认证响应
    _socket!.on('auth_success', (data) {
      _logger.i('认证成功: $data');
    });

    // 心跳
    _socket!.on('pong', (data) {
      _logger.d('收到心跳响应: $data');
    });
  }

  void sendMcpResponse(String requestId, dynamic response) {
    if (!isConnected) {
      _logger.w('WebSocket 未连接，无法发送响应');
      return;
    }

    _socket!.emit('mcp_response', {
      'request_id': requestId,
      'response': response,
      'timestamp': DateTime.now().toIso8601String(),
    });

    _logger.d('已发送 MCP 响应: $requestId');
  }

  void sendHeartbeat() {
    if (!isConnected) return;
    
    _socket!.emit('ping', {
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Map<String, dynamic> _getDeviceInfo() {
    // 获取设备信息的实现
    return {
      'platform': 'flutter',
      'version': '1.0.0',
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  void dispose() {
    disconnect();
    _mcpPopupController.close();
    _configChangedController.close();
    _notificationController.close();
    _connectionController.close();
  }
}

// WebSocket 服务提供者
final webSocketServiceProvider = Provider<WebSocketService>((ref) {
  final service = WebSocketService();
  ref.onDispose(() => service.dispose());
  return service;
});
```

### 3. 推送通知服务

**lib/data/services/notification_service.dart**
```dart
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:logger/logger.dart';

class NotificationService {
  static const String _channelId = 'cunzhi_mcp_channel';
  static const String _channelName = '寸止 MCP 通知';
  static const String _channelDescription = 'AI 对话拦截通知';

  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  final Logger _logger = Logger();

  Future<void> initialize() async {
    await _initializeLocalNotifications();
    await _initializeFirebaseMessaging();
    await _requestPermissions();
  }

  Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    // 创建通知渠道 (Android)
    const androidChannel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: _channelDescription,
      importance: Importance.high,
      playSound: true,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);
  }

  Future<void> _initializeFirebaseMessaging() async {
    // 获取 FCM Token
    final token = await _firebaseMessaging.getToken();
    _logger.i('FCM Token: $token');

    // 监听前台消息
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // 监听后台消息点击
    FirebaseMessaging.onMessageOpenedApp.listen(_handleBackgroundMessageTap);

    // 检查应用启动时的消息
    final initialMessage = await _firebaseMessaging.getInitialMessage();
    if (initialMessage != null) {
      _handleBackgroundMessageTap(initialMessage);
    }
  }

  Future<void> _requestPermissions() async {
    // 请求通知权限
    final notificationStatus = await Permission.notification.request();
    _logger.i('通知权限状态: $notificationStatus');

    // 请求 Firebase 权限
    final firebaseSettings = await _firebaseMessaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    _logger.i('Firebase 权限状态: ${firebaseSettings.authorizationStatus}');
  }

  Future<void> showMcpPopupNotification({
    required String requestId,
    required String message,
    List<String>? predefinedOptions,
    bool isMarkdown = false,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: _channelDescription,
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
      autoCancel: false,
      ongoing: true,
      category: AndroidNotificationCategory.message,
      actions: <AndroidNotificationAction>[
        AndroidNotificationAction('respond', '回复'),
        AndroidNotificationAction('cancel', '取消'),
      ],
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
      categoryIdentifier: 'mcp_popup_category',
    );

    const notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      requestId.hashCode,
      '寸止 - AI 对话拦截',
      message,
      notificationDetails,
      payload: requestId,
    );

    _logger.i('已显示 MCP 弹窗通知: $requestId');
  }

  Future<void> cancelNotification(String requestId) async {
    await _localNotifications.cancel(requestId.hashCode);
    _logger.i('已取消通知: $requestId');
  }

  Future<void> cancelAllNotifications() async {
    await _localNotifications.cancelAll();
    _logger.i('已取消所有通知');
  }

  void _handleForegroundMessage(RemoteMessage message) {
    _logger.i('收到前台消息: ${message.messageId}');
    
    // 如果是 MCP 弹窗消息，显示本地通知
    if (message.data['type'] == 'mcp_popup') {
      showMcpPopupNotification(
        requestId: message.data['request_id'] ?? '',
        message: message.notification?.body ?? '',
        predefinedOptions: message.data['predefined_options']?.split(','),
        isMarkdown: message.data['is_markdown'] == 'true',
      );
    }
  }

  void _handleBackgroundMessageTap(RemoteMessage message) {
    _logger.i('用户点击了后台消息: ${message.messageId}');
    
    // 导航到相应页面
    if (message.data['type'] == 'mcp_popup') {
      // 导航到 MCP 响应页面
      // NavigationService.navigateToMcpResponse(message.data['request_id']);
    }
  }

  void _onNotificationTapped(NotificationResponse response) {
    _logger.i('用户点击了通知: ${response.payload}');
    
    if (response.payload != null) {
      // 导航到 MCP 响应页面
      // NavigationService.navigateToMcpResponse(response.payload!);
    }
  }

  Future<String?> getFcmToken() async {
    return await _firebaseMessaging.getToken();
  }

  void dispose() {
    // 清理资源
  }
}
```
