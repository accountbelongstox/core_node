class VipClubBookingModel {
  final String id;
  final String userId;
  final String facilityType;
  final String facilityName;
  final DateTime bookingDate;
  final String timeSlot;
  final int duration;
  final double price;
  final double discount;
  final double finalPrice;
  final String status;
  final Map<String, dynamic>? extras;
  final DateTime createdAt;
  final DateTime? updatedAt;

  VipClubBookingModel({
    required this.id,
    required this.userId,
    required this.facilityType,
    required this.facilityName,
    required this.bookingDate,
    required this.timeSlot,
    required this.duration,
    required this.price,
    this.discount = 0.0,
    required this.finalPrice,
    required this.status,
    this.extras,
    required this.createdAt,
    this.updatedAt,
  });

  factory VipClubBookingModel.fromJson(Map<String, dynamic> json) {
    return VipClubBookingModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      facilityType: json['facility_type'] as String,
      facilityName: json['facility_name'] as String,
      bookingDate: DateTime.parse(json['booking_date'] as String),
      timeSlot: json['time_slot'] as String,
      duration: json['duration'] as int,
      price: (json['price'] as num).toDouble(),
      discount: (json['discount'] as num?)?.toDouble() ?? 0.0,
      finalPrice: (json['final_price'] as num).toDouble(),
      status: json['status'] as String,
      extras: json['extras'] as Map<String, dynamic>?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'facility_type': facilityType,
      'facility_name': facilityName,
      'booking_date': bookingDate.toIso8601String(),
      'time_slot': timeSlot,
      'duration': duration,
      'price': price,
      'discount': discount,
      'final_price': finalPrice,
      'status': status,
      'extras': extras,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  bool get isPending => status == 'pending';
  bool get isConfirmed => status == 'confirmed';
  bool get isCancelled => status == 'cancelled';
  bool get isCompleted => status == 'completed';

  bool get canCancel => isPending || isConfirmed;
  bool get canModify => isPending;
}
