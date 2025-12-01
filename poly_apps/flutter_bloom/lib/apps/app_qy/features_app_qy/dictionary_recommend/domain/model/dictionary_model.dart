/// Dictionary Recommendation Model
/// Represents a recommended dictionary with all its metadata
library;

class DictionaryModel {
  final String id;
  final String title;
  final String imageUrl;
  final int wordCount;
  final int likeCount;
  final bool isAdded; // Whether added to user's dictionary
  final String description;
  final String category;
  final List<String> tags;
  final String author;
  final DateTime createdAt;
  final String difficulty; // beginner, intermediate, advanced

  DictionaryModel({
    required this.id,
    required this.title,
    required this.imageUrl,
    required this.wordCount,
    required this.likeCount,
    required this.isAdded,
    required this.description,
    required this.category,
    required this.tags,
    required this.author,
    required this.createdAt,
    required this.difficulty,
  });

  // Copy with method
  DictionaryModel copyWith({
    String? id,
    String? title,
    String? imageUrl,
    int? wordCount,
    int? likeCount,
    bool? isAdded,
    String? description,
    String? category,
    List<String>? tags,
    String? author,
    DateTime? createdAt,
    String? difficulty,
  }) {
    return DictionaryModel(
      id: id ?? this.id,
      title: title ?? this.title,
      imageUrl: imageUrl ?? this.imageUrl,
      wordCount: wordCount ?? this.wordCount,
      likeCount: likeCount ?? this.likeCount,
      isAdded: isAdded ?? this.isAdded,
      description: description ?? this.description,
      category: category ?? this.category,
      tags: tags ?? this.tags,
      author: author ?? this.author,
      createdAt: createdAt ?? this.createdAt,
      difficulty: difficulty ?? this.difficulty,
    });
  }

  // From JSON (new format: snake_case only)
  factory DictionaryModel.fromJson(Map<String, dynamic> json) {
    return DictionaryModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      imageUrl: json['image_url']?.toString() ?? '',
      wordCount: (json['word_count'] ?? 0) as int,
      likeCount: (json['like_count'] ?? 0) as int,
      isAdded: (json['is_added'] ?? false) as bool,
      description: json['description']?.toString() ?? '',
      category: json['category']?.toString() ?? '',
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      author: json['author']?.toString() ?? '',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      difficulty: json['difficulty']?.toString() ?? '',
    );
  }

  // To JSON (new format: snake_case only)
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'image_url': imageUrl,
      'word_count': wordCount,
      'like_count': likeCount,
      'is_added': isAdded,
      'description': description,
      'category': category,
      'tags': tags,
      'author': author,
      'created_at': createdAt.toIso8601String(),
      'difficulty': difficulty,
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;

    return other is DictionaryModel &&
        other.id == id &&
        other.title == title &&
        other.imageUrl == imageUrl &&
        other.wordCount == wordCount &&
        other.likeCount == likeCount &&
        other.isAdded == isAdded;
  }

  @override
  int get hashCode {
    return id.hashCode ^
        title.hashCode ^
        imageUrl.hashCode ^
        wordCount.hashCode ^
        likeCount.hashCode ^
        isAdded.hashCode;
  }

  @override
  String toString() {
    return 'DictionaryModel(id: $id, title: $title, wordCount: $wordCount, likeCount: $likeCount, isAdded: $isAdded)';
  }
}
