import 'package:flutter/foundation.dart';

class UserModelAppQy extends ChangeNotifier {
  String? id;
  String? username;
  String? email;
  String? phoneNumber;
  String? avatar;
  String? displayName;
  String? provider;
  
  List<String> learningLanguages;
  String? nativeLanguage;
  
  int totalWords;
  int learnedWords;
  int masteredWords;
  int reviewDueWords;
  int todayNewWords;
  int todayReviewWords;
  double learningProgress;
  int studyDays;
  int consecutiveCheckInDays;
  int badges;
  bool isVip;
  DateTime? vipExpireDate;
  
  Map<String, dynamic>? vocabularyCollections;
  Map<String, dynamic>? wordGroups;
  Map<String, dynamic>? learningStats;
  
  DateTime? createdAt;
  DateTime? lastLoginAt;
  DateTime? lastStudyAt;
  Map<String, dynamic>? settings;
  Map<String, dynamic>? preferences;
  Map<String, dynamic>? stats;

  UserModelAppQy({
    this.id,
    this.username,
    this.email,
    this.phoneNumber,
    this.avatar,
    this.displayName,
    this.provider,
    this.learningLanguages = const ['en'],
    this.nativeLanguage = 'zh',
    this.totalWords = 0,
    this.learnedWords = 0,
    this.masteredWords = 0,
    this.reviewDueWords = 0,
    this.todayNewWords = 0,
    this.todayReviewWords = 0,
    this.learningProgress = 0.0,
    this.studyDays = 0,
    this.consecutiveCheckInDays = 0,
    this.badges = 0,
    this.isVip = false,
    this.vipExpireDate,
    this.vocabularyCollections,
    this.wordGroups,
    this.learningStats,
    this.createdAt,
    this.lastLoginAt,
    this.lastStudyAt,
    this.settings,
    this.preferences,
    this.stats,
  });

  factory UserModelAppQy.fromJson(Map<String, dynamic> json) {
    final userData = json['user'] ?? json;
    
    List<String> parseLearningLanguages(dynamic data) {
      if (data == null) return ['en'];
      if (data is List) {
        return data.map((e) => e.toString()).toList();
      }
      return ['en'];
    }
    
    Map<String, dynamic>? parseMap(dynamic data) {
      if (data == null) return null;
      if (data is Map) return Map<String, dynamic>.from(data);
      return null;
    }
    
    DateTime? parseDateTime(dynamic data) {
      if (data == null) return null;
      if (data is String) {
        try {
          return DateTime.parse(data);
        } catch (e) {
          return null;
        }
      }
      return null;
    }
    
    final stats = parseMap(userData['stats'] ?? userData['learning_stats']);
    final totalWords = stats?['total_words'] ?? userData['total_words'] ?? 0;
    final learnedWords = stats?['learned_words'] ?? userData['learned_words'] ?? 0;
    final masteredWords = stats?['mastered_words'] ?? userData['mastered_words'] ?? 0;
    final reviewDueWords = stats?['review_due_words'] ?? userData['review_due_words'] ?? 0;
    
    return UserModelAppQy(
      id: userData['id']?.toString(),
      username: userData['username']?.toString(),
      email: userData['email']?.toString(),
      phoneNumber: userData['phone']?.toString() ?? userData['phone_number']?.toString(),
      avatar: userData['avatar']?.toString(),
      displayName: userData['display_name']?.toString() ?? userData['displayName']?.toString(),
      provider: userData['provider']?.toString(),
      learningLanguages: parseLearningLanguages(
        userData['learning_languages'] ?? userData['learningLanguages'],
      ),
      nativeLanguage: userData['native_language']?.toString() ?? 
                      userData['nativeLanguage']?.toString() ?? 'zh',
      totalWords: (totalWords is int) ? totalWords : (totalWords is num ? totalWords.toInt() : 0),
      learnedWords: (learnedWords is int) ? learnedWords : (learnedWords is num ? learnedWords.toInt() : 0),
      masteredWords: (masteredWords is int) ? masteredWords : (masteredWords is num ? masteredWords.toInt() : 0),
      reviewDueWords: (reviewDueWords is int) ? reviewDueWords : (reviewDueWords is num ? reviewDueWords.toInt() : 0),
      todayNewWords: (userData['today_new_words'] ?? userData['todayNewWords'] ?? 0) as int? ?? 0,
      todayReviewWords: (userData['today_review_words'] ?? userData['todayReviewWords'] ?? 0) as int? ?? 0,
      learningProgress: (userData['learning_progress'] ?? userData['learningProgress'] ?? 0.0) as double? ?? 0.0,
      studyDays: (userData['study_days'] ?? userData['studyDays'] ?? 0) as int? ?? 0,
      consecutiveCheckInDays: (userData['consecutive_check_in_days'] ?? 
                                userData['consecutiveCheckInDays'] ?? 
                                userData['streak_days'] ?? 0) as int? ?? 0,
      badges: (userData['badges'] ?? 0) as int? ?? 0,
      isVip: (userData['is_vip'] ?? userData['isVip'] ?? false) as bool? ?? false,
      vipExpireDate: parseDateTime(userData['vip_expire_date'] ?? userData['vipExpireDate']),
      vocabularyCollections: parseMap(userData['vocabulary_collections'] ?? userData['vocabularyCollections']),
      wordGroups: parseMap(userData['word_groups'] ?? userData['wordGroups']),
      learningStats: stats,
      createdAt: parseDateTime(userData['created_at'] ?? userData['createdAt']),
      lastLoginAt: parseDateTime(userData['last_login_at'] ?? userData['lastLoginAt']),
      lastStudyAt: parseDateTime(userData['last_study_at'] ?? userData['lastStudyAt']),
      settings: parseMap(userData['settings']),
      preferences: parseMap(userData['preferences']),
      stats: stats,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'phone_number': phoneNumber,
      'phone': phoneNumber,
      'avatar': avatar,
      'display_name': displayName,
      'displayName': displayName,
      'provider': provider,
      'learning_languages': learningLanguages,
      'learningLanguages': learningLanguages,
      'native_language': nativeLanguage,
      'nativeLanguage': nativeLanguage,
      'total_words': totalWords,
      'totalWords': totalWords,
      'learned_words': learnedWords,
      'learnedWords': learnedWords,
      'mastered_words': masteredWords,
      'masteredWords': masteredWords,
      'review_due_words': reviewDueWords,
      'reviewDueWords': reviewDueWords,
      'today_new_words': todayNewWords,
      'todayNewWords': todayNewWords,
      'today_review_words': todayReviewWords,
      'todayReviewWords': todayReviewWords,
      'learning_progress': learningProgress,
      'learningProgress': learningProgress,
      'study_days': studyDays,
      'studyDays': studyDays,
      'consecutive_check_in_days': consecutiveCheckInDays,
      'consecutiveCheckInDays': consecutiveCheckInDays,
      'streak_days': consecutiveCheckInDays,
      'badges': badges,
      'is_vip': isVip,
      'isVip': isVip,
      'vip_expire_date': vipExpireDate?.toIso8601String(),
      'vipExpireDate': vipExpireDate?.toIso8601String(),
      'vocabulary_collections': vocabularyCollections,
      'vocabularyCollections': vocabularyCollections,
      'word_groups': wordGroups,
      'wordGroups': wordGroups,
      'learning_stats': learningStats,
      'learningStats': learningStats,
      'created_at': createdAt?.toIso8601String(),
      'createdAt': createdAt?.toIso8601String(),
      'last_login_at': lastLoginAt?.toIso8601String(),
      'lastLoginAt': lastLoginAt?.toIso8601String(),
      'last_study_at': lastStudyAt?.toIso8601String(),
      'lastStudyAt': lastStudyAt?.toIso8601String(),
      'settings': settings,
      'preferences': preferences,
      'stats': stats ?? learningStats,
    };
  }

  UserModelAppQy copyWith({
    String? id,
    String? username,
    String? email,
    String? phoneNumber,
    String? avatar,
    String? displayName,
    String? provider,
    List<String>? learningLanguages,
    String? nativeLanguage,
    int? totalWords,
    int? learnedWords,
    int? masteredWords,
    int? reviewDueWords,
    int? todayNewWords,
    int? todayReviewWords,
    double? learningProgress,
    int? studyDays,
    int? consecutiveCheckInDays,
    int? badges,
    bool? isVip,
    DateTime? vipExpireDate,
    Map<String, dynamic>? vocabularyCollections,
    Map<String, dynamic>? wordGroups,
    Map<String, dynamic>? learningStats,
    DateTime? createdAt,
    DateTime? lastLoginAt,
    DateTime? lastStudyAt,
    Map<String, dynamic>? settings,
    Map<String, dynamic>? preferences,
    Map<String, dynamic>? stats,
  }) {
    return UserModelAppQy(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      avatar: avatar ?? this.avatar,
      displayName: displayName ?? this.displayName,
      provider: provider ?? this.provider,
      learningLanguages: learningLanguages ?? this.learningLanguages,
      nativeLanguage: nativeLanguage ?? this.nativeLanguage,
      totalWords: totalWords ?? this.totalWords,
      learnedWords: learnedWords ?? this.learnedWords,
      masteredWords: masteredWords ?? this.masteredWords,
      reviewDueWords: reviewDueWords ?? this.reviewDueWords,
      todayNewWords: todayNewWords ?? this.todayNewWords,
      todayReviewWords: todayReviewWords ?? this.todayReviewWords,
      learningProgress: learningProgress ?? this.learningProgress,
      studyDays: studyDays ?? this.studyDays,
      consecutiveCheckInDays: consecutiveCheckInDays ?? this.consecutiveCheckInDays,
      badges: badges ?? this.badges,
      isVip: isVip ?? this.isVip,
      vipExpireDate: vipExpireDate ?? this.vipExpireDate,
      vocabularyCollections: vocabularyCollections ?? this.vocabularyCollections,
      wordGroups: wordGroups ?? this.wordGroups,
      learningStats: learningStats ?? this.learningStats,
      createdAt: createdAt ?? this.createdAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      lastStudyAt: lastStudyAt ?? this.lastStudyAt,
      settings: settings ?? this.settings,
      preferences: preferences ?? this.preferences,
      stats: stats ?? this.stats,
    );
  }

  static UserModelAppQy empty() {
    return UserModelAppQy(
      id: null,
      username: null,
      email: null,
      phoneNumber: null,
      avatar: null,
      displayName: 'Guest',
      provider: null,
      learningLanguages: ['en'],
      nativeLanguage: 'zh',
      totalWords: 0,
      learnedWords: 0,
      masteredWords: 0,
      reviewDueWords: 0,
      todayNewWords: 0,
      todayReviewWords: 0,
      learningProgress: 0.0,
      studyDays: 0,
      consecutiveCheckInDays: 0,
      badges: 0,
      isVip: false,
    );
  }

  void updateFrom(UserModelAppQy other) {
    id = other.id;
    username = other.username;
    email = other.email;
    phoneNumber = other.phoneNumber;
    avatar = other.avatar;
    displayName = other.displayName;
    provider = other.provider;
    learningLanguages = other.learningLanguages;
    nativeLanguage = other.nativeLanguage;
    totalWords = other.totalWords;
    learnedWords = other.learnedWords;
    masteredWords = other.masteredWords;
    reviewDueWords = other.reviewDueWords;
    todayNewWords = other.todayNewWords;
    todayReviewWords = other.todayReviewWords;
    learningProgress = other.learningProgress;
    studyDays = other.studyDays;
    consecutiveCheckInDays = other.consecutiveCheckInDays;
    badges = other.badges;
    isVip = other.isVip;
    vipExpireDate = other.vipExpireDate;
    vocabularyCollections = other.vocabularyCollections;
    wordGroups = other.wordGroups;
    learningStats = other.learningStats;
    createdAt = other.createdAt;
    lastLoginAt = other.lastLoginAt;
    lastStudyAt = other.lastStudyAt;
    settings = other.settings;
    preferences = other.preferences;
    stats = other.stats;
    notifyListeners();
  }

  bool get isLoggedIn => id != null && id!.isNotEmpty;

  String get progressPercentage {
    if (totalWords == 0) return '0.0';
    final percentage = (learnedWords / totalWords) * 100;
    return percentage.toStringAsFixed(1);
  }
  
  String get masteryPercentage {
    if (totalWords == 0) return '0.0';
    final percentage = (masteredWords / totalWords) * 100;
    return percentage.toStringAsFixed(1);
  }
  
  String get name => displayName ?? username ?? 'Guest';
}
