import '../../models_app_travel/order_model.dart';
import '../../models_app_travel/traveler_model.dart';
import '../models/order_detail_model.dart';
import '../models/order_detail_test_data.dart';

/// 订单模型转换器
///
/// 用于将 OrderModel 转换为 OrderDetailModel
class OrderConverter {
  /// 将 OrderModel 转换为 OrderDetailModel
  ///
  /// [order] 订单模型
  /// [defaultTraveler] 默认出行人信息，如果不传则使用订单中的信息
  static OrderDetailModel toOrderDetail(
    OrderModel order, {
    TravelerModel? defaultTraveler,
  }) {
    // 从 extraInfo 中提取详细信息
    final extraInfo = order.extraInfo ?? {};

    // 优先使用全局出行人信息，如果没有则使用订单中的信息
    String phone = '';
    String email = '';

    if (defaultTraveler != null) {
      phone = defaultTraveler.maskedPhone;
      email = defaultTraveler.maskedEmail;
    } else {
      phone = extraInfo['phone']?.toString() ?? '';
      email = extraInfo['email']?.toString() ?? '';
    }

    return OrderDetailModel(
      orderId: order.id,
      status: _convertStatus(order.status),
      hotel: HotelInfo(
        nameCn: order.title,
        nameEn: extraInfo['hotelName']?.toString() ?? '',
        imageUrl: order.imageUrl,
        address: extraInfo['address']?.toString() ?? '',
      ),
      checkIn: _buildCheckInInfo(extraInfo),
      room: _buildRoomInfo(extraInfo),
      guestNames: _extractGuestNames(extraInfo, defaultTraveler),
      phone: phone,
      email: email,
      payment: _buildPaymentInfo(order, extraInfo),
      services: _buildServiceInfo(extraInfo),
      recommendations: OrderDetailTestData.getHotelRecommendations(),
      faqOptions: _getDefaultFAQOptions(),
    );
  }

  /// 转换订单状态
  static OrderDetailStatus _convertStatus(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return OrderDetailStatus.pending;
      case OrderStatus.confirmed:
        return OrderDetailStatus.confirmed;
      case OrderStatus.traveling:
        return OrderDetailStatus.checkingIn;
      case OrderStatus.completed:
        return OrderDetailStatus.completed;
      case OrderStatus.cancelled:
        return OrderDetailStatus.cancelled;
      case OrderStatus.refunded:
        return OrderDetailStatus.refunded;
      default:
        return OrderDetailStatus.confirmed;
    }
  }

  /// 构建入住信息
  static CheckInInfo _buildCheckInInfo(Map<String, dynamic> extraInfo) {
    // 解析日期字符串
    final checkInStr = extraInfo['checkIn']?.toString() ?? '';
    final checkOutStr = extraInfo['checkOut']?.toString() ?? '';

    // 这里需要根据实际的日期格式进行解析
    // 示例: "11月12日(周三) 15:00后"
    final checkInDate = _parseDateFromString(checkInStr) ?? DateTime.now();
    final checkOutDate = _parseDateFromString(checkOutStr) ??
        DateTime.now().add(const Duration(days: 1));

    final checkInTime = _extractTimeFromString(checkInStr) ?? '15:00后';
    final checkOutTime = _extractTimeFromString(checkOutStr) ?? '12:00前';

    final nights = extraInfo['nights'] as int? ?? 1;

    return CheckInInfo(
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      checkInTime: checkInTime,
      checkOutTime: checkOutTime,
      nights: nights,
    );
  }

  /// 构建房型信息
  static RoomInfo _buildRoomInfo(Map<String, dynamic> extraInfo) {
    final roomType = extraInfo['roomType']?.toString() ?? '标准房';
    final bedConfig = extraInfo['bedConfig']?.toString() ?? '1张双人床';
    final breakfast = extraInfo['breakfast']?.toString() ?? '';
    final hasBreakfast = breakfast.contains('含早餐') || breakfast.contains('早餐');

    return RoomInfo(
      roomType: roomType,
      bedConfig: bedConfig,
      hasBreakfast: hasBreakfast,
      breakfastPolicy: hasBreakfast ? null : '查看加早政策',
    );
  }

  /// 提取住客姓名
  static List<String> _extractGuestNames(
    Map<String, dynamic> extraInfo,
    TravelerModel? defaultTraveler,
  ) {
    final guests = extraInfo['guests'];
    if (guests is List && guests.isNotEmpty) {
      return guests.map((e) => e.toString()).toList();
    }

    // 如果订单中没有住客信息，使用默认出行人信息
    if (defaultTraveler != null) {
      return [defaultTraveler.name];
    }

    return [];
  }

  /// 构建支付信息
  static PaymentInfo _buildPaymentInfo(
    OrderModel order,
    Map<String, dynamic> extraInfo,
  ) {
    // 解析价格字符串，移除 ¥ 符号
    final priceStr = order.price.replaceAll('¥', '').replaceAll(',', '');
    final totalAmount = double.tryParse(priceStr) ?? 0.0;

    final pricePerNightStr =
        extraInfo['pricePerNight']?.toString().replaceAll('¥', '').replaceAll(',', '') ?? '';
    final pricePerNight = double.tryParse(pricePerNightStr) ?? totalAmount;

    return PaymentInfo(
      totalAmount: totalAmount,
      pricePerNight: pricePerNight,
      includeTax: true,
      costDetailUrl: '/cost-detail',
    );
  }

  /// 构建服务信息
  static ServiceInfo _buildServiceInfo(Map<String, dynamic> extraInfo) {
    final invoice = extraInfo['invoice']?.toString() ?? '';
    final canIssueInvoice = !invoice.contains('不可开票');

    TransferService? transferService;
    final shuttleService = extraInfo['shuttleService']?.toString();
    if (shuttleService != null && shuttleService.isNotEmpty) {
      transferService = TransferService(
        description: shuttleService,
        bookingUrl: '/transfer-booking',
      );
    }

    return ServiceInfo(
      canIssueInvoice: canIssueInvoice,
      invoiceNote: canIssueInvoice ? null : invoice,
      transferService: transferService,
    );
  }

  /// 获取默认的常见问题列表
  static List<String> _getDefaultFAQOptions() {
    return [
      '如何延迟退房',
      '我要取消订单',
      '如何开具发票',
      '如何联系酒店',
    ];
  }

  /// 从字符串中解析日期
  static DateTime? _parseDateFromString(String dateStr) {
    // 简单的解析示例，实际应用中需要更复杂的逻辑
    // 示例: "11月12日(周三) 15:00后"
    try {
      final regex = RegExp(r'(\d+)月(\d+)日');
      final match = regex.firstMatch(dateStr);
      if (match != null) {
        final month = int.parse(match.group(1)!);
        final day = int.parse(match.group(2)!);
        // 假设年份为当前年份
        return DateTime(DateTime.now().year, month, day);
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  /// 从字符串中提取时间
  static String? _extractTimeFromString(String timeStr) {
    // 示例: "11月12日(周三) 15:00后"
    final regex = RegExp(r'(\d+:\d+[后前]?)');
    final match = regex.firstMatch(timeStr);
    return match?.group(1);
  }
}
