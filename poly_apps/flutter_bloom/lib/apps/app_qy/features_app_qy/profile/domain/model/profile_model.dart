// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

library;

class UserProfileModel {
  final String id;
  final String nickname;
  final String? avatar;
  final String? email;
  final String? phone;
  final int totalWords;
  final int learnedWords;
  final int studyDays;
  final int checkInDays;
  final bool isVip;
  final DateTime? vipExpireDate;
  final DateTime createdAt;
  final DateTime? lastLoginAt;

  const UserProfileModel({
    required this.id,
    required this.nickname,
    this.avatar,
    this.email,
    this.phone,
    required this.totalWords,
    required this.learnedWords,
    required this.studyDays,
    required this.checkInDays,
    required this.isVip,
    this.vipExpireDate,
    required this.createdAt,
    this.lastLoginAt,
  });

  factory UserProfileModel.fromJson(Map<String, dynamic> json) {
    return UserProfileModel(
      id: json['id'] as String,
      nickname: json['nickname'] as String,
      avatar: json['avatar'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      totalWords: json['total_words'] as int? ?? 0,
      learnedWords: json['learned_words'] as int? ?? 0,
      studyDays: json['study_days'] as int? ?? 0,
      checkInDays: json['check_in_days'] as int? ?? 0,
      isVip: json['is_vip'] as bool? ?? false,
      vipExpireDate: json['vip_expire_date'] != null
          ? DateTime.parse(json['vip_expire_date'] as String)
          : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      lastLoginAt: json['last_login_at'] != null
          ? DateTime.parse(json['last_login_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nickname': nickname,
      'avatar': avatar,
      'email': email,
      'phone': phone,
      'total_words': totalWords,
      'learned_words': learnedWords,
      'study_days': studyDays,
      'check_in_days': checkInDays,
      'is_vip': isVip,
      'vip_expire_date': vipExpireDate?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
      'last_login_at': lastLoginAt?.toIso8601String(),
    };
  }

  UserProfileModel copyWith({
    String? id,
    String? nickname,
    String? avatar,
    String? email,
    String? phone,
    int? totalWords,
    int? learnedWords,
    int? studyDays,
    int? checkInDays,
    bool? isVip,
    DateTime? vipExpireDate,
    DateTime? createdAt,
    DateTime? lastLoginAt,
  }) {
    return UserProfileModel(
      id: id ?? this.id,
      nickname: nickname ?? this.nickname,
      avatar: avatar ?? this.avatar,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      totalWords: totalWords ?? this.totalWords,
      learnedWords: learnedWords ?? this.learnedWords,
      studyDays: studyDays ?? this.studyDays,
      checkInDays: checkInDays ?? this.checkInDays,
      isVip: isVip ?? this.isVip,
      vipExpireDate: vipExpireDate ?? this.vipExpireDate,
      createdAt: createdAt ?? this.createdAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
    );
  }

  static UserProfileModel mock() {
    return UserProfileModel(
      id: '123456789',
      nickname: 'QY User',
      avatar: null,
      email: 'user@example.com',
      phone: '138****8888',
      totalWords: 5000,
      learnedWords: 1234,
      studyDays: 45,
      checkInDays: 30,
      isVip: true,
      vipExpireDate: DateTime.now().add(const Duration(days: 365)),
      createdAt: DateTime.now().subtract(const Duration(days: 100)),
      lastLoginAt: DateTime.now(),
    );
  }
}

class CertificateModel {
  final String id;
  final String title;
  final String description;
  final String? imageUrl;
  final DateTime issuedAt;
  final String category;
  final int score;
  final String certificateNumber;

  const CertificateModel({
    required this.id,
    required this.title,
    required this.description,
    this.imageUrl,
    required this.issuedAt,
    required this.category,
    required this.score,
    required this.certificateNumber,
  });

  factory CertificateModel.fromJson(Map<String, dynamic> json) {
    return CertificateModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      imageUrl: json['image_url'] as String?,
      issuedAt: DateTime.parse(json['issued_at'] as String),
      category: json['category'] as String,
      score: json['score'] as int? ?? 0,
      certificateNumber: json['certificate_number'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'image_url': imageUrl,
      'issued_at': issuedAt.toIso8601String(),
      'category': category,
      'score': score,
      'certificate_number': certificateNumber,
    };
  }
}

class AchievementModel {
  final String id;
  final String title;
  final String description;
  final String iconUrl;
  final bool isUnlocked;
  final DateTime? unlockedAt;
  final int progress;
  final int target;

  const AchievementModel({
    required this.id,
    required this.title,
    required this.description,
    required this.iconUrl,
    required this.isUnlocked,
    this.unlockedAt,
    required this.progress,
    required this.target,
  });

  factory AchievementModel.fromJson(Map<String, dynamic> json) {
    return AchievementModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      iconUrl: json['icon_url'] as String,
      isUnlocked: json['is_unlocked'] as bool? ?? false,
      unlockedAt: json['unlocked_at'] != null
          ? DateTime.parse(json['unlocked_at'] as String)
          : null,
      progress: json['progress'] as int? ?? 0,
      target: json['target'] as int? ?? 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'icon_url': iconUrl,
      'is_unlocked': isUnlocked,
      'unlocked_at': unlockedAt?.toIso8601String(),
      'progress': progress,
      'target': target,
    };
  }

  double get progressPercentage => target > 0 ? (progress / target) : 0.0;
}
