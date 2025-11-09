class VipClubSplashModel {
  final String id;
  final String imageUrl;
  final String? title;
  final String? description;
  final int order;
  final bool isActive;

  VipClubSplashModel({
    required this.id,
    required this.imageUrl,
    this.title,
    this.description,
    required this.order,
    this.isActive = true,
  });

  factory VipClubSplashModel.fromJson(Map<String, dynamic> json) {
    return VipClubSplashModel(
      id: json['id']?.toString() ?? '',
      imageUrl: json['image_url']?.toString() ?? '',
      title: json['title']?.toString(),
      description: json['description']?.toString(),
      order: json['order'] as int? ?? 0,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'image_url': imageUrl,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      'order': order,
      'is_active': isActive,
    };
  }
}

class VipClubSplashStateModel {
  final bool hasCompletedSplash;
  final DateTime? lastViewedDate;
  final int currentPage;

  VipClubSplashStateModel({
    required this.hasCompletedSplash,
    this.lastViewedDate,
    this.currentPage = 0,
  });

  bool shouldShowSplash() {
    if (!hasCompletedSplash) return true;

    if (lastViewedDate == null) return true;

    final now = DateTime.now();
    final difference = now.difference(lastViewedDate!);

    return difference.inDays >= 5;
  }

  factory VipClubSplashStateModel.fromJson(Map<String, dynamic> json) {
    return VipClubSplashStateModel(
      hasCompletedSplash: json['has_completed_splash'] as bool? ?? false,
      lastViewedDate: json['last_viewed_date'] != null
          ? DateTime.parse(json['last_viewed_date'] as String)
          : null,
      currentPage: json['current_page'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'has_completed_splash': hasCompletedSplash,
      if (lastViewedDate != null)
        'last_viewed_date': lastViewedDate!.toIso8601String(),
      'current_page': currentPage,
    };
  }

  VipClubSplashStateModel copyWith({
    bool? hasCompletedSplash,
    DateTime? lastViewedDate,
    int? currentPage,
  }) {
    return VipClubSplashStateModel(
      hasCompletedSplash: hasCompletedSplash ?? this.hasCompletedSplash,
      lastViewedDate: lastViewedDate ?? this.lastViewedDate,
      currentPage: currentPage ?? this.currentPage,
    );
  }
}
