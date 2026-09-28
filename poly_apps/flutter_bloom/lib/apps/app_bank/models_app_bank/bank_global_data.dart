/// Bank global data model for app-wide settings and metadata
class BankGlobalData {
  final DateTime lastActiveTime;
  final int sessionCount;
  final String appVersion;
  final Map<String, dynamic> settings;
  final Map<String, dynamic> metadata;

  // Global state data
  final String? location;
  final String? city;
  final double? balance;
  final String? username;
  final String? fullName;
  final int? points;
  final int? coupons;
  final String? creditCardLevel;

  const BankGlobalData({
    required this.lastActiveTime,
    this.sessionCount = 0,
    this.appVersion = '1.0.0',
    this.settings = const {},
    this.metadata = const {},
    this.location,
    this.city,
    this.balance,
    this.username,
    this.fullName,
    this.points,
    this.coupons,
    this.creditCardLevel,
  });

  factory BankGlobalData.defaultData() {
    return BankGlobalData(
      lastActiveTime: DateTime.now(),
      sessionCount: 0,
      appVersion: '1.0.0',
      settings: {
        'theme': 'light',
        'language': 'zh_CN',
        'notifications_enabled': true,
        'biometric_enabled': false,
      },
      metadata: {
        'first_launch': DateTime.now().toIso8601String(),
        'device_info': {},
      },
    );
  }

  BankGlobalData copyWith({
    DateTime? lastActiveTime,
    int? sessionCount,
    String? appVersion,
    Map<String, dynamic>? settings,
    Map<String, dynamic>? metadata,
    String? location,
    String? city,
    double? balance,
    String? username,
    String? fullName,
    int? points,
    int? coupons,
    String? creditCardLevel,
  }) {
    return BankGlobalData(
      lastActiveTime: lastActiveTime ?? this.lastActiveTime,
      sessionCount: sessionCount ?? this.sessionCount,
      appVersion: appVersion ?? this.appVersion,
      settings: settings ?? this.settings,
      metadata: metadata ?? this.metadata,
      location: location ?? this.location,
      city: city ?? this.city,
      balance: balance ?? this.balance,
      username: username ?? this.username,
      fullName: fullName ?? this.fullName,
      points: points ?? this.points,
      coupons: coupons ?? this.coupons,
      creditCardLevel: creditCardLevel ?? this.creditCardLevel,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'last_active_time': lastActiveTime.toIso8601String(),
      'session_count': sessionCount,
      'app_version': appVersion,
      'settings': settings,
      'metadata': metadata,
      'location': location,
      'city': city,
      'balance': balance,
      'username': username,
      'full_name': fullName,
      'points': points,
      'coupons': coupons,
      'credit_card_level': creditCardLevel,
    };
  }

  factory BankGlobalData.fromMap(Map<String, dynamic> map) {
    return BankGlobalData(
      lastActiveTime: DateTime.parse(map['last_active_time']),
      sessionCount: map['session_count'] ?? 0,
      appVersion: map['app_version'] ?? '1.0.0',
      settings: Map<String, dynamic>.from(map['settings'] ?? {}),
      metadata: Map<String, dynamic>.from(map['metadata'] ?? {}),
      location: map['location'] as String?,
      city: map['city'] as String?,
      balance: map['balance'] != null ? (map['balance'] as num).toDouble() : null,
      username: map['username'] as String?,
      fullName: map['full_name'] as String?,
      points: map['points'] as int?,
      coupons: map['coupons'] as int?,
      creditCardLevel: map['credit_card_level'] as String?,
    );
  }

  String toJsonString() {
    return toMap().toString();
  }

  factory BankGlobalData.fromJsonString(String jsonString) {
    // This is a simplified implementation
    // In a real app, you'd use proper JSON parsing
    return BankGlobalData.defaultData();
  }
}
