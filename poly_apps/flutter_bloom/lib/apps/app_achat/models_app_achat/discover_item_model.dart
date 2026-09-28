enum DiscoverItemType {
  moments,
  channels,
  games,
  miniPrograms,
}

class DiscoverItemModel {
  final String id;
  final String title;
  final String description;
  final String? icon;
  final String? image;
  final DiscoverItemType type;
  final bool isNew;
  final bool isPopular;
  final int? userCount;

  const DiscoverItemModel({
    required this.id,
    required this.title,
    required this.description,
    this.icon,
    this.image,
    required this.type,
    this.isNew = false,
    this.isPopular = false,
    this.userCount,
  });

  factory DiscoverItemModel.fromJson(Map<String, dynamic> json) {
    return DiscoverItemModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      icon: json['icon'] as String?,
      image: json['image'] as String?,
      type: DiscoverItemType.values.firstWhere(
        (e) => e.toString() == 'DiscoverItemType.${json['type']}',
      ),
      isNew: json['isNew'] as bool? ?? false,
      isPopular: json['isPopular'] as bool? ?? false,
      userCount: json['userCount'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'icon': icon,
      'image': image,
      'type': type.toString().split('.').last,
      'isNew': isNew,
      'isPopular': isPopular,
      'userCount': userCount,
    };
  }

  DiscoverItemModel copyWith({
    String? id,
    String? title,
    String? description,
    String? icon,
    String? image,
    DiscoverItemType? type,
    bool? isNew,
    bool? isPopular,
    int? userCount,
  }) {
    return DiscoverItemModel(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      icon: icon ?? this.icon,
      image: image ?? this.image,
      type: type ?? this.type,
      isNew: isNew ?? this.isNew,
      isPopular: isPopular ?? this.isPopular,
      userCount: userCount ?? this.userCount,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DiscoverItemModel && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'DiscoverItemModel(id: $id, title: $title, type: $type)';
  }
}
