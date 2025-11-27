class VocabularyCollectionModel {
  final int id;
  final String name;
  final String langCode;
  final int totalWords;
  final String? description;
  final bool isPublic;
  final bool isSelected;
  final int? ownerId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  VocabularyCollectionModel({
    required this.id,
    required this.name,
    required this.langCode,
    required this.totalWords,
    this.description,
    this.isPublic = true,
    this.isSelected = false,
    this.ownerId,
    this.createdAt,
    this.updatedAt,
  });

  factory VocabularyCollectionModel.fromJson(Map<String, dynamic> json) {
    return VocabularyCollectionModel(
      id: json['id'] ?? 0,
      name: json['name'] ?? json['collection_name'] ?? '',
      langCode: json['lang_code'] ?? 'en',
      totalWords: json['total_words'] ?? 0,
      description: json['description'],
      isPublic: json['is_public'] ?? true,
      isSelected: json['is_selected'] ?? false,
      ownerId: json['owner_id'],
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at']) 
          : null,
      updatedAt: json['updated_at'] != null 
          ? DateTime.tryParse(json['updated_at']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'lang_code': langCode,
    'total_words': totalWords,
    'description': description,
    'is_public': isPublic,
    'is_selected': isSelected,
    'owner_id': ownerId,
    'created_at': createdAt?.toIso8601String(),
    'updated_at': updatedAt?.toIso8601String(),
  };

  VocabularyCollectionModel copyWith({
    int? id,
    String? name,
    String? langCode,
    int? totalWords,
    String? description,
    bool? isPublic,
    bool? isSelected,
    int? ownerId,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return VocabularyCollectionModel(
      id: id ?? this.id,
      name: name ?? this.name,
      langCode: langCode ?? this.langCode,
      totalWords: totalWords ?? this.totalWords,
      description: description ?? this.description,
      isPublic: isPublic ?? this.isPublic,
      isSelected: isSelected ?? this.isSelected,
      ownerId: ownerId ?? this.ownerId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class WordCardModel {
  final int id;
  final String word;
  final String wordMd5;
  final String learningStatus;
  final int familiarityLevel;
  final int reviewCount;
  final int correctCount;
  final int wrongCount;
  final Map<String, dynamic>? translations;
  final String? nativeTranslation;
  final String? phonetic;
  final String? usPhonetic;
  final String? ukPhonetic;
  final List<TtsFileModel> ttsFiles;
  final List<String> imageFiles;
  final Map<String, dynamic>? wordDetails;
  final DateTime? nextReviewAt;

  WordCardModel({
    required this.id,
    required this.word,
    required this.wordMd5,
    this.learningStatus = 'new',
    this.familiarityLevel = 0,
    this.reviewCount = 0,
    this.correctCount = 0,
    this.wrongCount = 0,
    this.translations,
    this.nativeTranslation,
    this.phonetic,
    this.usPhonetic,
    this.ukPhonetic,
    this.ttsFiles = const [],
    this.imageFiles = const [],
    this.wordDetails,
    this.nextReviewAt,
  });

  factory WordCardModel.fromJson(Map<String, dynamic> json) {
    List<TtsFileModel> parseTtsFiles(dynamic data) {
      if (data == null) return [];
      if (data is List) {
        return data.map((e) => TtsFileModel.fromJson(e)).toList();
      }
      return [];
    }

    List<String> parseImageFiles(dynamic data) {
      if (data == null) return [];
      if (data is List) {
        return data.map((e) => e.toString()).toList();
      }
      return [];
    }

    return WordCardModel(
      id: json['id'] ?? 0,
      word: json['word'] ?? '',
      wordMd5: json['word_md5'] ?? '',
      learningStatus: json['learning_status'] ?? 'new',
      familiarityLevel: json['familiarity_level'] ?? 0,
      reviewCount: json['review_count'] ?? 0,
      correctCount: json['correct_count'] ?? 0,
      wrongCount: json['wrong_count'] ?? 0,
      translations: json['translations'],
      nativeTranslation: json['native_translation'],
      phonetic: json['phonetic'],
      usPhonetic: json['us_phonetic'],
      ukPhonetic: json['uk_phonetic'],
      ttsFiles: parseTtsFiles(json['tts_files']),
      imageFiles: parseImageFiles(json['image_files']),
      wordDetails: json['word_details'],
      nextReviewAt: json['next_review_at'] != null 
          ? DateTime.tryParse(json['next_review_at']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'word': word,
    'word_md5': wordMd5,
    'learning_status': learningStatus,
    'familiarity_level': familiarityLevel,
    'review_count': reviewCount,
    'correct_count': correctCount,
    'wrong_count': wrongCount,
    'translations': translations,
    'native_translation': nativeTranslation,
    'phonetic': phonetic,
    'us_phonetic': usPhonetic,
    'uk_phonetic': ukPhonetic,
    'tts_files': ttsFiles.map((e) => e.toJson()).toList(),
    'image_files': imageFiles,
    'word_details': wordDetails,
    'next_review_at': nextReviewAt?.toIso8601String(),
  };

  double get masteryPercentage {
    if (reviewCount == 0) return 0;
    return (correctCount / reviewCount * 100).clamp(0, 100);
  }

  bool get isNew => learningStatus == 'new';
  bool get isLearning => learningStatus == 'learning';
  bool get isMastered => learningStatus == 'mastered';
  bool get needsReview => nextReviewAt != null && 
      nextReviewAt!.isBefore(DateTime.now());

  String? get primaryTtsUrl {
    if (ttsFiles.isEmpty) return null;
    return ttsFiles.first.url;
  }
}

class TtsFileModel {
  final String path;
  final String? url;
  final String? speedKey;
  final String? type;
  final String? provider;
  final String? speed;
  final DateTime? createdAt;

  TtsFileModel({
    required this.path,
    this.url,
    this.speedKey,
    this.type,
    this.provider,
    this.speed,
    this.createdAt,
  });

  factory TtsFileModel.fromJson(Map<String, dynamic> json) {
    return TtsFileModel(
      path: json['path'] ?? '',
      url: json['url'],
      speedKey: json['speed_key'],
      type: json['type'],
      provider: json['provider'],
      speed: json['speed'],
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'path': path,
    'url': url,
    'speed_key': speedKey,
    'type': type,
    'provider': provider,
    'speed': speed,
    'created_at': createdAt?.toIso8601String(),
  };
}

class LearningStatsModel {
  final int totalWords;
  final int learnedWords;
  final int masteredWords;
  final int reviewDueWords;
  final int todayLearned;
  final int todayReviewed;
  final int streakDays;
  final double averageAccuracy;
  final Map<String, int>? statusDistribution;

  LearningStatsModel({
    this.totalWords = 0,
    this.learnedWords = 0,
    this.masteredWords = 0,
    this.reviewDueWords = 0,
    this.todayLearned = 0,
    this.todayReviewed = 0,
    this.streakDays = 0,
    this.averageAccuracy = 0,
    this.statusDistribution,
  });

  factory LearningStatsModel.fromJson(Map<String, dynamic> json) {
    final stats = json['stats'] ?? json;
    return LearningStatsModel(
      totalWords: stats['total'] ?? stats['total_words'] ?? 0,
      learnedWords: stats['learned'] ?? stats['learned_words'] ?? 0,
      masteredWords: stats['mastered'] ?? stats['mastered_words'] ?? 0,
      reviewDueWords: stats['review_due'] ?? stats['review_due_words'] ?? 0,
      todayLearned: stats['today_learned'] ?? 0,
      todayReviewed: stats['today_reviewed'] ?? 0,
      streakDays: stats['streak_days'] ?? 0,
      averageAccuracy: (stats['average_accuracy'] ?? 0).toDouble(),
      statusDistribution: stats['status_distribution'] != null 
          ? Map<String, int>.from(stats['status_distribution']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'total_words': totalWords,
    'learned_words': learnedWords,
    'mastered_words': masteredWords,
    'review_due_words': reviewDueWords,
    'today_learned': todayLearned,
    'today_reviewed': todayReviewed,
    'streak_days': streakDays,
    'average_accuracy': averageAccuracy,
    'status_distribution': statusDistribution,
  };

  double get progressPercentage {
    if (totalWords == 0) return 0;
    return (learnedWords / totalWords * 100).clamp(0, 100);
  }

  double get masteryPercentage {
    if (totalWords == 0) return 0;
    return (masteredWords / totalWords * 100).clamp(0, 100);
  }
}

class VocabularyRecommendationModel {
  final int id;
  final String name;
  final String langCode;
  final int totalWords;
  final String level;
  final String category;
  final bool isSelected;
  final bool isPopular;
  final int difficulty;
  final int estimatedDays;
  final String? description;

  VocabularyRecommendationModel({
    required this.id,
    required this.name,
    required this.langCode,
    required this.totalWords,
    required this.level,
    required this.category,
    this.isSelected = false,
    this.isPopular = false,
    required this.difficulty,
    required this.estimatedDays,
    this.description,
  });

  factory VocabularyRecommendationModel.fromJson(Map<String, dynamic> json) {
    return VocabularyRecommendationModel(
      id: json['id'] ?? 0,
      name: json['name'] ?? '',
      langCode: json['lang_code'] ?? 'en',
      totalWords: json['total_words'] ?? 0,
      level: json['level'] ?? '',
      category: json['category'] ?? '',
      isSelected: json['is_selected'] ?? false,
      isPopular: json['is_popular'] ?? false,
      difficulty: json['difficulty'] ?? 3,
      estimatedDays: json['estimated_days'] ?? 0,
      description: json['description'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'lang_code': langCode,
    'total_words': totalWords,
    'level': level,
    'category': category,
    'is_selected': isSelected,
    'is_popular': isPopular,
    'difficulty': difficulty,
    'estimated_days': estimatedDays,
    'description': description,
  };

  VocabularyRecommendationModel copyWith({
    int? id,
    String? name,
    String? langCode,
    int? totalWords,
    String? level,
    String? category,
    bool? isSelected,
    bool? isPopular,
    int? difficulty,
    int? estimatedDays,
    String? description,
  }) {
    return VocabularyRecommendationModel(
      id: id ?? this.id,
      name: name ?? this.name,
      langCode: langCode ?? this.langCode,
      totalWords: totalWords ?? this.totalWords,
      level: level ?? this.level,
      category: category ?? this.category,
      isSelected: isSelected ?? this.isSelected,
      isPopular: isPopular ?? this.isPopular,
      difficulty: difficulty ?? this.difficulty,
      estimatedDays: estimatedDays ?? this.estimatedDays,
      description: description ?? this.description,
    );
  }

  String get categoryDisplay {
    const categoryMap = {
      'exam': 'Exam Prep',
      'business': 'Business',
      'daily': 'Daily Life',
      'travel': 'Travel',
      'technical': 'Technical',
      'academic': 'Academic',
      'entertainment': 'Entertainment',
    };
    return categoryMap[category] ?? category;
  }

  String get difficultyDisplay {
    if (difficulty <= 2) return 'Beginner';
    if (difficulty <= 4) return 'Intermediate';
    return 'Advanced';
  }
}

class SupportedLanguageModel {
  final String code;
  final String name;
  final String nativeName;
  final String? voiceId;
  final bool hasTts;

  SupportedLanguageModel({
    required this.code,
    required this.name,
    this.nativeName = '',
    this.voiceId,
    this.hasTts = true,
  });

  factory SupportedLanguageModel.fromJson(Map<String, dynamic> json) {
    return SupportedLanguageModel(
      code: json['code'] ?? '',
      name: json['name'] ?? '',
      nativeName: json['native_name'] ?? json['name'] ?? '',
      voiceId: json['voice_id'],
      hasTts: json['has_tts'] ?? true,
    );
  }

  factory SupportedLanguageModel.fromEntry(String code, String voiceId) {
    final names = _languageNames[code] ?? [code, code];
    return SupportedLanguageModel(
      code: code,
      name: names[0],
      nativeName: names[1],
      voiceId: voiceId,
      hasTts: true,
    );
  }

  Map<String, dynamic> toJson() => {
    'code': code,
    'name': name,
    'native_name': nativeName,
    'voice_id': voiceId,
    'has_tts': hasTts,
  };

  static const Map<String, List<String>> _languageNames = {
    'en': ['English', 'English'],
    'zh': ['Chinese', '\u4e2d\u6587'],
    'ja': ['Japanese', '\u65e5\u672c\u8a9e'],
    'ko': ['Korean', '\ud55c\uad6d\uc5b4'],
    'fr': ['French', 'Fran\u00e7ais'],
    'de': ['German', 'Deutsch'],
    'es': ['Spanish', 'Espa\u00f1ol'],
    'it': ['Italian', 'Italiano'],
    'pt': ['Portuguese', 'Portugu\u00eas'],
    'ru': ['Russian', '\u0420\u0443\u0441\u0441\u043a\u0438\u0439'],
    'ar': ['Arabic', '\u0627\u0644\u0639\u0631\u0628\u064a\u0629'],
    'hi': ['Hindi', '\u0939\u093f\u0928\u094d\u0926\u0940'],
    'th': ['Thai', '\u0e44\u0e17\u0e22'],
    'vi': ['Vietnamese', 'Ti\u1ebfng Vi\u1ec7t'],
    'id': ['Indonesian', 'Bahasa Indonesia'],
    'ms': ['Malay', 'Bahasa Melayu'],
    'nl': ['Dutch', 'Nederlands'],
    'pl': ['Polish', 'Polski'],
    'tr': ['Turkish', 'T\u00fcrk\u00e7e'],
    'sv': ['Swedish', 'Svenska'],
    'da': ['Danish', 'Dansk'],
    'fi': ['Finnish', 'Suomi'],
    'no': ['Norwegian', 'Norsk'],
  };
}

