class VipClubCardModel {
  final String cardNumber;
  final String userId;
  final String memberType;
  final DateTime issueDate;
  final DateTime expiryDate;
  final int points;
  final List<VipClubBenefitModel> benefits;
  final String? qrCode;
  final bool isActive;

  VipClubCardModel({
    required this.cardNumber,
    required this.userId,
    required this.memberType,
    required this.issueDate,
    required this.expiryDate,
    required this.points,
    required this.benefits,
    this.qrCode,
    this.isActive = true,
  });

  factory VipClubCardModel.fromJson(Map<String, dynamic> json) {
    return VipClubCardModel(
      cardNumber: json['card_number'] as String,
      userId: json['user_id'] as String,
      memberType: json['member_type'] as String,
      issueDate: DateTime.parse(json['issue_date'] as String),
      expiryDate: DateTime.parse(json['expiry_date'] as String),
      points: json['points'] as int,
      benefits: (json['benefits'] as List<dynamic>)
          .map((e) => VipClubBenefitModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      qrCode: json['qr_code'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'card_number': cardNumber,
      'user_id': userId,
      'member_type': memberType,
      'issue_date': issueDate.toIso8601String(),
      'expiry_date': expiryDate.toIso8601String(),
      'points': points,
      'benefits': benefits.map((e) => e.toJson()).toList(),
      'qr_code': qrCode,
      'is_active': isActive,
    };
  }

  bool get isExpired => DateTime.now().isAfter(expiryDate);
  bool get isValid => isActive && !isExpired;

  String get cardTier {
    switch (memberType) {
      case 'gold':
        return 'Gold Member';
      case 'platinum':
        return 'Platinum Member';
      case 'diamond':
        return 'Diamond Member';
      default:
        return 'Regular Member';
    }
  }

  double get discountPercentage {
    switch (memberType) {
      case 'gold':
        return 10.0;
      case 'platinum':
        return 20.0;
      case 'diamond':
        return 30.0;
      default:
        return 0.0;
    }
  }
}

class VipClubBenefitModel {
  final String id;
  final String title;
  final String description;
  final String category;
  final bool isActive;

  VipClubBenefitModel({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    this.isActive = true,
  });

  factory VipClubBenefitModel.fromJson(Map<String, dynamic> json) {
    return VipClubBenefitModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      category: json['category'] as String,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'category': category,
      'is_active': isActive,
    };
  }
}

class VipClubPointsTransactionModel {
  final String id;
  final String userId;
  final int points;
  final String type;
  final String description;
  final String? relatedBookingId;
  final DateTime createdAt;

  VipClubPointsTransactionModel({
    required this.id,
    required this.userId,
    required this.points,
    required this.type,
    required this.description,
    this.relatedBookingId,
    required this.createdAt,
  });

  factory VipClubPointsTransactionModel.fromJson(Map<String, dynamic> json) {
    return VipClubPointsTransactionModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      points: json['points'] as int,
      type: json['type'] as String,
      description: json['description'] as String,
      relatedBookingId: json['related_booking_id'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'points': points,
      'type': type,
      'description': description,
      'related_booking_id': relatedBookingId,
      'created_at': createdAt.toIso8601String(),
    };
  }

  bool get isEarned => type == 'earn';
  bool get isRedeemed => type == 'redeem';
}
