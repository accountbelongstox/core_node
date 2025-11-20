class VipClubFacilityModel {
  final String id;
  final String name;
  final String type;
  final String description;
  final String? imageUrl;
  final double basePrice;
  final List<String> availableTimes;
  final Map<String, dynamic>? features;
  final bool isActive;
  final bool vipOnly;

  VipClubFacilityModel({
    required this.id,
    required this.name,
    required this.type,
    required this.description,
    this.imageUrl,
    required this.basePrice,
    required this.availableTimes,
    this.features,
    this.isActive = true,
    this.vipOnly = false,
  });

  factory VipClubFacilityModel.fromJson(Map<String, dynamic> json) {
    return VipClubFacilityModel(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
      description: json['description'] as String,
      imageUrl: json['image_url'] as String?,
      basePrice: (json['base_price'] as num).toDouble(),
      availableTimes: (json['available_times'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      features: json['features'] as Map<String, dynamic>?,
      isActive: json['is_active'] as bool? ?? true,
      vipOnly: json['vip_only'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'description': description,
      'image_url': imageUrl,
      'base_price': basePrice,
      'available_times': availableTimes,
      'features': features,
      'is_active': isActive,
      'vip_only': vipOnly,
    };
  }
}

class VipClubShootingRangeModel extends VipClubFacilityModel {
  final int laneNumber;
  final List<String> availableWeapons;
  final bool instructorAvailable;

  VipClubShootingRangeModel({
    required super.id,
    required super.name,
    required super.description,
    super.imageUrl,
    required super.basePrice,
    required super.availableTimes,
    super.features,
    super.isActive,
    super.vipOnly,
    required this.laneNumber,
    required this.availableWeapons,
    this.instructorAvailable = true,
  }) : super(type: 'shooting');
}

class VipClubGolfCourseModel extends VipClubFacilityModel {
  final int holes;
  final String difficulty;
  final bool caddyAvailable;
  final bool cartIncluded;

  VipClubGolfCourseModel({
    required super.id,
    required super.name,
    required super.description,
    super.imageUrl,
    required super.basePrice,
    required super.availableTimes,
    super.features,
    super.isActive,
    super.vipOnly,
    required this.holes,
    required this.difficulty,
    this.caddyAvailable = true,
    this.cartIncluded = false,
  }) : super(type: 'golf');
}

class VipClubHotelRoomModel extends VipClubFacilityModel {
  final String roomType;
  final int capacity;
  final List<String> amenities;
  final String bedType;

  VipClubHotelRoomModel({
    required super.id,
    required super.name,
    required super.description,
    super.imageUrl,
    required super.basePrice,
    required super.availableTimes,
    super.features,
    super.isActive,
    super.vipOnly,
    required this.roomType,
    required this.capacity,
    required this.amenities,
    required this.bedType,
  }) : super(type: 'hotel');
}
