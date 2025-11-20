import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'models/order_detail_model.dart';
import 'widgets/order_detail_app_bar.dart';
import 'widgets/order_status_card.dart';
import 'widgets/payment_info_card.dart';
import 'widgets/hotel_recommendation_list.dart';
import 'widgets/hotel_main_info_card.dart';
import 'widgets/checkin_info_card.dart';
import 'widgets/guest_info_card.dart';
import 'widgets/services_card.dart';
import 'widgets/faq_buttons_grid.dart';
import 'widgets/bottom_action_button.dart';
import '../provider_app_travel/current_itinerary_provider.dart';
import '../testdata/orders_data.dart';

/// 订单详情页面
class OrderDetailPage extends StatelessWidget {
  final OrderDetailModel orderDetail;

  const OrderDetailPage({
    super.key,
    required this.orderDetail,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: OrderDetailAppBar(
        orderId: orderDetail.orderId,
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  // 订单状态（包含主题色顶部和入住信息）
                  OrderStatusCard(
                    status: orderDetail.status,
                    checkInDate: orderDetail.checkIn.checkInDate,
                    checkOutDate: orderDetail.checkIn.checkOutDate,
                    nights: orderDetail.checkIn.nights,
                    checkInTime: orderDetail.checkIn.checkInTime,
                    checkOutTime: orderDetail.checkIn.checkOutTime,
                  ),
                  const SizedBox(height: 8),
                  // 支付信息
                  PaymentInfoCard(
                    payment: orderDetail.payment,
                    nights: orderDetail.checkIn.nights,
                  ),
                  const SizedBox(height: 8),
                  // 酒店主信息
                  HotelMainInfoCard(
                    hotel: orderDetail.hotel,
                    orderId: orderDetail.orderId,
                  ),
                  const SizedBox(height: 8),
                  // 入住信息（包含房型）
                  CheckInInfoCard(
                    checkIn: orderDetail.checkIn,
                    room: orderDetail.room,
                  ),
                  const SizedBox(height: 8),
                  // 住客信息
                  GuestInfoCard(
                    guestNames: orderDetail.guestNames,
                    phone: orderDetail.phone,
                    email: orderDetail.email,
                  ),
                  const SizedBox(height: 8),
                  // 服务信息
                  ServicesCard(
                    services: orderDetail.services,
                  ),
                  const SizedBox(height: 8),
                  // 常见问题
                  FAQButtonsGrid(
                    faqOptions: orderDetail.faqOptions,
                    onTapFAQ: (question) => _handleFAQTap(context, question),
                  ),
                  const SizedBox(height: 8),
                  // 推荐酒店
                  HotelRecommendationList(
                    recommendations: orderDetail.recommendations,
                  ),
                  const SizedBox(height: 80), // 底部按钮占位
                ],
              ),
            ),
          ),
          // 底部操作按钮
          BottomActionButton(
            label: '再次预订',
          ),
        ],
      ),
    );
  }

  /// 处理常见问题点击
  Future<void> _handleFAQTap(BuildContext context, String question) async {
    // 检查是否是"如何联系酒店"
    if (question.contains('联系酒店')) {
      final shouldSet = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('设置为当前行程'),
          content: const Text('是否将此订单设置为当前行程？\n设置后将在"我的行程"中显示。'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('取消'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF00D0D8),
              ),
              child: const Text('确定'),
            ),
          ],
        ),
      );

      if (shouldSet == true && context.mounted) {
        try {
          final provider = context.read<CurrentItineraryProvider>();

          // 从订单列表中查找对应的OrderModel
          final allOrders = TestOrdersData.getTestOrders();
          final order = allOrders.firstWhere(
            (o) => o.id == orderDetail.orderId,
            orElse: () => allOrders.first,
          );

          // 设置为当前行程
          final success = await provider.setCurrentItinerary(order);

          if (success && context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('已设置为当前行程'),
                backgroundColor: Color(0xFF00D0D8),
                duration: Duration(seconds: 2),
              ),
            );
          }
        } catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('设置失败: $e'),
                backgroundColor: Colors.red,
              ),
            );
          }
        }
      }
    } else {
      // 其他FAQ选项的默认处理
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(question)),
      );
    }
  }
}
