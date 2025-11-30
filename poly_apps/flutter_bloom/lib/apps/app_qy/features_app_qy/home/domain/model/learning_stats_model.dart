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

/// Learning statistics model for QY App
library;

class LearningStatsModel {
  final int totalWords;
  final int learnedWords;
  final double learnedPercentage;
  final int newWordsToday;
  final int newWordsTarget;
  final int reviewWordsToday;
  final int reviewWordsTarget;
  final int checkInDays;
  final int studyDays;
  final Map<String, dynamic>? additionalStats;

  const LearningStatsModel({
    required this.totalWords,
    required this.learnedWords,
    required this.learnedPercentage,
    required this.newWordsToday,
    required this.newWordsTarget,
    required this.reviewWordsToday,
    required this.reviewWordsTarget,
    required this.checkInDays,
    required this.studyDays,
    this.additionalStats,
  });

  factory LearningStatsModel.fromJson(Map<String, dynamic> json) {
    return LearningStatsModel(
      totalWords: json['total_words'] as int? ?? 0,
      learnedWords: json['learned_words'] as int? ?? 0,
      learnedPercentage: (json['learned_percentage'] as num?)?.toDouble() ?? 0.0,
      newWordsToday: json['new_words_today'] as int? ?? 0,
      newWordsTarget: json['new_words_target'] as int? ?? 200,
      reviewWordsToday: json['review_words_today'] as int? ?? 0,
      reviewWordsTarget: json['review_words_target'] as int? ?? 0,
      checkInDays: json['check_in_days'] as int? ?? 0,
      studyDays: json['study_days'] as int? ?? 0,
      additionalStats: json['additional_stats'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'total_words': totalWords,
      'learned_words': learnedWords,
      'learned_percentage': learnedPercentage,
      'new_words_today': newWordsToday,
      'new_words_target': newWordsTarget,
      'review_words_today': reviewWordsToday,
      'review_words_target': reviewWordsTarget,
      'check_in_days': checkInDays,
      'study_days': studyDays,
      'additional_stats': additionalStats,
    };
  }

  LearningStatsModel copyWith({
    int? totalWords,
    int? learnedWords,
    double? learnedPercentage,
    int? newWordsToday,
    int? newWordsTarget,
    int? reviewWordsToday,
    int? reviewWordsTarget,
    int? checkInDays,
    int? studyDays,
    Map<String, dynamic>? additionalStats,
  }) {
    return LearningStatsModel(
      totalWords: totalWords ?? this.totalWords,
      learnedWords: learnedWords ?? this.learnedWords,
      learnedPercentage: learnedPercentage ?? this.learnedPercentage,
      newWordsToday: newWordsToday ?? this.newWordsToday,
      newWordsTarget: newWordsTarget ?? this.newWordsTarget,
      reviewWordsToday: reviewWordsToday ?? this.reviewWordsToday,
      reviewWordsTarget: reviewWordsTarget ?? this.reviewWordsTarget,
      checkInDays: checkInDays ?? this.checkInDays,
      studyDays: studyDays ?? this.studyDays,
      additionalStats: additionalStats ?? this.additionalStats,
    );
  }

  static LearningStatsModel empty() {
    return const LearningStatsModel(
      totalWords: 16952,
      learnedWords: 27,
      learnedPercentage: 0.1,
      newWordsToday: 0,
      newWordsTarget: 200,
      reviewWordsToday: 0,
      reviewWordsTarget: 27,
      checkInDays: 0,
      studyDays: 0,
    );
  }
}
