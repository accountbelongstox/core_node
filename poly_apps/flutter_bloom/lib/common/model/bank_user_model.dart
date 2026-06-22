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

import 'dart:convert';

/// Bank User Data Model
/// Contains all user-specific data for the banking application
class BankUserModel {
  final String name;
  final String location;
  final double balance;
  final int cardCount;
  final int points;
  final int coupons;
  final String creditCardLevel;
  final DateTime lastLoginTime;
  final DateTime createdAt;
  final DateTime updatedAt;

  BankUserModel({
    required this.name,
    required this.location,
    required this.balance,
    required this.cardCount,
    required this.points,
    required this.coupons,
    required this.creditCardLevel,
    required this.lastLoginTime,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Create default user data
  factory BankUserModel.defaultUser() {
    final now = DateTime.now();
    return BankUserModel(
      name: '李志刚',
      location: '北京',
      balance: 100000000.0,
      cardCount: 3,
      points: 8888,
      coupons: 12,
      creditCardLevel: '15',
      lastLoginTime: now,
      createdAt: now,
      updatedAt: now,
    );
  }

  /// Get masked name (first character replaced with *)
  String get maskedName {
    if (name.isEmpty) return '';
    if (name.length == 1) return '*';
    return '*${name.substring(1)}';
  }

  /// Format balance for display
  String get formattedBalance {
    // Always show exact balance with 2 decimal places
    return '¥ ${balance.toStringAsFixed(2).replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]},',
    )}';
  }

  /// Format balance for exact display
  String get exactFormattedBalance {
    return '¥ ${balance.toStringAsFixed(2).replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]},',
    )}';
  }

  /// Copy with new values
  BankUserModel copyWith({
    String? name,
    String? location,
    double? balance,
    int? cardCount,
    int? points,
    int? coupons,
    String? creditCardLevel,
    DateTime? lastLoginTime,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return BankUserModel(
      name: name ?? this.name,
      location: location ?? this.location,
      balance: balance ?? this.balance,
      cardCount: cardCount ?? this.cardCount,
      points: points ?? this.points,
      coupons: coupons ?? this.coupons,
      creditCardLevel: creditCardLevel ?? this.creditCardLevel,
      lastLoginTime: lastLoginTime ?? this.lastLoginTime,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'location': location,
      'balance': balance,
      'cardCount': cardCount,
      'points': points,
      'coupons': coupons,
      'creditCardLevel': creditCardLevel,
      'lastLoginTime': lastLoginTime.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  /// Create from JSON
  factory BankUserModel.fromJson(Map<String, dynamic> json) {
    return BankUserModel(
      name: json['name'] ?? '',
      location: json['location'] ?? '',
      balance: (json['balance'] ?? 0.0).toDouble(),
      cardCount: json['cardCount'] ?? 0,
      points: json['points'] ?? 0,
      coupons: json['coupons'] ?? 0,
      creditCardLevel: json['creditCardLevel'] ?? '',
      lastLoginTime: DateTime.parse(json['lastLoginTime'] ?? DateTime.now().toIso8601String()),
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  /// Convert to JSON string
  String toJsonString() {
    return jsonEncode(toJson());
  }

  /// Create from JSON string
  factory BankUserModel.fromJsonString(String jsonString) {
    return BankUserModel.fromJson(jsonDecode(jsonString));
  }

  @override
  String toString() {
    return 'BankUserModel(name: $name, location: $location, balance: $balance, cardCount: $cardCount, points: $points, coupons: $coupons, creditCardLevel: $creditCardLevel)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is BankUserModel &&
        other.name == name &&
        other.location == location &&
        other.balance == balance &&
        other.cardCount == cardCount &&
        other.points == points &&
        other.coupons == coupons &&
        other.creditCardLevel == creditCardLevel;
  }

  @override
  int get hashCode {
    return Object.hash(
      name,
      location,
      balance,
      cardCount,
      points,
      coupons,
      creditCardLevel,
    );
  }
}

/// Bank App Global Data Model
/// Contains dynamic global data that changes during app usage
class BankGlobalData {
  final DateTime appStartTime;
  final DateTime lastActiveTime;
  final int sessionCount;
  final String appVersion;
  final Map<String, dynamic> dynamicData;

  BankGlobalData({
    required this.appStartTime,
    required this.lastActiveTime,
    required this.sessionCount,
    required this.appVersion,
    required this.dynamicData,
  });

  /// Create default global data
  factory BankGlobalData.defaultData() {
    final now = DateTime.now();
    return BankGlobalData(
      appStartTime: now,
      lastActiveTime: now,
      sessionCount: 1,
      appVersion: '1.0.0',
      dynamicData: {},
    );
  }

  /// Copy with new values
  BankGlobalData copyWith({
    DateTime? appStartTime,
    DateTime? lastActiveTime,
    int? sessionCount,
    String? appVersion,
    Map<String, dynamic>? dynamicData,
  }) {
    return BankGlobalData(
      appStartTime: appStartTime ?? this.appStartTime,
      lastActiveTime: lastActiveTime ?? this.lastActiveTime,
      sessionCount: sessionCount ?? this.sessionCount,
      appVersion: appVersion ?? this.appVersion,
      dynamicData: dynamicData ?? Map.from(this.dynamicData),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'appStartTime': appStartTime.toIso8601String(),
      'lastActiveTime': lastActiveTime.toIso8601String(),
      'sessionCount': sessionCount,
      'appVersion': appVersion,
      'dynamicData': dynamicData,
    };
  }

  /// Create from JSON
  factory BankGlobalData.fromJson(Map<String, dynamic> json) {
    return BankGlobalData(
      appStartTime: DateTime.parse(json['appStartTime'] ?? DateTime.now().toIso8601String()),
      lastActiveTime: DateTime.parse(json['lastActiveTime'] ?? DateTime.now().toIso8601String()),
      sessionCount: json['sessionCount'] ?? 1,
      appVersion: json['appVersion'] ?? '1.0.0',
      dynamicData: Map<String, dynamic>.from(json['dynamicData'] ?? {}),
    );
  }

  /// Convert to JSON string
  String toJsonString() {
    return jsonEncode(toJson());
  }

  /// Create from JSON string
  factory BankGlobalData.fromJsonString(String jsonString) {
    return BankGlobalData.fromJson(jsonDecode(jsonString));
  }
}
