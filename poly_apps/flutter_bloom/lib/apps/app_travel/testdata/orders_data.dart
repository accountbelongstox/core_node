import '../models_app_travel/order_model.dart';
import 'package:flutter/material.dart';

class TestOrdersData {
  static List<OrderModel> getTestOrders() {
    return [
      OrderModel(
        id: 'ORDER001',
        type: OrderType.hotel,
        status: OrderStatus.pending,
        title: '北京王府井希尔顿酒店',
        subtitle: '高级双床房 | 2晚',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_1.png',
        date: '2024-01-15 至 2024-01-17',
        price: '¥1,280',
        quantity: 1,
        extraInfo: {
          'checkIn': '2024-01-15 14:00',
          'checkOut': '2024-01-17 12:00',
          'roomType': '高级双床房',
        },
        actions: [
          OrderAction(
            label: '立即支付',
            color: const Color(0xFFFF6B35),
            onTap: () => debugPrint('Pay order ORDER001'),
            isPrimary: true,
          ),
          OrderAction(
            label: '取消订单',
            onTap: () => debugPrint('Cancel order ORDER001'),
          ),
        ],
      ),
      OrderModel(
        id: 'ORDER002',
        type: OrderType.flight,
        status: OrderStatus.traveling,
        title: '北京首都国际机场 → 上海浦东国际机场',
        subtitle: 'CA1234 | 经济舱',
        imageUrl: 'assets/apps/app_travel/images/order_flight_1.png',
        date: '2024-01-20 08:30',
        price: '¥850',
        quantity: 1,
        statusText: '待出行',
        extraInfo: {
          'flightNo': 'CA1234',
          'departure': '北京首都国际机场 T3',
          'arrival': '上海浦东国际机场 T2',
          'departureTime': '08:30',
          'arrivalTime': '10:50',
        },
        actions: [
          OrderAction(
            label: '查看行程',
            color: const Color(0xFF00D0D8),
            onTap: () => debugPrint('View trip ORDER002'),
            isPrimary: true,
          ),
          OrderAction(
            label: '退改签',
            onTap: () => debugPrint('Refund/Change ORDER002'),
          ),
        ],
      ),
      OrderModel(
        id: 'ORDER003',
        type: OrderType.train,
        status: OrderStatus.confirmed,
        title: '北京南站 → 上海虹桥站',
        subtitle: 'G123次 | 二等座',
        imageUrl: 'assets/apps/app_travel/images/order_train_1.png',
        date: '2024-01-25 09:00',
        price: '¥553',
        quantity: 2,
        statusText: '已确认',
        extraInfo: {
          'trainNo': 'G123',
          'departure': '北京南站',
          'arrival': '上海虹桥站',
          'departureTime': '09:00',
          'arrivalTime': '14:28',
          'seatType': '二等座',
        },
        actions: [
          OrderAction(
            label: '查看车票',
            color: const Color(0xFF00D0D8),
            onTap: () => debugPrint('View ticket ORDER003'),
            isPrimary: true,
          ),
          OrderAction(
            label: '改签',
            onTap: () => debugPrint('Change ticket ORDER003'),
          ),
        ],
      ),
      OrderModel(
        id: 'ORDER004',
        type: OrderType.scenic,
        status: OrderStatus.completed,
        title: '故宫博物院门票',
        subtitle: '成人票 x 2',
        imageUrl: 'assets/apps/app_travel/images/order_scenic_1.png',
        date: '2024-01-10',
        price: '¥120',
        quantity: 2,
        statusText: '待点评',
        extraInfo: {
          'ticketType': '成人票',
          'validDate': '2024-01-10',
          'used': true,
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review ORDER004'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次购买',
            onTap: () => debugPrint('Buy again ORDER004'),
          ),
        ],
      ),
      OrderModel(
        id: 'ORDER005',
        type: OrderType.tour,
        status: OrderStatus.refunding,
        title: '三亚5天4晚跟团游',
        subtitle: '含机票+酒店+导游',
        imageUrl: 'assets/apps/app_travel/images/order_tour_1.png',
        date: '2024-02-01 至 2024-02-05',
        price: '¥3,680',
        quantity: 2,
        statusText: '退款中',
        statusColor: const Color(0xFFFF3B30),
        extraInfo: {
          'packageType': '跟团游',
          'includes': ['机票', '酒店', '导游', '部分餐食'],
          'refundReason': '行程变更',
        },
        actions: [
          OrderAction(
            label: '查看退款进度',
            color: const Color(0xFFFF3B30),
            onTap: () => debugPrint('View refund status ORDER005'),
            isPrimary: true,
          ),
        ],
      ),
      OrderModel(
        id: 'ORDER006',
        type: OrderType.hotel,
        status: OrderStatus.pending,
        title: '上海外滩茂悦大酒店',
        subtitle: '豪华江景房 | 1晚',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_2.png',
        date: '2024-01-22',
        price: '¥1,680',
        quantity: 1,
        extraInfo: {
          'checkIn': '2024-01-22 15:00',
          'checkOut': '2024-01-23 12:00',
          'roomType': '豪华江景房',
        },
        actions: [
          OrderAction(
            label: '立即支付',
            color: const Color(0xFFFF6B35),
            onTap: () => debugPrint('Pay order ORDER006'),
            isPrimary: true,
          ),
          OrderAction(
            label: '取消订单',
            onTap: () => debugPrint('Cancel order ORDER006'),
          ),
        ],
      ),
      OrderModel(
        id: 'ORDER007',
        type: OrderType.scenic,
        status: OrderStatus.traveling,
        title: '长城八达岭景区门票',
        subtitle: '成人票 x 3',
        imageUrl: 'assets/apps/app_travel/images/order_scenic_2.png',
        date: '2024-01-18',
        price: '¥120',
        quantity: 3,
        statusText: '待使用',
        extraInfo: {
          'ticketType': '成人票',
          'validDate': '2024-01-18',
          'used': false,
        },
        actions: [
          OrderAction(
            label: '查看二维码',
            color: const Color(0xFF00D0D8),
            onTap: () => debugPrint('View QR code ORDER007'),
            isPrimary: true,
          ),
          OrderAction(
            label: '申请退款',
            onTap: () => debugPrint('Refund ORDER007'),
          ),
        ],
      ),
      OrderModel(
        id: 'ORDER008',
        type: OrderType.flight,
        status: OrderStatus.refunded,
        title: '上海虹桥国际机场 → 广州白云国际机场',
        subtitle: 'MU5678 | 经济舱',
        imageUrl: 'assets/apps/app_travel/images/order_flight_2.png',
        date: '2024-01-05 14:30',
        price: '¥680',
        quantity: 1,
        statusText: '已退款',
        statusColor: const Color(0xFF999999),
        extraInfo: {
          'flightNo': 'MU5678',
          'refunded': true,
          'refundAmount': '¥612',
          'refundDate': '2024-01-03',
        },
        actions: [
          OrderAction(
            label: '删除订单',
            onTap: () => debugPrint('Delete order ORDER008'),
          ),
        ],
      ),
    ];
  }

  static List<OrderModel> filterOrders(List<OrderModel> orders, String filter) {
    return orders.where((order) => order.matchesFilter(filter)).toList();
  }

  static Map<String, int> getOrderCounts(List<OrderModel> orders) {
    return {
      '全部': orders.length,
      '待支付': orders.where((o) => o.status == OrderStatus.pending).length,
      '待出行': orders.where((o) => o.status == OrderStatus.traveling || o.status == OrderStatus.confirmed).length,
      '退款/售后': orders.where((o) => o.status == OrderStatus.refunding || o.status == OrderStatus.refunded).length,
      '待点评': orders.where((o) => o.status == OrderStatus.completed).length,
    };
  }
}
