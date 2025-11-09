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
import '../models_app_wuy/user_model_app_wuy.dart';
import '../models_app_wuy/friend_model_app_wuy.dart';
import '../models_app_wuy/chat_message_model_app_wuy.dart';
import '../resources_app_wuy/assets_icons_app_wuy.dart';

/// Wuy Fake Data Generator
/// Independent fake data generation library for development and testing
/// Can be easily removed by deleting references without affecting data models
class WuyFakeDataGenerator {
  static final WuyFakeDataGenerator _instance =
      WuyFakeDataGenerator._internal();
  factory WuyFakeDataGenerator() => _instance;
  WuyFakeDataGenerator._internal();

  static bool _isEnabled = kDebugMode;

  // Fake user data templates
  static const List<String> _fakeNames = [
    '小飞侠',
    '小明',
    '小红',
    '小李',
    '小王',
    '小张',
    '小陈',
    '小刘',
    '小黄',
    '小周',
    '小吴',
    '小郑',
    '小冯',
    '小韩',
    '小杨',
    '小朱'
  ];

  static const List<String> _fakeBios = [
    '热爱生活，积极向上',
    '喜欢旅行和摄影',
    '程序员，热爱技术',
    '设计师，追求美',
    '音乐爱好者',
    '运动达人',
    '读书爱好者',
    '美食探索者'
  ];

  static const List<String> _fakeMessages = [
    '你好！',
    '最近怎么样？',
    '今天天气不错',
    '有空一起吃饭吗？',
    '工作忙吗？',
    '周末有什么计划？',
    '谢谢你的帮助',
    '明天见！'
  ];

  // ==================== USER FAKE DATA ====================

  /// Generate fake user for login/registration
  static UserModelAppWuy generateFakeUser({
    required String phone,
    String? username,
    String? nickname,
    String? email,
  }) {
    final phoneSuffix =
        phone.length >= 4 ? phone.substring(phone.length - 4) : '0000';
    final nameIndex = phone.hashCode.abs() % _fakeNames.length;
    final fakeIdNumber = '4201${phone.hashCode.abs() % 100000000}'.padLeft(18, '0');

    return UserModelAppWuy(
      id: phone.hashCode,
      username: username ?? 'user_$phoneSuffix',
      nickname: nickname ?? _fakeNames[nameIndex],
      email: email ?? 'user_$phoneSuffix@anwuyou.test',
      phone: phone,
      phoneNumber: phone,
      avatar: WuyAppAssetsIcons.avatarPlaceholder,
      avatarUrl: WuyAppAssetsIcons.avatarPlaceholder,
      isOnline: true,
      isVerified: true,
      bio: _fakeBios[nameIndex % _fakeBios.length],
      lastSeen: DateTime.now(),
      createdAt: DateTime.now().subtract(const Duration(days: 30)),
      updatedAt: DateTime.now(),
      roles: ['user'],
      meta: {
        'id_number': fakeIdNumber,
      },
      preferences: {},
    );
  }

  /// Generate fake user for testing (WuUserProvider)
  static UserModelAppWuy generateTestUser() {
    return generateFakeUser(
      phone: '13800138000',
      username: 'testuser',
      nickname: '测试用户',
      email: 'test@anwuyou.test',
    );
  }

  // ==================== FRIENDS FAKE DATA ====================

  /// Generate fake friends list
  static List<FriendModelAppWuy> generateFakeFriends() {
    return [
      FriendModelAppWuy(
        id: '1',
        username: 'xiaofeixia',
        displayName: '小飞侠',
        bio: '热爱生活，积极向上',
        isOnline: true,
        avatarUrl: WuyAppAssetsIcons.avatarPlaceholder,
        phoneNumber: '138****8888',
        lastSeen: DateTime.now(),
        createdAt: DateTime.now().subtract(const Duration(days: 30)),
        updatedAt: DateTime.now(),
        lastMessage: 'Hey, are we still meeting tonight?',
        lastMessageTime: DateTime.now().subtract(const Duration(minutes: 5)),
        unreadMessageCount: 2,
        isMonitoring: true,
        lastLocationTime: DateTime.now().subtract(const Duration(minutes: 10)),
        lastLocation: {
          'latitude': 39.9042,
          'longitude': 116.4074,
          'address': 'Beijing, China'
        },
      ),
      FriendModelAppWuy(
        id: '2',
        username: 'xiaoming',
        displayName: '小明',
        bio: '喜欢旅行和摄影',
        isOnline: false,
        avatarUrl: WuyAppAssetsIcons.avatarPlaceholder,
        phoneNumber: '139****9999',
        lastSeen: DateTime.now().subtract(const Duration(hours: 2)),
        createdAt: DateTime.now().subtract(const Duration(days: 25)),
        updatedAt: DateTime.now(),
        lastMessage: 'Thanks for your help!',
        lastMessageTime: DateTime.now().subtract(const Duration(hours: 1)),
        unreadMessageCount: 0,
        isMonitoring: false,
        lastLocationTime: DateTime.now().subtract(const Duration(hours: 3)),
        lastLocation: {
          'latitude': 31.2304,
          'longitude': 121.4737,
          'address': 'Shanghai, China'
        },
      ),
      FriendModelAppWuy(
        id: '3',
        username: 'xiaohong',
        displayName: '小红',
        bio: '程序员，热爱技术',
        isOnline: true,
        avatarUrl: WuyAppAssetsIcons.avatarPlaceholder,
        phoneNumber: '137****7777',
        lastSeen: DateTime.now(),
        createdAt: DateTime.now().subtract(const Duration(days: 20)),
        updatedAt: DateTime.now(),
        lastMessage: 'Check out this new library!',
        lastMessageTime: DateTime.now().subtract(const Duration(minutes: 30)),
        unreadMessageCount: 5,
        isMonitoring: true,
        lastLocationTime: DateTime.now().subtract(const Duration(minutes: 15)),
        lastLocation: {
          'latitude': 22.5431,
          'longitude': 114.0579,
          'address': 'Shenzhen, China'
        },
      ),
      FriendModelAppWuy(
        id: '4',
        username: 'xiaoli',
        displayName: '小李',
        bio: '设计师，追求美',
        isOnline: false,
        avatarUrl: WuyAppAssetsIcons.avatarPlaceholder,
        phoneNumber: '136****6666',
        lastSeen: DateTime.now().subtract(const Duration(hours: 5)),
        createdAt: DateTime.now().subtract(const Duration(days: 15)),
        updatedAt: DateTime.now(),
        lastMessage: 'Love the new design!',
        lastMessageTime: DateTime.now().subtract(const Duration(hours: 4)),
        unreadMessageCount: 1,
        isMonitoring: false,
        lastLocationTime: DateTime.now().subtract(const Duration(hours: 6)),
        lastLocation: {
          'latitude': 30.5728,
          'longitude': 104.0668,
          'address': 'Chengdu, China'
        },
      ),
      FriendModelAppWuy(
        id: '5',
        username: 'xiaowang',
        displayName: '小王',
        bio: '音乐爱好者',
        isOnline: true,
        avatarUrl: WuyAppAssetsIcons.avatarPlaceholder,
        phoneNumber: '135****5555',
        lastSeen: DateTime.now(),
        createdAt: DateTime.now().subtract(const Duration(days: 10)),
        updatedAt: DateTime.now(),
        lastMessage: 'Concert this weekend?',
        lastMessageTime: DateTime.now().subtract(const Duration(hours: 12)),
        unreadMessageCount: 0,
        isMonitoring: true,
        lastLocationTime: DateTime.now().subtract(const Duration(hours: 1)),
        lastLocation: {
          'latitude': 23.1291,
          'longitude': 113.2644,
          'address': 'Guangzhou, China'
        },
      ),
    ];
  }

  // ==================== CHAT FAKE DATA ====================

  /// Generate fake chat messages
  static Map<String, List<ChatMessageModelAppWuy>> generateFakeChatMessages() {
    return {
      '1': [
        ChatMessageModelAppWuy(
          id: '1',
          chatId: 'chat_1',
          content: '你好！',
          senderId: '1',
          receiverId: 'current_user',
          createdAt: DateTime.now().subtract(const Duration(minutes: 10)),
          isRead: true,
        ),
        ChatMessageModelAppWuy(
          id: '2',
          chatId: 'chat_1',
          content: '你好！最近怎么样？',
          senderId: 'current_user',
          receiverId: '1',
          createdAt: DateTime.now().subtract(const Duration(minutes: 9)),
          isRead: true,
        ),
        ChatMessageModelAppWuy(
          id: '3',
          chatId: 'chat_1',
          content: '还不错，你呢？',
          senderId: '1',
          receiverId: 'current_user',
          createdAt: DateTime.now().subtract(const Duration(minutes: 8)),
          isRead: true,
        ),
      ],
      '2': [
        ChatMessageModelAppWuy(
          id: '4',
          chatId: 'chat_2',
          content: '今天天气不错',
          senderId: '2',
          receiverId: 'current_user',
          createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
          isRead: false,
        ),
      ],
      '3': [
        ChatMessageModelAppWuy(
          id: '5',
          chatId: 'chat_3',
          content: '有空一起吃饭吗？',
          senderId: '3',
          receiverId: 'current_user',
          createdAt: DateTime.now().subtract(const Duration(minutes: 3)),
          isRead: false,
        ),
      ],
    };
  }

  // ==================== LOCATION FAKE DATA ====================

  /// Generate fake location data
  static Map<String, dynamic> generateFakeCurrentLocation() {
    return {
      'latitude': 39.9042,
      'longitude': 116.4074,
      'address': '北京市朝阳区',
      'accuracy': 10.0,
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  /// Generate fake location history
  static List<Map<String, dynamic>> generateFakeLocationHistory() {
    return [
      {
        'latitude': 39.9042,
        'longitude': 116.4074,
        'address': '北京市朝阳区',
        'accuracy': 10.0,
        'timestamp':
            DateTime.now().subtract(const Duration(hours: 1)).toIso8601String(),
      },
      {
        'latitude': 39.9142,
        'longitude': 116.4174,
        'address': '北京市海淀区',
        'accuracy': 15.0,
        'timestamp':
            DateTime.now().subtract(const Duration(hours: 2)).toIso8601String(),
      },
      {
        'latitude': 39.9242,
        'longitude': 116.4274,
        'address': '北京市西城区',
        'accuracy': 12.0,
        'timestamp':
            DateTime.now().subtract(const Duration(hours: 3)).toIso8601String(),
      },
    ];
  }

  // ==================== NETWORK RECORDS FAKE DATA ====================

  /// Generate fake network records
  static List<Map<String, dynamic>> generateFakeNetworkRecords() {
    return [
      {
        'type': 'login',
        'description': '登录成功',
        'status': 'success',
        'timestamp': DateTime.now()
            .subtract(const Duration(minutes: 30))
            .toIso8601String(),
      },
      {
        'type': 'api_call',
        'description': '获取好友列表',
        'status': 'success',
        'timestamp': DateTime.now()
            .subtract(const Duration(minutes: 25))
            .toIso8601String(),
      },
      {
        'type': 'error',
        'description': '网络连接超时',
        'status': 'error',
        'timestamp': DateTime.now()
            .subtract(const Duration(minutes: 20))
            .toIso8601String(),
      },
      {
        'type': 'api_call',
        'description': '发送消息',
        'status': 'success',
        'timestamp': DateTime.now()
            .subtract(const Duration(minutes: 15))
            .toIso8601String(),
      },
    ];
  }

  // ==================== ACTIVITY HISTORY FAKE DATA ====================

  /// Generate fake activity history
  static List<Map<String, dynamic>> generateFakeActivityHistory() {
    return [
      {
        'type': 'user_login',
        'description': '用户登录',
        'timestamp': DateTime.now()
            .subtract(const Duration(minutes: 30))
            .toIso8601String(),
      },
      {
        'type': 'friends_loaded',
        'description': '加载好友列表',
        'timestamp': DateTime.now()
            .subtract(const Duration(minutes: 25))
            .toIso8601String(),
      },
      {
        'type': 'message_sent',
        'description': '发送消息给小明',
        'timestamp': DateTime.now()
            .subtract(const Duration(minutes: 20))
            .toIso8601String(),
      },
      {
        'type': 'location_updated',
        'description': '位置信息更新',
        'timestamp': DateTime.now()
            .subtract(const Duration(minutes: 15))
            .toIso8601String(),
      },
    ];
  }

  // ==================== SEARCH RESULTS FAKE DATA ====================

  /// Generate fake search results
  static List<FriendModelAppWuy> generateFakeSearchResults(String query) {
    if (query.isEmpty) return [];

    final allFriends = generateFakeFriends();
    return allFriends
        .where((friend) =>
            friend.displayName.contains(query) ||
            friend.username.contains(query))
        .toList();
  }

  // ==================== UTILITY METHODS ====================

  /// Generate random message content
  static String generateRandomMessage() {
    final index = DateTime.now().millisecondsSinceEpoch % _fakeMessages.length;
    return _fakeMessages[index];
  }

  /// Generate random name
  static String generateRandomName() {
    final index = DateTime.now().millisecondsSinceEpoch % _fakeNames.length;
    return _fakeNames[index];
  }

  /// Generate random bio
  static String generateRandomBio() {
    final index = DateTime.now().millisecondsSinceEpoch % _fakeBios.length;
    return _fakeBios[index];
  }

  /// Check if fake data generation is enabled
  static bool get isEnabled => _isEnabled;

  /// Disable fake data generation (for production)
  static void disable() {
    _isEnabled = false;
    debugPrint('WuyFakeDataGenerator: Fake data generation disabled');
  }

  /// Enable fake data generation (for development)
  static void enable() {
    _isEnabled = true;
    debugPrint('WuyFakeDataGenerator: Fake data generation enabled');
  }
}
