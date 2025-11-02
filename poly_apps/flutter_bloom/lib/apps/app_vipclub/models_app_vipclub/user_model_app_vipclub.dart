class VipClubUserModel {
  final String id;
  final String email;
  final String fullName;
  final String phone;
  final String? avatarUrl;
  final String memberType;
  final int vipPoints;
  final DateTime memberSince;
  final DateTime? memberExpiry;
  final bool isActive;
  final Map<String, dynamic>? preferences;

  VipClubUserModel({
    required this.id,
    required this.email,
    required this.fullName,
    required this.phone,
    this.avatarUrl,
    required this.memberType,
    required this.vipPoints,
    required this.memberSince,
    this.memberExpiry,
    this.isActive = true,
    this.preferences,
  });

  factory VipClubUserModel.fromJson(Map<String, dynamic> json) {
    return VipClubUserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['full_name'] as String,
      phone: json['phone'] as String,
      avatarUrl: json['avatar_url'] as String?,
      memberType: json['member_type'] as String,
      vipPoints: json['vip_points'] as int,
      memberSince: DateTime.parse(json['member_since'] as String),
      memberExpiry: json['member_expiry'] != null
          ? DateTime.parse(json['member_expiry'] as String)
          : null,
      isActive: json['is_active'] as bool? ?? true,
      preferences: json['preferences'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'full_name': fullName,
      'phone': phone,
      'avatar_url': avatarUrl,
      'member_type': memberType,
      'vip_points': vipPoints,
      'member_since': memberSince.toIso8601String(),
      'member_expiry': memberExpiry?.toIso8601String(),
      'is_active': isActive,
      'preferences': preferences,
    };
  }

  VipClubUserModel copyWith({
    String? id,
    String? email,
    String? fullName,
    String? phone,
    String? avatarUrl,
    String? memberType,
    int? vipPoints,
    DateTime? memberSince,
    DateTime? memberExpiry,
    bool? isActive,
    Map<String, dynamic>? preferences,
  }) {
    return VipClubUserModel(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      memberType: memberType ?? this.memberType,
      vipPoints: vipPoints ?? this.vipPoints,
      memberSince: memberSince ?? this.memberSince,
      memberExpiry: memberExpiry ?? this.memberExpiry,
      isActive: isActive ?? this.isActive,
      preferences: preferences ?? this.preferences,
    );
  }

  bool get isVipMember =>
      memberType == 'gold' ||
      memberType == 'platinum' ||
      memberType == 'diamond';

  bool get isGoldMember => memberType == 'gold';
  bool get isPlatinumMember => memberType == 'platinum';
  bool get isDiamondMember => memberType == 'diamond';

  double get discountRate {
    switch (memberType) {
      case 'gold':
        return 0.10;
      case 'platinum':
        return 0.20;
      case 'diamond':
        return 0.30;
      default:
        return 0.0;
    }
  }
}
