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

/// Course model for QY App
library;

class CourseModel {
  final String id;
  final String title;
  final String description;
  final String? coverUrl;
  final String category;
  final String level;
  final int totalLessons;
  final int completedLessons;
  final String duration;
  final int participants;
  final bool isEnrolled;
  final bool isPremium;
  final double? rating;

  const CourseModel({
    required this.id,
    required this.title,
    required this.description,
    this.coverUrl,
    required this.category,
    required this.level,
    required this.totalLessons,
    this.completedLessons = 0,
    required this.duration,
    this.participants = 0,
    this.isEnrolled = false,
    this.isPremium = false,
    this.rating,
  });

  factory CourseModel.fromJson(Map<String, dynamic> json) {
    return CourseModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String? ?? '',
      coverUrl: json['cover_url'] as String?,
      category: json['category'] as String? ?? 'general',
      level: json['level'] as String? ?? 'beginner',
      totalLessons: json['total_lessons'] as int? ?? 0,
      completedLessons: json['completed_lessons'] as int? ?? 0,
      duration: json['duration'] as String? ?? '',
      participants: json['participants'] as int? ?? 0,
      isEnrolled: json['is_enrolled'] as bool? ?? false,
      isPremium: json['is_premium'] as bool? ?? false,
      rating: (json['rating'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'cover_url': coverUrl,
      'category': category,
      'level': level,
      'total_lessons': totalLessons,
      'completed_lessons': completedLessons,
      'duration': duration,
      'participants': participants,
      'is_enrolled': isEnrolled,
      'is_premium': isPremium,
      'rating': rating,
    };
  }

  CourseModel copyWith({
    String? id,
    String? title,
    String? description,
    String? coverUrl,
    String? category,
    String? level,
    int? totalLessons,
    int? completedLessons,
    String? duration,
    int? participants,
    bool? isEnrolled,
    bool? isPremium,
    double? rating,
  }) {
    return CourseModel(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      coverUrl: coverUrl ?? this.coverUrl,
      category: category ?? this.category,
      level: level ?? this.level,
      totalLessons: totalLessons ?? this.totalLessons,
      completedLessons: completedLessons ?? this.completedLessons,
      duration: duration ?? this.duration,
      participants: participants ?? this.participants,
      isEnrolled: isEnrolled ?? this.isEnrolled,
      isPremium: isPremium ?? this.isPremium,
      rating: rating ?? this.rating,
    );
  }

  double get progress {
    if (totalLessons == 0) return 0.0;
    return (completedLessons / totalLessons) * 100;
  }
}

class CoursePlanModel {
  final String id;
  final String title;
  final String subtitle;
  final String description;
  final int totalDays;
  final int participants;
  final String category;

  const CoursePlanModel({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.description,
    required this.totalDays,
    this.participants = 0,
    required this.category,
  });

  factory CoursePlanModel.fromJson(Map<String, dynamic> json) {
    return CoursePlanModel(
      id: json['id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String? ?? '',
      description: json['description'] as String? ?? '',
      totalDays: json['total_days'] as int? ?? 0,
      participants: json['participants'] as int? ?? 0,
      category: json['category'] as String? ?? 'general',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'subtitle': subtitle,
      'description': description,
      'total_days': totalDays,
      'participants': participants,
      'category': category,
    };
  }
}
