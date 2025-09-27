/// Bank global data model for app-wide settings and metadata
class BankGlobalData {
  final DateTime lastActiveTime;
  final int sessionCount;
  final String appVersion;
  final Map<String, dynamic> settings;
  final Map<String, dynamic> metadata;

  const BankGlobalData({
    required this.lastActiveTime,
    this.sessionCount = 0,
    this.appVersion = '1.0.0',
    this.settings = const {},
    this.metadata = const {},
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
  }) {
    return BankGlobalData(
      lastActiveTime: lastActiveTime ?? this.lastActiveTime,
      sessionCount: sessionCount ?? this.sessionCount,
      appVersion: appVersion ?? this.appVersion,
      settings: settings ?? this.settings,
      metadata: metadata ?? this.metadata,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'last_active_time': lastActiveTime.toIso8601String(),
      'session_count': sessionCount,
      'app_version': appVersion,
      'settings': settings,
      'metadata': metadata,
    };
  }

  factory BankGlobalData.fromMap(Map<String, dynamic> map) {
    return BankGlobalData(
      lastActiveTime: DateTime.parse(map['last_active_time']),
      sessionCount: map['session_count'] ?? 0,
      appVersion: map['app_version'] ?? '1.0.0',
      settings: Map<String, dynamic>.from(map['settings'] ?? {}),
      metadata: Map<String, dynamic>.from(map['metadata'] ?? {}),
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
