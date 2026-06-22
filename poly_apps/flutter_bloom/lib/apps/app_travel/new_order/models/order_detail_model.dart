/// 订单详情数据模型
class OrderDetailModel {
  // 基本信息
  final String orderId;
  final OrderDetailStatus status;

  // 酒店信息
  final HotelInfo hotel;

  // 入住信息
  final CheckInInfo checkIn;

  // 房型信息
  final RoomInfo room;

  // 住客信息
  final List<String> guestNames;
  final String phone;
  final String email;

  // 支付信息
  final PaymentInfo payment;

  // 服务信息
  final ServiceInfo services;

  // 推荐酒店
  final List<HotelRecommendation> recommendations;

  // 常见问题
  final List<String> faqOptions;

  OrderDetailModel({
    required this.orderId,
    required this.status,
    required this.hotel,
    required this.checkIn,
    required this.room,
    required this.guestNames,
    required this.phone,
    required this.email,
    required this.payment,
    required this.services,
    required this.recommendations,
    required this.faqOptions,
  });
}

/// 订单状态
enum OrderDetailStatus {
  pending,      // 待支付
  confirmed,    // 已确认
  checkingIn,   // 待入住
  completed,    // 已完成
  cancelled,    // 已取消
  refunded,     // 已退款
}

extension OrderDetailStatusExt on OrderDetailStatus {
  String get displayName {
    switch (this) {
      case OrderDetailStatus.pending:
        return '待支付';
      case OrderDetailStatus.confirmed:
        return '已确认';
      case OrderDetailStatus.checkingIn:
        return '待入住';
      case OrderDetailStatus.completed:
        return '已完成';
      case OrderDetailStatus.cancelled:
        return '已取消';
      case OrderDetailStatus.refunded:
        return '已退款';
    }
  }

  /// 是否为已确认状态（显示预订成功信息）
  bool get isConfirmed {
    return this == OrderDetailStatus.confirmed ||
           this == OrderDetailStatus.checkingIn;
  }
}

/// 酒店信息
class HotelInfo {
  final String nameCn;
  final String nameEn;
  final String imageUrl;
  final String address;

  HotelInfo({
    required this.nameCn,
    required this.nameEn,
    required this.imageUrl,
    required this.address,
  });
}

/// 入住信息
class CheckInInfo {
  final DateTime checkInDate;
  final DateTime checkOutDate;
  final String checkInTime;
  final String checkOutTime;
  final int nights;

  CheckInInfo({
    required this.checkInDate,
    required this.checkOutDate,
    required this.checkInTime,
    required this.checkOutTime,
    required this.nights,
  });
}

/// 房型信息
class RoomInfo {
  final String roomType;
  final String bedConfig;
  final bool hasBreakfast;
  final String? breakfastPolicy;

  RoomInfo({
    required this.roomType,
    required this.bedConfig,
    required this.hasBreakfast,
    this.breakfastPolicy,
  });
}

/// 支付信息
class PaymentInfo {
  final double totalAmount;
  final double pricePerNight;
  final bool includeTax;
  final String? costDetailUrl;
  final String? originalPrice;
  final String? discount;

  PaymentInfo({
    required this.totalAmount,
    required this.pricePerNight,
    required this.includeTax,
    this.costDetailUrl,
    this.originalPrice,
    this.discount,
  });
}

/// 服务信息
class ServiceInfo {
  final bool canIssueInvoice;
  final String? invoiceNote;
  final TransferService? transferService;

  ServiceInfo({
    required this.canIssueInvoice,
    this.invoiceNote,
    this.transferService,
  });
}

/// 接送服务
class TransferService {
  final String description;
  final String? discount;
  final String bookingUrl;

  TransferService({
    required this.description,
    this.discount,
    required this.bookingUrl,
  });
}

/// 酒店推荐
class HotelRecommendation {
  final String name;
  final String imageUrl;
  final double rating;
  final String ratingText;
  final double price;
  final String? totalPrice;
  final int distanceInMeters;

  HotelRecommendation({
    required this.name,
    required this.imageUrl,
    required this.rating,
    required this.ratingText,
    required this.price,
    this.totalPrice,
    required this.distanceInMeters,
  });

  String get distanceText {
    if (distanceInMeters < 1000) {
      return '距本酒店${distanceInMeters}米';
    } else {
      return '距本酒店${(distanceInMeters / 1000).toStringAsFixed(1)}公里';
    }
  }
}
