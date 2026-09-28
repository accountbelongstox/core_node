class VipClubBannerModel {
  final String id;
  final String imageUrl;
  final String title;
  final String subtitle;
  final String? linkUrl;
  final String? linkType;
  final int order;
  final bool isActive;

  VipClubBannerModel({
    required this.id,
    required this.imageUrl,
    required this.title,
    this.subtitle = '',
    this.linkUrl,
    this.linkType,
    this.order = 0,
    this.isActive = true,
  });

  factory VipClubBannerModel.fromJson(Map<String, dynamic> json) {
    return VipClubBannerModel(
      id: json['id']?.toString() ?? '',
      imageUrl: json['image_url'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      linkUrl: json['link_url'] as String?,
      linkType: json['link_type'] as String?,
      order: json['order'] as int? ?? 0,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'image_url': imageUrl,
      'title': title,
      'subtitle': subtitle,
      'link_url': linkUrl,
      'link_type': linkType,
      'order': order,
      'is_active': isActive,
    };
  }
}
