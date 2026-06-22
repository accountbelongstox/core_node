/// Course Data Models for QY App
library;

import 'package:equatable/equatable.dart';

class CourseModel extends Equatable {
  final String id;
  final String title;
  final String subtitle;
  final String category;
  final String level;
  final String duration;
  final int lessons;
  final double price;
  final double rating;
  final int students;
  final String instructor;
  final String description;
  final List<String> features;
  final List<String> topics;
  final String? imageUrl;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const CourseModel({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.category,
    required this.level,
    required this.duration,
    required this.lessons,
    required this.price,
    required this.rating,
    required this.students,
    required this.instructor,
    required this.description,
    required this.features,
    required this.topics,
    this.imageUrl,
    this.createdAt,
    this.updatedAt,
  });

  @override
  List<Object?> get props => [
        id, title, subtitle, category, level, duration, lessons, price,
        rating, students, instructor, description, features, topics,
        imageUrl, createdAt, updatedAt,
      ];

  CourseModel copyWith({
    String? id,
    String? title,
    String? subtitle,
    String? category,
    String? level,
    String? duration,
    int? lessons,
    double? price,
    double? rating,
    int? students,
    String? instructor,
    String? description,
    List<String>? features,
    List<String>? topics,
    String? imageUrl,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return CourseModel(
      id: id ?? this.id,
      title: title ?? this.title,
      subtitle: subtitle ?? this.subtitle,
      category: category ?? this.category,
      level: level ?? this.level,
      duration: duration ?? this.duration,
      lessons: lessons ?? this.lessons,
      price: price ?? this.price,
      rating: rating ?? this.rating,
      students: students ?? this.students,
      instructor: instructor ?? this.instructor,
      description: description ?? this.description,
      features: features ?? this.features,
      topics: topics ?? this.topics,
      imageUrl: imageUrl ?? this.imageUrl,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'subtitle': subtitle,
      'category': category,
      'level': level,
      'duration': duration,
      'lessons': lessons,
      'price': price,
      'rating': rating,
      'students': students,
      'instructor': instructor,
      'description': description,
      'features': features,
      'topics': topics,
      'imageUrl': imageUrl,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  factory CourseModel.fromJson(Map<String, dynamic> json) {
    return CourseModel(
      id: json['id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String,
      category: json['category'] as String,
      level: json['level'] as String,
      duration: json['duration'] as String,
      lessons: json['lessons'] as int,
      price: (json['price'] as num).toDouble(),
      rating: (json['rating'] as num).toDouble(),
      students: json['students'] as int,
      instructor: json['instructor'] as String,
      description: json['description'] as String,
      features: List<String>.from(json['features'] as List),
      topics: List<String>.from(json['topics'] as List),
      imageUrl: json['imageUrl'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }
}

class CourseModule extends Equatable {
  final String id;
  final String courseId;
  final String title;
  final String subtitle;
  final String description;
  final int orderIndex;
  final int totalLessons;
  final int completedLessons;
  final String duration;
  final bool isLocked;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const CourseModule({
    required this.id,
    required this.courseId,
    required this.title,
    required this.subtitle,
    required this.description,
    required this.orderIndex,
    required this.totalLessons,
    this.completedLessons = 0,
    required this.duration,
    this.isLocked = false,
    this.createdAt,
    this.updatedAt,
  });

  double get progress => totalLessons > 0 ? completedLessons / totalLessons : 0.0;

  bool get isCompleted => completedLessons >= totalLessons;

  @override
  List<Object?> get props => [
        id, courseId, title, subtitle, description, orderIndex,
        totalLessons, completedLessons, duration, isLocked,
        createdAt, updatedAt,
      ];

  CourseModule copyWith({
    String? id,
    String? courseId,
    String? title,
    String? subtitle,
    String? description,
    int? orderIndex,
    int? totalLessons,
    int? completedLessons,
    String? duration,
    bool? isLocked,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return CourseModule(
      id: id ?? this.id,
      courseId: courseId ?? this.courseId,
      title: title ?? this.title,
      subtitle: subtitle ?? this.subtitle,
      description: description ?? this.description,
      orderIndex: orderIndex ?? this.orderIndex,
      totalLessons: totalLessons ?? this.totalLessons,
      completedLessons: completedLessons ?? this.completedLessons,
      duration: duration ?? this.duration,
      isLocked: isLocked ?? this.isLocked,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'courseId': courseId,
      'title': title,
      'subtitle': subtitle,
      'description': description,
      'orderIndex': orderIndex,
      'totalLessons': totalLessons,
      'completedLessons': completedLessons,
      'duration': duration,
      'isLocked': isLocked,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  factory CourseModule.fromJson(Map<String, dynamic> json) {
    return CourseModule(
      id: json['id'] as String,
      courseId: json['courseId'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String,
      description: json['description'] as String,
      orderIndex: json['orderIndex'] as int,
      totalLessons: json['totalLessons'] as int,
      completedLessons: json['completedLessons'] as int? ?? 0,
      duration: json['duration'] as String,
      isLocked: json['isLocked'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }
}

class CourseProject extends Equatable {
  final String id;
  final String courseId;
  final String title;
  final String subtitle;
  final String description;
  final String difficulty;
  final String status; // locked, in_progress, completed
  final List<String> technologies;
  final String? githubUrl;
  final String? demoUrl;
  final int? orderIndex;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const CourseProject({
    required this.id,
    required this.courseId,
    required this.title,
    required this.subtitle,
    required this.description,
    required this.difficulty,
    required this.status,
    required this.technologies,
    this.githubUrl,
    this.demoUrl,
    this.orderIndex,
    this.createdAt,
    this.updatedAt,
  });

  bool get isLocked => status == 'locked';
  bool get isInProgress => status == 'in_progress';
  bool get isCompleted => status == 'completed';

  @override
  List<Object?> get props => [
        id, courseId, title, subtitle, description, difficulty, status,
        technologies, githubUrl, demoUrl, orderIndex, createdAt, updatedAt,
      ];

  CourseProject copyWith({
    String? id,
    String? courseId,
    String? title,
    String? subtitle,
    String? description,
    String? difficulty,
    String? status,
    List<String>? technologies,
    String? githubUrl,
    String? demoUrl,
    int? orderIndex,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return CourseProject(
      id: id ?? this.id,
      courseId: courseId ?? this.courseId,
      title: title ?? this.title,
      subtitle: subtitle ?? this.subtitle,
      description: description ?? this.description,
      difficulty: difficulty ?? this.difficulty,
      status: status ?? this.status,
      technologies: technologies ?? this.technologies,
      githubUrl: githubUrl ?? this.githubUrl,
      demoUrl: demoUrl ?? this.demoUrl,
      orderIndex: orderIndex ?? this.orderIndex,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'courseId': courseId,
      'title': title,
      'subtitle': subtitle,
      'description': description,
      'difficulty': difficulty,
      'status': status,
      'technologies': technologies,
      'githubUrl': githubUrl,
      'demoUrl': demoUrl,
      'orderIndex': orderIndex,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  factory CourseProject.fromJson(Map<String, dynamic> json) {
    return CourseProject(
      id: json['id'] as String,
      courseId: json['courseId'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String,
      description: json['description'] as String,
      difficulty: json['difficulty'] as String,
      status: json['status'] as String,
      technologies: List<String>.from(json['technologies'] as List),
      githubUrl: json['githubUrl'] as String?,
      demoUrl: json['demoUrl'] as String?,
      orderIndex: json['orderIndex'] as int?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }
}

class CourseProgress extends Equatable {
  final String id;
  final String courseId;
  final String userId;
  final double overallProgress;
  final int completedLessons;
  final int totalLessons;
  final int completedProjects;
  final int totalProjects;
  final int currentStreak;
  final int totalStudyDays;
  final double totalStudyHours;
  final int linesOfCode;
  final Map<String, double> moduleProgress;
  final List<String> completedLessonsList;
  final List<String> completedProjectsList;
  final DateTime? lastAccessedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const CourseProgress({
    required this.id,
    required this.courseId,
    required this.userId,
    required this.overallProgress,
    required this.completedLessons,
    required this.totalLessons,
    required this.completedProjects,
    required this.totalProjects,
    this.currentStreak = 0,
    this.totalStudyDays = 0,
    this.totalStudyHours = 0.0,
    this.linesOfCode = 0,
    this.moduleProgress = const {},
    this.completedLessonsList = const [],
    this.completedProjectsList = const [],
    this.lastAccessedAt,
    this.createdAt,
    this.updatedAt,
  });

  @override
  List<Object?> get props => [
        id, courseId, userId, overallProgress, completedLessons, totalLessons,
        completedProjects, totalProjects, currentStreak, totalStudyDays,
        totalStudyHours, linesOfCode, moduleProgress, completedLessonsList,
        completedProjectsList, lastAccessedAt, createdAt, updatedAt,
      ];

  CourseProgress copyWith({
    String? id,
    String? courseId,
    String? userId,
    double? overallProgress,
    int? completedLessons,
    int? totalLessons,
    int? completedProjects,
    int? totalProjects,
    int? currentStreak,
    int? totalStudyDays,
    double? totalStudyHours,
    int? linesOfCode,
    Map<String, double>? moduleProgress,
    List<String>? completedLessonsList,
    List<String>? completedProjectsList,
    DateTime? lastAccessedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return CourseProgress(
      id: id ?? this.id,
      courseId: courseId ?? this.courseId,
      userId: userId ?? this.userId,
      overallProgress: overallProgress ?? this.overallProgress,
      completedLessons: completedLessons ?? this.completedLessons,
      totalLessons: totalLessons ?? this.totalLessons,
      completedProjects: completedProjects ?? this.completedProjects,
      totalProjects: totalProjects ?? this.totalProjects,
      currentStreak: currentStreak ?? this.currentStreak,
      totalStudyDays: totalStudyDays ?? this.totalStudyDays,
      totalStudyHours: totalStudyHours ?? this.totalStudyHours,
      linesOfCode: linesOfCode ?? this.linesOfCode,
      moduleProgress: moduleProgress ?? this.moduleProgress,
      completedLessonsList: completedLessonsList ?? this.completedLessonsList,
      completedProjectsList: completedProjectsList ?? this.completedProjectsList,
      lastAccessedAt: lastAccessedAt ?? this.lastAccessedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'courseId': courseId,
      'userId': userId,
      'overallProgress': overallProgress,
      'completedLessons': completedLessons,
      'totalLessons': totalLessons,
      'completedProjects': completedProjects,
      'totalProjects': totalProjects,
      'currentStreak': currentStreak,
      'totalStudyDays': totalStudyDays,
      'totalStudyHours': totalStudyHours,
      'linesOfCode': linesOfCode,
      'moduleProgress': moduleProgress,
      'completedLessonsList': completedLessonsList,
      'completedProjectsList': completedProjectsList,
      'lastAccessedAt': lastAccessedAt?.toIso8601String(),
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  factory CourseProgress.fromJson(Map<String, dynamic> json) {
    return CourseProgress(
      id: json['id'] as String,
      courseId: json['courseId'] as String,
      userId: json['userId'] as String,
      overallProgress: (json['overallProgress'] as num).toDouble(),
      completedLessons: json['completedLessons'] as int,
      totalLessons: json['totalLessons'] as int,
      completedProjects: json['completedProjects'] as int,
      totalProjects: json['totalProjects'] as int,
      currentStreak: json['currentStreak'] as int? ?? 0,
      totalStudyDays: json['totalStudyDays'] as int? ?? 0,
      totalStudyHours: (json['totalStudyHours'] as num?)?.toDouble() ?? 0.0,
      linesOfCode: json['linesOfCode'] as int? ?? 0,
      moduleProgress: Map<String, double>.from(
        json['moduleProgress'] as Map? ?? {},
      ),
      completedLessonsList: List<String>.from(
        json['completedLessonsList'] as List? ?? [],
      ),
      completedProjectsList: List<String>.from(
        json['completedProjectsList'] as List? ?? [],
      ),
      lastAccessedAt: json['lastAccessedAt'] != null
          ? DateTime.parse(json['lastAccessedAt'] as String)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }
}

enum CourseCategory {
  ielts('IELTS', '雅思备考'),
  python('Python', 'Python编程'),
  general('General', '综合课程'),
  business('Business', '商务英语'),
  toefl('TOEFL', '托福备考');

  const CourseCategory(this.code, this.displayName);

  final String code;
  final String displayName;

  static CourseCategory fromCode(String code) {
    return CourseCategory.values.firstWhere(
      (category) => category.code == code,
      orElse: () => CourseCategory.general,
    );
  }
}

enum CourseStatus {
  notStarted('not_started', '未开始'),
  inProgress('in_progress', '学习中'),
  completed('completed', '已完成'),
  paused('paused', '已暂停');

  const CourseStatus(this.code, this.displayName);

  final String code;
  final String displayName;

  static CourseStatus fromCode(String code) {
    return CourseStatus.values.firstWhere(
      (status) => status.code == code,
      orElse: () => CourseStatus.notStarted,
    );
  }
}