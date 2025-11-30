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

  const DictionaryModel({
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

  // From JSON
  factory DictionaryModel.fromJson(Map<String, dynamic> json) {
    return DictionaryModel(
      id: json['id'] as String,
      title: json['title'] as String,
      imageUrl: json['imageUrl'] as String,
      wordCount: json['wordCount'] as int,
      likeCount: json['likeCount'] as int,
      isAdded: json['isAdded'] as bool? ?? false,
      description: json['description'] as String,
      category: json['category'] as String,
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ?? [],
      author: json['author'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      difficulty: json['difficulty'] as String,
    );
  }

  // To JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'imageUrl': imageUrl,
      'wordCount': wordCount,
      'likeCount': likeCount,
      'isAdded': isAdded,
      'description': description,
      'category': category,
      'tags': tags,
      'author': author,
      'createdAt': createdAt.toIso8601String(),
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
