/// Model for hot content items displayed in the journey screen
class HotContentModel {
  final String id;
  final String image;
  final String title;
  final String subtitle;
  final String author;
  final int likes;
  final String? category;
  final DateTime? publishDate;
  final String? url;

  HotContentModel({
    required this.id,
    required this.image,
    required this.title,
    required this.subtitle,
    required this.author,
    required this.likes,
    this.category,
    this.publishDate,
    this.url,
  });

  factory HotContentModel.fromJson(Map<String, dynamic> json) {
    return HotContentModel(
      id: json['id'] as String,
      image: json['image'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String,
      author: json['author'] as String,
      likes: json['likes'] as int,
      category: json['category'] as String?,
      publishDate: json['publishDate'] != null
          ? DateTime.parse(json['publishDate'] as String)
          : null,
      url: json['url'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'image': image,
      'title': title,
      'subtitle': subtitle,
      'author': author,
      'likes': likes,
      if (category != null) 'category': category,
      if (publishDate != null) 'publishDate': publishDate!.toIso8601String(),
      if (url != null) 'url': url,
    };
  }
}
