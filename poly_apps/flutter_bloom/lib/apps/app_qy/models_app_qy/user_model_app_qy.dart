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

/// User model for QY App
library;

class UserModelAppQy {
  final String? id;
  final String? username;
  final String? email;
  final String? phoneNumber;
  final String? avatar;
  final String? displayName;
  final int? totalWords;
  final int? learnedWords;
  final int? todayNewWords;
  final int? todayReviewWords;
  final double? learningProgress;
  final int? studyDays;
  final int? consecutiveCheckInDays;
  final int? badges;
  final bool? isVip;
  final DateTime? vipExpireDate;
  final DateTime? createdAt;
  final DateTime? lastLoginAt;
  final Map<String, dynamic>? settings;
  final Map<String, dynamic>? stats;

  const UserModelAppQy({
    this.id,
    this.username,
    this.email,
    this.phoneNumber,
    this.avatar,
    this.displayName,
    this.totalWords,
    this.learnedWords,
    this.todayNewWords,
    this.todayReviewWords,
    this.learningProgress,
    this.studyDays,
    this.consecutiveCheckInDays,
    this.badges,
    this.isVip,
    this.vipExpireDate,
    this.createdAt,
    this.lastLoginAt,
    this.settings,
    this.stats,
  });

  factory UserModelAppQy.fromJson(Map<String, dynamic> json) {
    return UserModelAppQy(
      id: json['id'] as String?,
      username: json['username'] as String?,
      email: json['email'] as String?,
      phoneNumber: json['phone_number'] as String?,
      avatar: json['avatar'] as String?,
      displayName: json['display_name'] as String?,
      totalWords: json['total_words'] as int?,
      learnedWords: json['learned_words'] as int?,
      todayNewWords: json['today_new_words'] as int?,
      todayReviewWords: json['today_review_words'] as int?,
      learningProgress: (json['learning_progress'] as num?)?.toDouble(),
      studyDays: json['study_days'] as int?,
      consecutiveCheckInDays: json['consecutive_check_in_days'] as int?,
      badges: json['badges'] as int?,
      isVip: json['is_vip'] as bool?,
      vipExpireDate: json['vip_expire_date'] != null
          ? DateTime.parse(json['vip_expire_date'] as String)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      lastLoginAt: json['last_login_at'] != null
          ? DateTime.parse(json['last_login_at'] as String)
          : null,
      settings: json['settings'] as Map<String, dynamic>?,
      stats: json['stats'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'phone_number': phoneNumber,
      'avatar': avatar,
      'display_name': displayName,
      'total_words': totalWords,
      'learned_words': learnedWords,
      'today_new_words': todayNewWords,
      'today_review_words': todayReviewWords,
      'learning_progress': learningProgress,
      'study_days': studyDays,
      'consecutive_check_in_days': consecutiveCheckInDays,
      'badges': badges,
      'is_vip': isVip,
      'vip_expire_date': vipExpireDate?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
      'last_login_at': lastLoginAt?.toIso8601String(),
      'settings': settings,
      'stats': stats,
    };
  }

  UserModelAppQy copyWith({
    String? id,
    String? username,
    String? email,
    String? phoneNumber,
    String? avatar,
    String? displayName,
    int? totalWords,
    int? learnedWords,
    int? todayNewWords,
    int? todayReviewWords,
    double? learningProgress,
    int? studyDays,
    int? consecutiveCheckInDays,
    int? badges,
    bool? isVip,
    DateTime? vipExpireDate,
    DateTime? createdAt,
    DateTime? lastLoginAt,
    Map<String, dynamic>? settings,
    Map<String, dynamic>? stats,
  }) {
    return UserModelAppQy(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      avatar: avatar ?? this.avatar,
      displayName: displayName ?? this.displayName,
      totalWords: totalWords ?? this.totalWords,
      learnedWords: learnedWords ?? this.learnedWords,
      todayNewWords: todayNewWords ?? this.todayNewWords,
      todayReviewWords: todayReviewWords ?? this.todayReviewWords,
      learningProgress: learningProgress ?? this.learningProgress,
      studyDays: studyDays ?? this.studyDays,
      consecutiveCheckInDays:
          consecutiveCheckInDays ?? this.consecutiveCheckInDays,
      badges: badges ?? this.badges,
      isVip: isVip ?? this.isVip,
      vipExpireDate: vipExpireDate ?? this.vipExpireDate,
      createdAt: createdAt ?? this.createdAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      settings: settings ?? this.settings,
      stats: stats ?? this.stats,
    );
  }

  static UserModelAppQy empty() {
    return const UserModelAppQy(
      id: null,
      username: null,
      email: null,
      phoneNumber: null,
      avatar: null,
      displayName: 'Guest',
      totalWords: 0,
      learnedWords: 0,
      todayNewWords: 0,
      todayReviewWords: 0,
      learningProgress: 0.0,
      studyDays: 0,
      consecutiveCheckInDays: 0,
      badges: 0,
      isVip: false,
    );
  }

  bool get isLoggedIn => id != null && id!.isNotEmpty;

  String get progressPercentage {
    if (totalWords == null || totalWords == 0) return '0.0';
    if (learnedWords == null) return '0.0';
    final percentage = (learnedWords! / totalWords!) * 100;
    return percentage.toStringAsFixed(1);
  }
}
