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

/// Word model for QY App
library;

class WordModel {
  final String id;
  final String word;
  final String? phonetic;
  final String? audioUrl;
  final List<String> definitions;
  final List<String>? examples;
  final List<String>? synonyms;
  final String? difficulty;
  final bool isFavorite;
  final bool isLearned;
  final int reviewCount;
  final DateTime? lastReviewedAt;

  const WordModel({
    required this.id,
    required this.word,
    this.phonetic,
    this.audioUrl,
    required this.definitions,
    this.examples,
    this.synonyms,
    this.difficulty,
    this.isFavorite = false,
    this.isLearned = false,
    this.reviewCount = 0,
    this.lastReviewedAt,
  });

  factory WordModel.fromJson(Map<String, dynamic> json) {
    return WordModel(
      id: json['id'] as String,
      word: json['word'] as String,
      phonetic: json['phonetic'] as String?,
      audioUrl: json['audio_url'] as String?,
      definitions: (json['definitions'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      examples: (json['examples'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      synonyms: (json['synonyms'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      difficulty: json['difficulty'] as String?,
      isFavorite: json['is_favorite'] as bool? ?? false,
      isLearned: json['is_learned'] as bool? ?? false,
      reviewCount: json['review_count'] as int? ?? 0,
      lastReviewedAt: json['last_reviewed_at'] != null
          ? DateTime.parse(json['last_reviewed_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'word': word,
      'phonetic': phonetic,
      'audio_url': audioUrl,
      'definitions': definitions,
      'examples': examples,
      'synonyms': synonyms,
      'difficulty': difficulty,
      'is_favorite': isFavorite,
      'is_learned': isLearned,
      'review_count': reviewCount,
      'last_reviewed_at': lastReviewedAt?.toIso8601String(),
    };
  }

  WordModel copyWith({
    String? id,
    String? word,
    String? phonetic,
    String? audioUrl,
    List<String>? definitions,
    List<String>? examples,
    List<String>? synonyms,
    String? difficulty,
    bool? isFavorite,
    bool? isLearned,
    int? reviewCount,
    DateTime? lastReviewedAt,
  }) {
    return WordModel(
      id: id ?? this.id,
      word: word ?? this.word,
      phonetic: phonetic ?? this.phonetic,
      audioUrl: audioUrl ?? this.audioUrl,
      definitions: definitions ?? this.definitions,
      examples: examples ?? this.examples,
      synonyms: synonyms ?? this.synonyms,
      difficulty: difficulty ?? this.difficulty,
      isFavorite: isFavorite ?? this.isFavorite,
      isLearned: isLearned ?? this.isLearned,
      reviewCount: reviewCount ?? this.reviewCount,
      lastReviewedAt: lastReviewedAt ?? this.lastReviewedAt,
    );
  }
}

class WordBookModel {
  final String id;
  final String name;
  final String description;
  final int totalWords;
  final int learnedWords;
  final int remainingWords;
  final String? coverUrl;
  final String category;

  const WordBookModel({
    required this.id,
    required this.name,
    required this.description,
    required this.totalWords,
    required this.learnedWords,
    required this.remainingWords,
    this.coverUrl,
    required this.category,
  });

  factory WordBookModel.fromJson(Map<String, dynamic> json) {
    return WordBookModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      totalWords: json['total_words'] as int,
      learnedWords: json['learned_words'] as int? ?? 0,
      remainingWords: json['remaining_words'] as int? ?? 0,
      coverUrl: json['cover_url'] as String?,
      category: json['category'] as String? ?? 'general',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'total_words': totalWords,
      'learned_words': learnedWords,
      'remaining_words': remainingWords,
      'cover_url': coverUrl,
      'category': category,
    };
  }

  double get progress {
    if (totalWords == 0) return 0.0;
    return (learnedWords / totalWords) * 100;
  }
}
