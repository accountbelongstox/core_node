import 'package:flutter/foundation.dart';
import '../config_app_qy/default_language_config_app_qy.dart';

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

  DateTime? createdAt;
  DateTime? lastLoginAt;
  DateTime? lastStudyAt;
  Map<String, dynamic>? settings;
  Map<String, dynamic>? preferences;

  // Unified stats - contains learning statistics
  Map<String, dynamic>? stats;

  // Initialization fields
  String? occupation;
  int? dailyWordsTarget;
  int? dailyStudyTime; // minutes
  DateTime? initializationCompletedAt;
  bool get isInitialized => initializationCompletedAt != null;

  UserModelAppQy({
    this.id,
    this.username,
    this.email,
    this.phoneNumber,
    this.avatar,
    this.displayName,
    this.provider,
    this.learningLanguages =
        DefaultLanguageConfigAppQy.defaultLearningLanguages,
    this.nativeLanguage = DefaultLanguageConfigAppQy.defaultNativeLanguage,
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
    this.createdAt,
    this.lastLoginAt,
    this.lastStudyAt,
    this.settings,
    this.preferences,
    this.stats,
    this.occupation,
    this.dailyWordsTarget,
    this.dailyStudyTime,
    this.initializationCompletedAt,
  });

  factory UserModelAppQy.fromJson(Map<String, dynamic> json) {
    final userData = json['user'] ?? json;

    List<String> parseLearningLanguages(dynamic data) {
      if (data == null)
        return DefaultLanguageConfigAppQy.defaultLearningLanguages;
      if (data is List) {
        return data.map((e) => e.toString()).toList();
      }
      return DefaultLanguageConfigAppQy.defaultLearningLanguages;
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

    // Parse stats from 'stats' key (new format only)
    final stats = parseMap(userData['stats']);

    // Extract learning statistics from stats map or top-level fields
    final totalWords = stats?['total_words'] ?? userData['total_words'] ?? 0;
    final learnedWords =
        stats?['learned_words'] ?? userData['learned_words'] ?? 0;
    final masteredWords =
        stats?['mastered_words'] ?? userData['mastered_words'] ?? 0;
    final reviewDueWords =
        stats?['review_due_words'] ?? userData['review_due_words'] ?? 0;

    return UserModelAppQy(
      id: userData['id']?.toString(),
      username: userData['username']?.toString(),
      email: userData['email']?.toString(),
      phoneNumber: userData['phone_number']?.toString(),
      avatar: userData['avatar']?.toString(),
      displayName: userData['display_name']?.toString(),
      provider: userData['provider']?.toString(),
      learningLanguages: parseLearningLanguages(userData['learning_languages']),
      nativeLanguage: userData['native_language']?.toString() ??
          DefaultLanguageConfigAppQy.defaultNativeLanguage,
      totalWords: (totalWords is int)
          ? totalWords
          : (totalWords is num ? totalWords.toInt() : 0),
      learnedWords: (learnedWords is int)
          ? learnedWords
          : (learnedWords is num ? learnedWords.toInt() : 0),
      masteredWords: (masteredWords is int)
          ? masteredWords
          : (masteredWords is num ? masteredWords.toInt() : 0),
      reviewDueWords: (reviewDueWords is int)
          ? reviewDueWords
          : (reviewDueWords is num ? reviewDueWords.toInt() : 0),
      todayNewWords: (userData['today_new_words'] ?? 0) as int? ?? 0,
      todayReviewWords: (userData['today_review_words'] ?? 0) as int? ?? 0,
      learningProgress:
          (userData['learning_progress'] ?? 0.0) as double? ?? 0.0,
      studyDays: (userData['study_days'] ?? 0) as int? ?? 0,
      consecutiveCheckInDays:
          (userData['consecutive_check_in_days'] ?? 0) as int? ?? 0,
      badges: (userData['badges'] ?? 0) as int? ?? 0,
      isVip: (userData['is_vip'] ?? false) as bool? ?? false,
      vipExpireDate: parseDateTime(userData['vip_expire_date']),
      vocabularyCollections: parseMap(userData['vocabulary_collections']),
      wordGroups: parseMap(userData['word_groups']),
      createdAt: parseDateTime(userData['created_at']),
      lastLoginAt: parseDateTime(userData['last_login_at']),
      lastStudyAt: parseDateTime(userData['last_study_at']),
      settings: parseMap(userData['settings']),
      preferences: parseMap(userData['preferences']),
      stats: stats,
      occupation: userData['occupation']?.toString(),
      dailyWordsTarget: userData['daily_words_target'] as int?,
      dailyStudyTime: userData['daily_study_time'] as int?,
      initializationCompletedAt:
          parseDateTime(userData['initialization_completed_at']),
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
      'provider': provider,
      'learning_languages': learningLanguages,
      'native_language': nativeLanguage,
      'total_words': totalWords,
      'learned_words': learnedWords,
      'mastered_words': masteredWords,
      'review_due_words': reviewDueWords,
      'today_new_words': todayNewWords,
      'today_review_words': todayReviewWords,
      'learning_progress': learningProgress,
      'study_days': studyDays,
      'consecutive_check_in_days': consecutiveCheckInDays,
      'badges': badges,
      'is_vip': isVip,
      'vip_expire_date': vipExpireDate?.toIso8601String(),
      'vocabulary_collections': vocabularyCollections,
      'word_groups': wordGroups,
      'created_at': createdAt?.toIso8601String(),
      'last_login_at': lastLoginAt?.toIso8601String(),
      'last_study_at': lastStudyAt?.toIso8601String(),
      'settings': settings,
      'preferences': preferences,
      'stats': stats,
      'occupation': occupation,
      'daily_words_target': dailyWordsTarget,
      'daily_study_time': dailyStudyTime,
      'initialization_completed_at':
          initializationCompletedAt?.toIso8601String(),
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
    DateTime? createdAt,
    DateTime? lastLoginAt,
    DateTime? lastStudyAt,
    Map<String, dynamic>? settings,
    Map<String, dynamic>? preferences,
    Map<String, dynamic>? stats,
    String? occupation,
    int? dailyWordsTarget,
    int? dailyStudyTime,
    DateTime? initializationCompletedAt,
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
      consecutiveCheckInDays:
          consecutiveCheckInDays ?? this.consecutiveCheckInDays,
      badges: badges ?? this.badges,
      isVip: isVip ?? this.isVip,
      vipExpireDate: vipExpireDate ?? this.vipExpireDate,
      vocabularyCollections:
          vocabularyCollections ?? this.vocabularyCollections,
      wordGroups: wordGroups ?? this.wordGroups,
      createdAt: createdAt ?? this.createdAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      lastStudyAt: lastStudyAt ?? this.lastStudyAt,
      settings: settings ?? this.settings,
      preferences: preferences ?? this.preferences,
      stats: stats ?? this.stats,
      occupation: occupation ?? this.occupation,
      dailyWordsTarget: dailyWordsTarget ?? this.dailyWordsTarget,
      dailyStudyTime: dailyStudyTime ?? this.dailyStudyTime,
      initializationCompletedAt:
          initializationCompletedAt ?? this.initializationCompletedAt,
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
      learningLanguages: DefaultLanguageConfigAppQy.defaultLearningLanguages,
      nativeLanguage: DefaultLanguageConfigAppQy.defaultNativeLanguage,
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
