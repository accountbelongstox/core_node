/// Article/News Model for VIP Club
class VipClubArticleModel {
  final String id;
  final String title;
  final String summary;
  final String content;
  final String category;
  final String coverImageUrl;
  final String author;
  final DateTime publishDate;
  final int readCount;
  final List<String> tags;
  final bool isFeatured;

  VipClubArticleModel({
    required this.id,
    required this.title,
    required this.summary,
    required this.content,
    required this.category,
    required this.coverImageUrl,
    required this.author,
    required this.publishDate,
    this.readCount = 0,
    this.tags = const [],
    this.isFeatured = false,
  });

  /// Create from JSON
  factory VipClubArticleModel.fromJson(Map<String, dynamic> json) {
    return VipClubArticleModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      summary: json['summary']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      category: json['category']?.toString() ?? '',
      coverImageUrl: json['cover_image_url']?.toString() ??
                     json['coverImageUrl']?.toString() ?? '',
      author: json['author']?.toString() ?? '',
      publishDate: json['publish_date'] != null
          ? DateTime.parse(json['publish_date'].toString())
          : json['publishDate'] != null
              ? DateTime.parse(json['publishDate'].toString())
              : DateTime.now(),
      readCount: json['read_count'] ?? json['readCount'] ?? 0,
      tags: json['tags'] != null
          ? List<String>.from(json['tags'])
          : [],
      isFeatured: json['is_featured'] ?? json['isFeatured'] ?? false,
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'summary': summary,
      'content': content,
      'category': category,
      'cover_image_url': coverImageUrl,
      'author': author,
      'publish_date': publishDate.toIso8601String(),
      'read_count': readCount,
      'tags': tags,
      'is_featured': isFeatured,
    };
  }

  /// Copy with
  VipClubArticleModel copyWith({
    String? id,
    String? title,
    String? summary,
    String? content,
    String? category,
    String? coverImageUrl,
    String? author,
    DateTime? publishDate,
    int? readCount,
    List<String>? tags,
    bool? isFeatured,
  }) {
    return VipClubArticleModel(
      id: id ?? this.id,
      title: title ?? this.title,
      summary: summary ?? this.summary,
      content: content ?? this.content,
      category: category ?? this.category,
      coverImageUrl: coverImageUrl ?? this.coverImageUrl,
      author: author ?? this.author,
      publishDate: publishDate ?? this.publishDate,
      readCount: readCount ?? this.readCount,
      tags: tags ?? this.tags,
      isFeatured: isFeatured ?? this.isFeatured,
    );
  }

  /// Get category display name
  String get categoryDisplay {
    switch (category.toLowerCase()) {
      case 'news':
        return 'News';
      case 'events':
        return 'Events';
      case 'tips':
        return 'Tips & Guides';
      case 'promotions':
        return 'Promotions';
      case 'announcements':
        return 'Announcements';
      default:
        return category;
    }
  }

  /// Get formatted publish date
  String get formattedPublishDate {
    final now = DateTime.now();
    final difference = now.difference(publishDate);

    if (difference.inDays == 0) {
      if (difference.inHours == 0) {
        return '${difference.inMinutes} minutes ago';
      }
      return '${difference.inHours} hours ago';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} days ago';
    } else {
      return '${publishDate.year}-${publishDate.month.toString().padLeft(2, '0')}-${publishDate.day.toString().padLeft(2, '0')}';
    }
  }

  @override
  String toString() {
    return 'VipClubArticleModel(id: $id, title: $title, category: $category, publishDate: $publishDate)';
  }
}

/// Article categories enum
enum ArticleCategory {
  news,
  events,
  tips,
  promotions,
  announcements,
}

extension ArticleCategoryExtension on ArticleCategory {
  String get value {
    switch (this) {
      case ArticleCategory.news:
        return 'news';
      case ArticleCategory.events:
        return 'events';
      case ArticleCategory.tips:
        return 'tips';
      case ArticleCategory.promotions:
        return 'promotions';
      case ArticleCategory.announcements:
        return 'announcements';
    }
  }

  String get displayName {
    switch (this) {
      case ArticleCategory.news:
        return 'News';
      case ArticleCategory.events:
        return 'Events';
      case ArticleCategory.tips:
        return 'Tips & Guides';
      case ArticleCategory.promotions:
        return 'Promotions';
      case ArticleCategory.announcements:
        return 'Announcements';
    }
  }
}
