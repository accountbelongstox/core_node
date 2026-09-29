class SightModelAppTravel {
  final String id;
  final String title;
  final String imageUrl;
  final String location;
  final double rating;
  final double price;
  final String description;
  final List<String> tags;
  final String? openingHours;
  final String? phoneNumber;
  final String? address;

  SightModelAppTravel({
    required this.id,
    required this.title,
    required this.imageUrl,
    required this.location,
    required this.rating,
    required this.price,
    required this.description,
    required this.tags,
    this.openingHours,
    this.phoneNumber,
    this.address,
  });

  factory SightModelAppTravel.fromJson(Map<String, dynamic> json) {
    return SightModelAppTravel(
      id: json['id'] as String,
      title: json['title'] as String,
      imageUrl: json['imageUrl'] as String,
      location: json['location'] as String,
      rating: (json['rating'] as num).toDouble(),
      price: (json['price'] as num).toDouble(),
      description: json['description'] as String,
      tags: (json['tags'] as List<dynamic>).map((e) => e as String).toList(),
      openingHours: json['openingHours'] as String?,
      phoneNumber: json['phoneNumber'] as String?,
      address: json['address'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'imageUrl': imageUrl,
      'location': location,
      'rating': rating,
      'price': price,
      'description': description,
      'tags': tags,
      'openingHours': openingHours,
      'phoneNumber': phoneNumber,
      'address': address,
    };
  }

  SightModelAppTravel copyWith({
    String? id,
    String? title,
    String? imageUrl,
    String? location,
    double? rating,
    double? price,
    String? description,
    List<String>? tags,
    String? openingHours,
    String? phoneNumber,
    String? address,
  }) {
    return SightModelAppTravel(
      id: id ?? this.id,
      title: title ?? this.title,
      imageUrl: imageUrl ?? this.imageUrl,
      location: location ?? this.location,
      rating: rating ?? this.rating,
      price: price ?? this.price,
      description: description ?? this.description,
      tags: tags ?? this.tags,
      openingHours: openingHours ?? this.openingHours,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      address: address ?? this.address,
    );
  }

  bool get isFree => price == 0.0;

  String get formattedPrice {
    if (isFree) return 'Free';
    return '\$${price.toStringAsFixed(0)}';
  }
}
