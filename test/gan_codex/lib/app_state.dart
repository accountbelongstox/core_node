import 'package:flutter/material.dart';

import 'models.dart';
import 'translations.dart';

class AppState extends ChangeNotifier {
  AppState() {
    _friends = List<Friend>.from(_mockFriends);
  }

  User? _user;
  late List<Friend> _friends;
  ThemeMode _themeMode = ThemeMode.light;
  String _language = 'zh';

  User? get user => _user;
  List<Friend> get friends => List.unmodifiable(_friends);
  ThemeMode get themeMode => _themeMode;
  String get language => _language;
  bool get isAuthenticated => _user != null;

  void login(String phone) {
    _user = _mockUser.copyWith(phone: phone);
    notifyListeners();
  }

  void logout() {
    _user = null;
    notifyListeners();
  }

  void toggleTheme() {
    _themeMode =
        _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
  }

  void setLanguage(String lang) {
    if (lang != _language && kTranslations.containsKey(lang)) {
      _language = lang;
      notifyListeners();
    }
  }

  void updateUser({
    String? name,
    String? signature,
    String? address,
  }) {
    if (_user != null) {
      _user = _user!.copyWith(
        name: name,
        signature: signature,
        address: address,
      );
      notifyListeners();
    }
  }

  void toggleMonitor(String friendId) {
    _friends = _friends
        .map(
          (friend) => friend.id == friendId
              ? friend.copyWith(isMonitored: !friend.isMonitored)
              : friend,
        )
        .toList();
    notifyListeners();
  }

  Friend? getFriendById(String id) {
    for (final friend in _friends) {
      if (friend.id == id) {
        return friend;
      }
    }
    return null;
  }

  String t(String key) {
    return kTranslations[_language]?[key] ??
        kTranslations['en']?[key] ??
        key;
  }

  static const User _mockUser = User(
    id: 'u1',
    name: 'Alex Chen',
    phone: '13800138000',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    signature: 'Stay safe, stay connected.',
    gender: 'male',
    address: 'Beijing, China',
    email: 'alex@example.com',
    idCard: '11010119900101****',
  );

  static final List<Friend> _mockFriends = [
    Friend(
      id: 'f1',
      name: 'Sarah',
      phone: '13900000000',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      relation: 'Partner',
      daysConnected: 1314,
      lastActive: 'Just now',
      isMonitored: true,
      location: const FriendLocation(
        latitude: 39.9042,
        longitude: 116.4074,
        address: 'Near Palace Museum',
      ),
      health: const FriendHealth(steps: 8432, heartRate: 78, temperature: 36.5),
      device: const FriendDevice(network: '5G', unlocks: 42, usageTime: '4h 15m'),
    ),
    Friend(
      id: 'f2',
      name: 'Mom',
      phone: '13700000000',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mom',
      relation: 'Parent',
      daysConnected: 520,
      lastActive: '10 min ago',
      isMonitored: false,
      location: const FriendLocation(
        latitude: 39.9142,
        longitude: 116.4174,
        address: 'Home',
      ),
      health: const FriendHealth(steps: 1200, heartRate: 82, temperature: 36.6),
      device: const FriendDevice(network: 'WiFi', unlocks: 10, usageTime: '1h'),
    ),
  ];
}
