/// Model for travel inspiration items
class TravelInspirationModel {
  final String id;
  final String title;
  final String subtitle;
  final String imageUrl;
  final String? description;
  final String? category;
  final int? itemCount;
  final String? url;

  TravelInspirationModel({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.imageUrl,
    this.description,
    this.category,
    this.itemCount,
    this.url,
  });

  factory TravelInspirationModel.fromJson(Map<String, dynamic> json) {
    return TravelInspirationModel(
      id: json['id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String,
      imageUrl: json['imageUrl'] as String,
      description: json['description'] as String?,
      category: json['category'] as String?,
      itemCount: json['itemCount'] as int?,
      url: json['url'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'subtitle': subtitle,
      'imageUrl': imageUrl,
      if (description != null) 'description': description,
      if (category != null) 'category': category,
      if (itemCount != null) 'itemCount': itemCount,
      if (url != null) 'url': url,
    };
  }
}
