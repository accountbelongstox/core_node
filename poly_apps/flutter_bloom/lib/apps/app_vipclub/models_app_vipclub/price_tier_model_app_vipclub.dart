class VipClubPriceTierModel {
  final String id;
  final String name;
  final String category;
  final double price;
  final String currency;
  final String duration;
  final List<String> features;
  final bool isPopular;
  final int order;

  VipClubPriceTierModel({
    required this.id,
    required this.name,
    required this.category,
    required this.price,
    this.currency = 'USD',
    this.duration = 'month',
    this.features = const [],
    this.isPopular = false,
    this.order = 0,
  });

  factory VipClubPriceTierModel.fromJson(Map<String, dynamic> json) {
    return VipClubPriceTierModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      category: json['category'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      duration: json['duration'] as String? ?? 'month',
      features: (json['features'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      isPopular: json['is_popular'] as bool? ?? false,
      order: json['order'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category,
      'price': price,
      'currency': currency,
      'duration': duration,
      'features': features,
      'is_popular': isPopular,
      'order': order,
    };
  }
}
