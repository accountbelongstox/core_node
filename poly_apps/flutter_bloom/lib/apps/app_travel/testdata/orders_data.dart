import '../models_app_travel/order_model.dart';
import 'package:flutter/material.dart';

class TestOrdersData {
  static List<OrderModel> getTestOrders() {
    return [
      OrderModel(
        id: '1722145123456789',
        type: OrderType.train,
        status: OrderStatus.completed,
        title: '西双版纳站 → 万象站',
        subtitle: 'C888次 | 二等座',
        imageUrl: 'assets/apps/app_travel/images/order_train_1.png',
        date: '2025-07-22 09:30',
        price: '¥570',
        quantity: 1,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1722145123456789',
          'startDate': '2025-07-22',
          'trainNo': 'C888',
          'departure': '西双版纳站',
          'arrival': '万象站',
          'departureTime': '09:30',
          'arrivalTime': '11:45',
          'seatType': '二等座',
          'route': '中老铁路',
          'isInternational': true,
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1722145123456789'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次购买',
            onTap: () => debugPrint('Buy again 1722145123456789'),
          ),
        ],
      ),
      OrderModel(
        id: '1723145234567890',
        type: OrderType.hotel,
        status: OrderStatus.completed,
        title: '湖南大酒店',
        subtitle: '豪华双床房 | 4晚',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_hunan.png',
        date: '7月23日 至 7月27日',
        price: '¥1,680',
        quantity: 1,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1723145234567890',
          'startDate': '2025-07-23',
          'hotelName': '湖南大酒店',
          'hotelNameEn': 'Hunan Hotel Vientiane',
          'address': '老挝万象市T3路龙拉锁红绿灯路口 Traffic light of Longnasuo Village, Thalat, Thalat, Laos',
          'checkIn': '7月23日(周三) 14:00后',
          'checkOut': '7月27日(周日) 12:00前',
          'roomType': '豪华双床房',
          'bedConfig': '2张大床',
          'breakfast': '含早餐',
          'guests': ['XIONG YIN CAN'],
          'phone': '18984121454',
          'nights': 4,
          'pricePerNight': '¥420',
          'description': '位于万象市中心，交通便利，房间宽敞舒适，设施现代化，提供免费WiFi和停车服务。',
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1723145234567890'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次预订',
            onTap: () => debugPrint('Book again 1723145234567890'),
          ),
        ],
      ),
      OrderModel(
        id: '1805145345678901',
        type: OrderType.hotel,
        status: OrderStatus.completed,
        title: '湖南大酒店',
        subtitle: '豪华双床房 | 10晚',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_hunan.png',
        date: '8月5日 至 8月15日',
        price: '¥4,200',
        quantity: 1,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1805145345678901',
          'startDate': '2025-08-05',
          'hotelName': '湖南大酒店',
          'hotelNameEn': 'Hunan Hotel Vientiane',
          'address': '老挝万象市T3路龙拉锁红绿灯路口 Traffic light of Longnasuo Village, Thalat, Thalat, Laos',
          'checkIn': '8月5日(周二) 14:00后',
          'checkOut': '8月15日(周五) 12:00前',
          'roomType': '豪华双床房',
          'bedConfig': '2张大床',
          'breakfast': '含早餐',
          'guests': ['XIONG YIN CAN'],
          'phone': '18984121454',
          'nights': 10,
          'pricePerNight': '¥420',
          'description': '位于万象市中心，交通便利，房间宽敞舒适，设施现代化，提供免费WiFi和停车服务。',
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1805145345678901'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次预订',
            onTap: () => debugPrint('Book again 1805145345678901'),
          ),
        ],
      ),
      OrderModel(
        id: '1106143648023498',
        type: OrderType.hotel,
        status: OrderStatus.completed,
        title: 'XIONG YIN CAN',
        subtitle: '豪华双床房 | 1晚 | 不含早餐',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_1.png',
        date: '2月28日 至 3月1日',
        price: '¥27.54',
        quantity: 1,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1106143648023498',
          'startDate': '2026-02-28',
          'checkIn': '2月28日(周六) 12:00',
          'checkOut': '3月1日(周日) 12:00',
          'roomType': '豪华双床房',
          'guests': '1间·1成人',
          'breakfast': '不含早餐',
          'cancellationPolicy': '不可取消',
          'originalPrice': '¥34.43',
          'discount': '中南半岛Country Banner 20% off',
          'discountAmount': '-¥6.89',
          'income': 'USD 25.82',
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1106143648023498'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次预订',
            onTap: () => debugPrint('Book again 1106143648023498'),
          ),
        ],
      ),
      OrderModel(
        id: '1112143575419830',
        type: OrderType.hotel,
        status: OrderStatus.confirmed,
        title: '塞班塞伦提酒店',
        subtitle: '标准双人房(禁烟) | 1晚',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_saipan.png',
        date: '3月1日 至 3月2日',
        price: '¥720',
        quantity: 1,
        statusText: '待入住',
        extraInfo: {
          'orderId': '1112143575419830',
          'startDate': '2026-03-01',
          'hotelName': 'Serenti Hotel Saipan',
          'address': '6P69+F6R, Beach Rd, Garapan',
          'checkIn': '3月1日(周日) 15:00后',
          'checkOut': '3月2日(周一) 12:00前',
          'roomType': '标准双人房(禁烟)',
          'bedConfig': '1张双人床 及 1张单人床',
          'breakfast': '无早餐',
          'guests': ['XIONG YIN CAN'],
          'phone': '18984121454',
          'email': 'cy00000000x@gmail.com',
          'paymentType': '延期支付',
          'invoice': '本订单不可开票',
          'shuttleService': '享8.8折·航变无忧·迟到退赔',
          'nights': 1,
          'pricePerNight': '¥720',
        },
        actions: [
          OrderAction(
            label: '查看详情',
            color: const Color(0xFF00D0D8),
            onTap: () => debugPrint('View order 1112143575419830'),
            isPrimary: true,
          ),
          OrderAction(
            label: '联系酒店',
            onTap: () => debugPrint('Contact hotel'),
          ),
          OrderAction(
            label: '修改订单',
            onTap: () => debugPrint('Modify order 1112143575419830'),
          ),
        ],
      ),
      OrderModel(
        id: '1112143575419831',
        type: OrderType.hotel,
        status: OrderStatus.confirmed,
        title: '塞班塞伦提酒店',
        subtitle: '标准双人房(禁烟) | 5晚',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_saipan.png',
        date: '3月2日 至 3月7日',
        price: '¥3,600',
        quantity: 1,
        statusText: '待入住',
        extraInfo: {
          'orderId': '1112143575419831',
          'startDate': '2026-03-02',
          'hotelName': 'Serenti Hotel Saipan',
          'address': '6P69+F6R, Beach Rd, Garapan',
          'checkIn': '3月2日(周一) 15:00后',
          'checkOut': '3月7日(周六) 12:00前',
          'roomType': '标准双人房(禁烟)',
          'bedConfig': '1张双人床 及 1张单人床',
          'breakfast': '无早餐',
          'guests': ['XIONG YIN CAN'],
          'phone': '18984121454',
          'email': 'cy00000000x@gmail.com',
          'paymentType': '延期支付',
          'invoice': '本订单不可开票',
          'shuttleService': '享8.8折·航变无忧·迟到退赔',
          'nights': 5,
          'pricePerNight': '¥720',
        },
        actions: [
          OrderAction(
            label: '查看详情',
            color: const Color(0xFF00D0D8),
            onTap: () => debugPrint('View order 1112143575419831'),
            isPrimary: true,
          ),
          OrderAction(
            label: '联系酒店',
            onTap: () => debugPrint('Contact hotel'),
          ),
          OrderAction(
            label: '修改订单',
            onTap: () => debugPrint('Modify order 1112143575419831'),
          ),
        ],
      ),
      OrderModel(
        id: '1112145678901234',
        type: OrderType.flight,
        status: OrderStatus.confirmed,
        title: '塞班 → 中国香港',
        subtitle: '济州航空 | 经济舱 | 1次转机',
        imageUrl: 'assets/apps/app_travel/images/order_flight_1.png',
        date: '03-07周六 至 03-08周日',
        price: '¥1,865',
        quantity: 1,
        statusText: '出票完成',
        extraInfo: {
          'orderId': '1112145678901234',
          'startDate': '2026-03-07',
          'isMultiSegment': true,
          'totalStops': 1,
          'transferCities': ['首尔'],
          'totalDuration': '总时长约22h20m',
          'tripType': '单程',
          'passengerType': '单成人',
          'priceNote': '含税价',
          'refundNote': '退票350元起，改期470元起',
          'baggageNote': '每人托运1件，每件23KG',
          'segments': [
            {
              'segmentNo': 1,
              'flightNo': '7C3212',
              'airline': '济州航空',
              'airlineLogo': 'assets/apps/app_travel/images/airline_logo_jeju.png',
              'departure': 'SPN 塞班国际机场',
              'arrival': 'ICN 仁川国际机场T1',
              'departureTime': '16:35',
              'arrivalTime': '20:25',
              'departureDate': '2026-03-07',
              'arrivalDate': '2026-03-07',
              'duration': '4h50m',
              'aircraft': '波音737(中)',
              'cabin': '经济舱',
              'carryOnBaggage': '手提行李 1x7kg',
              'checkedBaggage': '托运行李 1件23KG',
            },
            {
              'segmentNo': 2,
              'flightNo': '7C6021',
              'airline': '济州航空',
              'airlineLogo': 'assets/apps/app_travel/images/airline_logo_jeju.png',
              'departure': 'ICN 仁川国际机场T1',
              'arrival': 'HKG 香港国际机场T1',
              'departureTime': '09:50',
              'arrivalTime': '12:55',
              'departureDate': '2026-03-08',
              'arrivalDate': '2026-03-08',
              'duration': '4h5m',
              'aircraft': '波音737(中)',
              'cabin': '经济舱',
              'hasMeal': false,
              'layoverBefore': '首尔中转 13h25m',
              'layoverNote': '行李直达',
              'carryOnBaggage': '手提行李 1x7kg',
              'checkedBaggage': '托运行李 1件23KG',
            },
          ],
          'travelReminder': '出行提醒 >',
          'checkInReminder': '请提前3个小时到机场办理登机手续',
          'entryNote': '经韩国转机前往中国香港，持中国大陆护照一般无需韩国过境签证，具体以官方信息为准。',
          'bookingNote': '中转跨天，可选择机场候机或附近酒店休息，请合理安排行程时间。',
          'visaNote': '此行程经韩国转机，持中国大陆护照旅客通常无需办理韩国过境签证。',
          'cancellationPolicy': '退票350元起，改期470元起',
          'insurance': '延误安心包 ¥48',
        },
        actions: [
          OrderAction(
            label: '查看行程',
            color: const Color(0xFF00D0D8),
            onTap: () => debugPrint('View multi-segment trip 1112145678901234'),
            isPrimary: true,
          ),
          OrderAction(
            label: '在线客服',
            onTap: () => debugPrint('Contact customer service'),
          ),
          OrderAction(
            label: '航班动态',
            onTap: () => debugPrint('View flight status'),
          ),
        ],
      ),
      OrderModel(
        id: '1128146045999095',
        type: OrderType.flight,
        status: OrderStatus.confirmed,
        title: '万象 → 首尔(转) → 塞班',
        subtitle: '济州航空 | 经济舱 | 1次转机',
        imageUrl: 'assets/apps/app_travel/images/order_flight_1.png',
        date: '3月1日(周日)',
        price: '¥4,251',
        quantity: 1,
        statusText: '出票完成',
        extraInfo: {
          'orderId': '1128146045999095',
          'startDate': '2026-03-01',
          'isMultiSegment': true,
          'totalStops': 1,
          'transferCity': '首尔',
          'expectedPoints': 859,
          'segments': [
            {
              'segmentNo': 1,
              'flightNo': '7C2402',
              'airline': '济州航空',
              'departure': '瓦岱',
              'arrival': '仁川国际 T1',
              'departureTime': '01:25',
              'arrivalTime': '08:05',
              'departureDate': '2026-03-01',
              'arrivalDate': '2026-03-01',
              'duration': '4小时40分',
              'carryOnBaggage': '手提行李 1件',
              'checkedBaggage': '托运行李 1件15KG(28寸)',
              'checkInCounter': '21-25',
              'onTimeRate': '准点率: 77%',
            },
            {
              'segmentNo': 2,
              'flightNo': '7C3211',
              'airline': '济州航空',
              'departure': '仁川国际 T1',
              'arrival': '塞班机场',
              'departureTime': '10:10',
              'arrivalTime': '15:30',
              'departureDate': '2026-03-01',
              'arrivalDate': '2026-03-01',
              'duration': '4小时20分',
              'carryOnBaggage': '手提行李 1件',
              'checkedBaggage': '托运行李 1件15KG(28寸)',
              'checkInCounter': 'L13-L36',
              'gate': '登机口 37',
              'onTimeRate': '准点率: 97%',
            },
          ],
          'layoverTime': '2小时5分',
          'totalDuration': '约14小时5分',
          'checkInReminder': '请提前3个小时到机场办理登机手续',
          'cancellationPolicy': '不可取消',
          'tripType': '单程',
        },
        actions: [
          OrderAction(
            label: '查看行程',
            color: const Color(0xFF00D0D8),
            onTap: () => debugPrint('View multi-segment trip'),
            isPrimary: true,
          ),
          OrderAction(
            label: '在线客服',
            onTap: () => debugPrint('Contact customer service'),
          ),
          OrderAction(
            label: '航班动态',
            onTap: () => debugPrint('View flight status'),
          ),
        ],
      ),
      OrderModel(
        id: '1125143782456123',
        type: OrderType.train,
        status: OrderStatus.completed,
        title: '北京南站 → 上海虹桥站',
        subtitle: 'G123次 | 二等座',
        imageUrl: 'assets/apps/app_travel/images/order_train_1.png',
        date: '2024-01-25 09:00',
        price: '¥553',
        quantity: 2,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1125143782456123',
          'trainNo': 'G123',
          'departure': '北京南站',
          'arrival': '上海虹桥站',
          'departureTime': '09:00',
          'arrivalTime': '14:28',
          'seatType': '二等座',
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1125143782456123'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次购买',
            onTap: () => debugPrint('Buy again 1125143782456123'),
          ),
        ],
      ),
      OrderModel(
        id: '1110143891234567',
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
          'orderId': '1110143891234567',
          'ticketType': '成人票',
          'validDate': '2024-01-10',
          'used': true,
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1110143891234567'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次购买',
            onTap: () => debugPrint('Buy again 1110143891234567'),
          ),
        ],
      ),
      OrderModel(
        id: '1201143945678901',
        type: OrderType.tour,
        status: OrderStatus.completed,
        title: '三亚5天4晚跟团游',
        subtitle: '含机票+酒店+导游',
        imageUrl: 'assets/apps/app_travel/images/order_tour_1.png',
        date: '2024-02-01 至 2024-02-05',
        price: '¥3,680',
        quantity: 2,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1201143945678901',
          'packageType': '跟团游',
          'includes': ['机票', '酒店', '导游', '部分餐食'],
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1201143945678901'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次购买',
            onTap: () => debugPrint('Buy again 1201143945678901'),
          ),
        ],
      ),
      OrderModel(
        id: '1122144023456789',
        type: OrderType.hotel,
        status: OrderStatus.completed,
        title: '上海外滩茂悦大酒店',
        subtitle: '豪华江景房 | 1晚',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_2.png',
        date: '2024-01-22',
        price: '¥1,680',
        quantity: 1,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1122144023456789',
          'checkIn': '2024-01-22 15:00',
          'checkOut': '2024-01-23 12:00',
          'roomType': '豪华江景房',
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1122144023456789'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次预订',
            onTap: () => debugPrint('Book again 1122144023456789'),
          ),
        ],
      ),
      OrderModel(
        id: '1118144156789012',
        type: OrderType.scenic,
        status: OrderStatus.completed,
        title: '长城八达岭景区门票',
        subtitle: '成人票 x 3',
        imageUrl: 'assets/apps/app_travel/images/order_scenic_2.png',
        date: '2024-01-18',
        price: '¥120',
        quantity: 3,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1118144156789012',
          'ticketType': '成人票',
          'validDate': '2024-01-18',
          'used': true,
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1118144156789012'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次购买',
            onTap: () => debugPrint('Buy again 1118144156789012'),
          ),
        ],
      ),
      OrderModel(
        id: '1105144287654321',
        type: OrderType.flight,
        status: OrderStatus.completed,
        title: '上海虹桥国际机场 → 广州白云国际机场',
        subtitle: 'MU5678 | 经济舱',
        imageUrl: 'assets/apps/app_travel/images/order_flight_2.png',
        date: '2024-01-05 14:30',
        price: '¥680',
        quantity: 1,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1105144287654321',
          'flightNo': 'MU5678',
          'cancellationPolicy': '不可取消',
        },
        actions: [
          OrderAction(
            label: '立即点评',
            color: const Color(0xFFFF9A56),
            onTap: () => debugPrint('Review 1105144287654321'),
            isPrimary: true,
          ),
          OrderAction(
            label: '再次购买',
            onTap: () => debugPrint('Buy again 1105144287654321'),
          ),
        ],
      ),
    ];
  }

  static List<OrderModel> filterOrders(List<OrderModel> orders, String filter) {
    final filtered = orders.where((order) => order.matchesFilter(filter)).toList();

    // 按开始日期降序排列（最新的在前）
    filtered.sort((a, b) {
      final aStartDate = _parseStartDate(a);
      final bStartDate = _parseStartDate(b);
      return bStartDate.compareTo(aStartDate); // 降序
    });

    return filtered;
  }

  /// 从订单中提取开始日期
  static DateTime _parseStartDate(OrderModel order) {
    // 优先使用 extraInfo 中的 startDate
    if (order.extraInfo?['startDate'] != null) {
      try {
        return DateTime.parse(order.extraInfo!['startDate']);
      } catch (e) {
        // 解析失败，继续尝试其他方法
      }
    }

    // 尝试从 date 字段解析
    final dateStr = order.date;

    // 格式1: "11月6日 至 11月7日" -> 提取开始日期 "11月6日"
    if (dateStr.contains('至')) {
      final parts = dateStr.split('至');
      return _parseChineseDate(parts[0].trim());
    }

    // 格式2: "11月12日(周三)" -> "11月12日"
    if (dateStr.contains('月') && dateStr.contains('日')) {
      return _parseChineseDate(dateStr);
    }

    // 格式3: "2024-01-05 14:30" -> 标准ISO格式
    try {
      return DateTime.parse(dateStr);
    } catch (e) {
      // 解析失败，返回一个默认日期（最旧）
      return DateTime(2000, 1, 1);
    }
  }

  /// 解析中文日期格式 "11月6日" 或 "11月12日(周三)"
  static DateTime _parseChineseDate(String dateStr) {
    try {
      // 移除括号内容和空格
      final cleaned = dateStr.replaceAll(RegExp(r'\(.*?\)'), '').trim();

      // 提取月份和日期
      final monthMatch = RegExp(r'(\d+)月').firstMatch(cleaned);
      final dayMatch = RegExp(r'(\d+)日').firstMatch(cleaned);

      if (monthMatch != null && dayMatch != null) {
        final month = int.parse(monthMatch.group(1)!);
        final day = int.parse(dayMatch.group(1)!);

        // 使用当前年份（2024年）作为基准
        // 如果是11月、12月，使用2024年
        // 如果是1-10月，可能是2025年（假设订单在未来）
        final now = DateTime.now();
        int year = now.year;

        // 如果当前是11月/12月，而解析的月份是1-10月，则年份+1
        if (now.month >= 11 && month < 11) {
          year = now.year + 1;
        }

        return DateTime(year, month, day);
      }
    } catch (e) {
      // 解析失败
    }

    // 返回默认日期
    return DateTime(2000, 1, 1);
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
