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

/// Wuy Data Center
/// Centralized data management for the Wuy app
/// Provides unified access to user data, friends, chat messages, and other shared data
class WuyDataCenter extends ChangeNotifier {
  static final WuyDataCenter _instance = WuyDataCenter._internal();
  factory WuyDataCenter() => _instance;
  WuyDataCenter._internal();

  // Network status
  bool _isNetworkAvailable = true;
  bool _isOfflineMode = false;

  // User data
  UserModelAppWuy? _currentUser;
  bool _isLoggedIn = false;

  // Friends data
  List<FriendModelAppWuy> _friends = [];
  List<FriendModelAppWuy> _searchResults = [];

  // Chat data
  Map<String, List<ChatMessageModelAppWuy>> _chatMessages = {};
  Map<String, bool> _chatOnlineStatus = {};

  // Location data
  Map<String, dynamic>? _currentLocation;
  List<Map<String, dynamic>> _locationHistory = [];

  // Network records
  List<Map<String, dynamic>> _networkRecords = [];

  // Activity history
  List<Map<String, dynamic>> _activityHistory = [];

  // Getters
  bool get isNetworkAvailable => _isNetworkAvailable;
  bool get isOfflineMode => _isOfflineMode;
  UserModelAppWuy? get currentUser => _currentUser;
  bool get isLoggedIn => _isLoggedIn;
  List<FriendModelAppWuy> get friends => List.unmodifiable(_friends);
  List<FriendModelAppWuy> get searchResults => List.unmodifiable(_searchResults);
  Map<String, List<ChatMessageModelAppWuy>> get chatMessages => Map.unmodifiable(_chatMessages);
  Map<String, bool> get chatOnlineStatus => Map.unmodifiable(_chatOnlineStatus);
  Map<String, dynamic>? get currentLocation => _currentLocation;
  List<Map<String, dynamic>> get locationHistory => List.unmodifiable(_locationHistory);
  List<Map<String, dynamic>> get networkRecords => List.unmodifiable(_networkRecords);
  List<Map<String, dynamic>> get activityHistory => List.unmodifiable(_activityHistory);

  /// Initialize data center
  Future<void> initialize() async {
    await _loadOfflineData();
    _initializeFakeData();
  }

  /// Set network availability
  void setNetworkAvailability(bool isAvailable) {
    _isNetworkAvailable = isAvailable;
    _isOfflineMode = !isAvailable;
    notifyListeners();
  }

  /// Set offline mode
  void setOfflineMode(bool isOffline) {
    _isOfflineMode = isOffline;
    notifyListeners();
  }

  /// User management
  Future<void> setCurrentUser(UserModelAppWuy? user) async {
    _currentUser = user;
    _isLoggedIn = user != null;
    if (user != null) {
      _addActivityRecord('user_login', 'User logged in: ${user.displayName}');
    } else {
      _addActivityRecord('user_logout', 'User logged out');
    }
    notifyListeners();
  }

  /// Login with fake data (for offline mode or testing)
  Future<void> loginWithFakeData({
    required String phone,
    required String password,
  }) async {
    // Generate fake user data based on phone number
    final fakeUser = UserModelAppWuy(
      id: 'user_${phone.hashCode}',
      username: 'user_${phone.substring(7)}', // Use last 4 digits
      nickname: '用户${phone.substring(7)}',
      email: 'user_${phone.substring(7)}@anwuyou.test',
      phone: phone,
      avatar: 'assets/common/icons/people.png',
      isOnline: true,
      lastSeen: DateTime.now(),
      createdAt: DateTime.now().subtract(const Duration(days: 30)),
      updatedAt: DateTime.now(),
    );

    await setCurrentUser(fakeUser);
    
    // Generate fake friends data
    await _generateFakeFriends();
    
    // Generate fake chat messages
    await _generateFakeChatMessages();
    
    // Generate fake location data
    await _generateFakeLocationData();
    
    // Generate fake network records
    await _generateFakeNetworkRecords();
    
    // Generate fake activity history
    await _generateFakeActivityHistory();
    
    debugPrint('Fake login successful for phone: $phone');
  }

  Future<void> updateUserProfile(UserModelAppWuy user) async {
    _currentUser = user;
    _addActivityRecord('profile_update', 'Profile updated: ${user.displayName}');
    notifyListeners();
  }

  /// Friends management
  Future<void> setFriends(List<FriendModelAppWuy> friends) async {
    _friends = List.from(friends);
    _addActivityRecord('friends_loaded', 'Loaded ${friends.length} friends');
    notifyListeners();
  }

  Future<void> addFriend(FriendModelAppWuy friend) async {
    _friends.add(friend);
    _addActivityRecord('friend_added', 'Added friend: ${friend.displayName}');
    notifyListeners();
  }

  Future<void> removeFriend(String friendId) async {
    _friends.removeWhere((friend) => friend.id == friendId);
    _addActivityRecord('friend_removed', 'Removed friend: $friendId');
    notifyListeners();
  }

  Future<void> updateFriendStatus(String friendId, bool isOnline) async {
    final friendIndex = _friends.indexWhere((friend) => friend.id == friendId);
    if (friendIndex != -1) {
      _friends[friendIndex] = _friends[friendIndex].copyWith(isOnline: isOnline);
      _chatOnlineStatus[friendId] = isOnline;
      notifyListeners();
    }
  }

  /// Search management
  Future<void> setSearchResults(List<FriendModelAppWuy> results) async {
    _searchResults = List.from(results);
    _addActivityRecord('search_performed', 'Search returned ${results.length} results');
    notifyListeners();
  }

  Future<void> clearSearchResults() async {
    _searchResults.clear();
    notifyListeners();
  }

  /// Chat management
  Future<void> addChatMessage(String chatId, ChatMessageModelAppWuy message) async {
    if (!_chatMessages.containsKey(chatId)) {
      _chatMessages[chatId] = [];
    }
    _chatMessages[chatId]!.add(message);
    _addActivityRecord('message_sent', 'Message sent to $chatId');
    notifyListeners();
  }

  Future<void> setChatMessages(String chatId, List<ChatMessageModelAppWuy> messages) async {
    _chatMessages[chatId] = List.from(messages);
    notifyListeners();
  }

  Future<void> markMessageAsRead(String chatId, String messageId) async {
    if (_chatMessages.containsKey(chatId)) {
      final messages = _chatMessages[chatId]!;
      final messageIndex = messages.indexWhere((msg) => msg.id == messageId);
      if (messageIndex != -1) {
        messages[messageIndex] = messages[messageIndex].copyWith(isRead: true);
        notifyListeners();
      }
    }
  }

  /// Location management
  Future<void> setCurrentLocation(Map<String, dynamic> location) async {
    _currentLocation = location;
    _locationHistory.insert(0, {
      ...location,
      'timestamp': DateTime.now().toIso8601String(),
    });
    
    // Keep only last 100 location records
    if (_locationHistory.length > 100) {
      _locationHistory = _locationHistory.take(100).toList();
    }
    
    _addActivityRecord('location_updated', 'Location updated');
    notifyListeners();
  }

  /// Network records management
  Future<void> addNetworkRecord(Map<String, dynamic> record) async {
    _networkRecords.insert(0, {
      ...record,
      'timestamp': DateTime.now().toIso8601String(),
    });
    
    // Keep only last 50 network records
    if (_networkRecords.length > 50) {
      _networkRecords = _networkRecords.take(50).toList();
    }
    
    notifyListeners();
  }

  /// Activity history management
  void _addActivityRecord(String type, String description) {
    _activityHistory.insert(0, {
      'type': type,
      'description': description,
      'timestamp': DateTime.now().toIso8601String(),
    });
    
    // Keep only last 100 activity records
    if (_activityHistory.length > 100) {
      _activityHistory = _activityHistory.take(100).toList();
    }
  }

  /// Load offline data
  Future<void> _loadOfflineData() async {
    // Load cached data from local storage
    // This would typically use Hive or SharedPreferences
    // For now, we'll use fake data
  }

  /// Initialize fake data for offline mode
  void _initializeFakeData() {
    if (_isOfflineMode) {
      _initializeFakeFriends();
      _initializeFakeChatMessages();
      _initializeFakeLocationData();
      _initializeFakeNetworkRecords();
      _initializeFakeActivityHistory();
    }
  }

  void _initializeFakeFriends() {
    _friends = [
      FriendModelAppWuy(
        id: '1',
        username: 'xiaofeixia',
        displayName: '小飞侠',
        bio: '守护的未来',
        isOnline: true,
        avatarUrl: 'assets/common/icons/people.png',
        phoneNumber: '138****8000',
        lastSeen: DateTime.now().subtract(Duration(minutes: 5)),
        createdAt: DateTime.now().subtract(Duration(days: 30)),
        updatedAt: DateTime.now(),
      ),
      FriendModelAppWuy(
        id: '2',
        username: 'xiaoming',
        displayName: '小明',
        bio: '努力学习中',
        isOnline: true,
        avatarUrl: 'assets/common/icons/people.png',
        phoneNumber: '139****9000',
        lastSeen: DateTime.now().subtract(Duration(minutes: 10)),
        createdAt: DateTime.now().subtract(Duration(days: 25)),
        updatedAt: DateTime.now(),
      ),
      FriendModelAppWuy(
        id: '3',
        username: 'xiaohong',
        displayName: '小红',
        bio: '热爱生活',
        isOnline: false,
        avatarUrl: 'assets/common/icons/people.png',
        phoneNumber: '137****7000',
        lastSeen: DateTime.now().subtract(Duration(hours: 2)),
        createdAt: DateTime.now().subtract(Duration(days: 20)),
        updatedAt: DateTime.now(),
      ),
    ];
  }

  void _initializeFakeChatMessages() {
    _chatMessages = {
      '1': [
        ChatMessageModelAppWuy(
          id: '1',
          chatId: 'chat_1',
          content: '你好！',
          senderId: '1',
          receiverId: 'current_user',
          createdAt: DateTime.now().subtract(Duration(minutes: 10)),
          isRead: true,
        ),
        ChatMessageModelAppWuy(
          id: '2',
          chatId: 'chat_1',
          content: '你好！最近怎么样？',
          senderId: 'current_user',
          receiverId: '1',
          createdAt: DateTime.now().subtract(Duration(minutes: 9)),
          isRead: true,
        ),
      ],
      '2': [
        ChatMessageModelAppWuy(
          id: '3',
          chatId: 'chat_2',
          content: '今天天气不错',
          senderId: '2',
          receiverId: 'current_user',
          createdAt: DateTime.now().subtract(Duration(minutes: 5)),
          isRead: false,
        ),
      ],
    };
  }

  void _initializeFakeLocationData() {
    _currentLocation = {
      'latitude': 39.9042,
      'longitude': 116.4074,
      'address': '北京市朝阳区',
      'accuracy': 10.0,
    };
  }

  void _initializeFakeNetworkRecords() {
    _networkRecords = [
      {
        'type': 'login',
        'description': '登录成功',
        'status': 'success',
        'timestamp': DateTime.now().subtract(Duration(minutes: 30)).toIso8601String(),
      },
      {
        'type': 'api_call',
        'description': '获取好友列表',
        'status': 'success',
        'timestamp': DateTime.now().subtract(Duration(minutes: 25)).toIso8601String(),
      },
      {
        'type': 'error',
        'description': '网络连接超时',
        'status': 'error',
        'timestamp': DateTime.now().subtract(Duration(minutes: 20)).toIso8601String(),
      },
    ];
  }

  void _initializeFakeActivityHistory() {
    _activityHistory = [
      {
        'type': 'user_login',
        'description': '用户登录',
        'timestamp': DateTime.now().subtract(Duration(minutes: 30)).toIso8601String(),
      },
      {
        'type': 'friends_loaded',
        'description': '加载好友列表',
        'timestamp': DateTime.now().subtract(Duration(minutes: 25)).toIso8601String(),
      },
      {
        'type': 'message_sent',
        'description': '发送消息给小明',
        'timestamp': DateTime.now().subtract(Duration(minutes: 20)).toIso8601String(),
      },
    ];
  }

  /// Generate fake friends data for login
  Future<void> _generateFakeFriends() async {
    final fakeFriends = [
      FriendModelAppWuy(
        id: '1',
        username: 'xiaofeixia',
        displayName: '小飞侠',
        bio: '热爱生活，积极向上',
        isOnline: true,
        avatarUrl: 'assets/common/icons/people.png',
        phoneNumber: '138****8888',
        lastSeen: DateTime.now(),
        createdAt: DateTime.now().subtract(Duration(days: 30)),
        updatedAt: DateTime.now(),
      ),
      FriendModelAppWuy(
        id: '2',
        username: 'xiaoming',
        displayName: '小明',
        bio: '程序员一枚',
        isOnline: true,
        avatarUrl: 'assets/common/icons/people.png',
        phoneNumber: '139****9999',
        lastSeen: DateTime.now().subtract(Duration(minutes: 5)),
        createdAt: DateTime.now().subtract(Duration(days: 25)),
        updatedAt: DateTime.now(),
      ),
      FriendModelAppWuy(
        id: '3',
        username: 'xiaohong',
        displayName: '小红',
        bio: '热爱生活',
        isOnline: false,
        avatarUrl: 'assets/common/icons/people.png',
        phoneNumber: '137****7000',
        lastSeen: DateTime.now().subtract(Duration(hours: 2)),
        createdAt: DateTime.now().subtract(Duration(days: 20)),
        updatedAt: DateTime.now(),
      ),
    ];
    await setFriends(fakeFriends);
  }

  /// Generate fake chat messages for login
  Future<void> _generateFakeChatMessages() async {
    _chatMessages = {
      '1': [
        ChatMessageModelAppWuy(
          id: '1',
          chatId: 'chat_1',
          content: '你好！',
          senderId: '1',
          receiverId: _currentUser?.id ?? 'current_user',
          createdAt: DateTime.now().subtract(Duration(minutes: 10)),
          isRead: true,
        ),
        ChatMessageModelAppWuy(
          id: '2',
          chatId: 'chat_1',
          content: '你好！最近怎么样？',
          senderId: _currentUser?.id ?? 'current_user',
          receiverId: '1',
          createdAt: DateTime.now().subtract(Duration(minutes: 9)),
          isRead: true,
        ),
      ],
      '2': [
        ChatMessageModelAppWuy(
          id: '3',
          chatId: 'chat_2',
          content: '今天天气不错',
          senderId: '2',
          receiverId: _currentUser?.id ?? 'current_user',
          createdAt: DateTime.now().subtract(Duration(minutes: 5)),
          isRead: false,
        ),
      ],
    };
    notifyListeners();
  }

  /// Generate fake location data for login
  Future<void> _generateFakeLocationData() async {
    _currentLocation = {
      'latitude': 39.9042,
      'longitude': 116.4074,
      'address': '北京市朝阳区',
      'accuracy': 10.0,
    };
    notifyListeners();
  }

  /// Generate fake network records for login
  Future<void> _generateFakeNetworkRecords() async {
    _networkRecords = [
      {
        'type': 'login',
        'description': '登录成功',
        'status': 'success',
        'timestamp': DateTime.now().subtract(Duration(minutes: 30)).toIso8601String(),
      },
      {
        'type': 'api_call',
        'description': '获取好友列表',
        'status': 'success',
        'timestamp': DateTime.now().subtract(Duration(minutes: 25)).toIso8601String(),
      },
      {
        'type': 'error',
        'description': '网络连接超时',
        'status': 'error',
        'timestamp': DateTime.now().subtract(Duration(minutes: 20)).toIso8601String(),
      },
    ];
    notifyListeners();
  }

  /// Generate fake activity history for login
  Future<void> _generateFakeActivityHistory() async {
    _activityHistory = [
      {
        'type': 'user_login',
        'description': '用户登录',
        'timestamp': DateTime.now().subtract(Duration(minutes: 30)).toIso8601String(),
      },
      {
        'type': 'friends_loaded',
        'description': '加载好友列表',
        'timestamp': DateTime.now().subtract(Duration(minutes: 25)).toIso8601String(),
      },
      {
        'type': 'message_sent',
        'description': '发送消息给小明',
        'timestamp': DateTime.now().subtract(Duration(minutes: 20)).toIso8601String(),
      },
    ];
    notifyListeners();
  }

  /// Clear all data
  Future<void> clearAllData() async {
    _currentUser = null;
    _isLoggedIn = false;
    _friends.clear();
    _searchResults.clear();
    _chatMessages.clear();
    _chatOnlineStatus.clear();
    _currentLocation = null;
    _locationHistory.clear();
    _networkRecords.clear();
    _activityHistory.clear();
    notifyListeners();
  }

  /// Dispose resources
  @override
  void dispose() {
    super.dispose();
  }
}
