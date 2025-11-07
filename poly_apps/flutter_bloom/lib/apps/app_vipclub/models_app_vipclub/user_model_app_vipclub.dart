import 'package:qyflutter/common/provider_status/user_provider.dart';

class VipClubUserModel extends BaseUserModel {
  final String phone;
  final String memberType;
  final int vipPoints;
  final DateTime memberSince;
  final DateTime? memberExpiry;
  final bool isActive;
  final Map<String, dynamic>? preferences;

  VipClubUserModel({
    super.id,
    super.email,
    super.name,
    super.username,
    super.avatar,
    super.userToken,
    super.createdAt,
    super.updatedAt,
    super.authMetadata = const AuthMetadata(),
    required this.phone,
    this.memberType = 'standard',
    this.vipPoints = 0,
    DateTime? memberSince,
    this.memberExpiry,
    this.isActive = true,
    this.preferences,
  }) : memberSince = memberSince ?? createdAt ?? DateTime.now();

  factory VipClubUserModel.fromJson(Map<String, dynamic> json) {
    return VipClubUserModel(
      id: json['id'] as int?,
      email: json['email'] as String?,
      name: json['full_name'] as String? ?? json['name'] as String?,
      username: json['username'] as String?,
      avatar: json['avatar_url'] as String? ?? json['avatar'] as String?,
      userToken: json['user_token'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'] as String)
          : null,
      authMetadata: json['auth_metadata'] != null
          ? AuthMetadata.fromMap(
              Map<String, dynamic>.from(json['auth_metadata'] as Map))
          : const AuthMetadata(),
      phone: json['phone'] as String? ?? '',
      memberType: json['member_type'] as String? ?? 'standard',
      vipPoints: json['vip_points'] as int? ?? 0,
      memberSince: json['member_since'] != null
          ? DateTime.parse(json['member_since'] as String)
          : null,
      memberExpiry: json['member_expiry'] != null
          ? DateTime.parse(json['member_expiry'] as String)
          : null,
      isActive: json['is_active'] as bool? ?? true,
      preferences: json['preferences'] as Map<String, dynamic>?,
    );
  }

  factory VipClubUserModel.fromMap(Map<String, dynamic> map) {
    return VipClubUserModel.fromJson(map);
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'full_name': name,
      'name': name,
      'username': username,
      'avatar_url': avatar,
      'avatar': avatar,
      'user_token': userToken,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'auth_metadata': authMetadata.toMap(),
      'phone': phone,
      'member_type': memberType,
      'vip_points': vipPoints,
      'member_since': memberSince.toIso8601String(),
      'member_expiry': memberExpiry?.toIso8601String(),
      'is_active': isActive,
      'preferences': preferences,
    };
  }

  @override
  Map<String, dynamic> toMap() {
    return toJson();
  }

  VipClubUserModel copyWith({
    int? id,
    String? email,
    String? name,
    String? username,
    String? avatar,
    String? userToken,
    DateTime? createdAt,
    DateTime? updatedAt,
    AuthMetadata? authMetadata,
    String? phone,
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
      name: name ?? this.name,
      username: username ?? this.username,
      avatar: avatar ?? this.avatar,
      userToken: userToken ?? this.userToken,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      authMetadata: authMetadata ?? this.authMetadata,
      phone: phone ?? this.phone,
      memberType: memberType ?? this.memberType,
      vipPoints: vipPoints ?? this.vipPoints,
      memberSince: memberSince ?? this.memberSince,
      memberExpiry: memberExpiry ?? this.memberExpiry,
      isActive: isActive ?? this.isActive,
      preferences: preferences ?? this.preferences,
    );
  }

  factory VipClubUserModel.empty() {
    return VipClubUserModel(
      id: null,
      email: null,
      name: null,
      username: null,
      avatar: null,
      userToken: null,
      phone: '',
      memberType: 'standard',
      vipPoints: 0,
      memberSince: DateTime.now(),
      isActive: false,
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
