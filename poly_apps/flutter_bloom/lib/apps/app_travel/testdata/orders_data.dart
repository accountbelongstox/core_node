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
          'guests': ['WEN/YONG'],
          'phone': '177****1996',
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
          'guests': ['WEN/YONG'],
          'phone': '177****1996',
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
        title: 'WEN/YONG',
        subtitle: '豪华双床房 | 1晚 | 不含早餐',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_1.png',
        date: '11月6日 至 11月7日',
        price: '¥27.54',
        quantity: 1,
        statusText: '待点评',
        extraInfo: {
          'orderId': '1106143648023498',
          'startDate': '2025-11-06',
          'checkIn': '11月6日(周四) 12:00',
          'checkOut': '11月7日(周五) 12:00',
          'roomType': '豪华双床房',
          'guests': '1间·2成人',
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
        subtitle: '标准双人房(禁烟) | 5晚',
        imageUrl: 'assets/apps/app_travel/images/order_hotel_saipan.png',
        date: '11月7日 至 11月12日',
        price: '¥4,199.20',
        quantity: 1,
        statusText: '待入住',
        extraInfo: {
          'orderId': '1112143575419830',
          'startDate': '2025-11-07',
          'hotelName': 'Serenti Hotel Saipan',
          'address': '6P69+F6R, Beach Rd, Garapan',
          'checkIn': '11月7日(周五) 15:00后',
          'checkOut': '11月12日(周三) 12:00前',
          'roomType': '标准双人房(禁烟)',
          'bedConfig': '1张双人床 及 1张单人床',
          'breakfast': '无早餐',
          'guests': ['ZHU/DEQIONG', 'XIONG/YINCAN'],
          'phone': '177****1996',
          'email': '286****276@qq.com',
          'paymentType': '延期支付',
          'invoice': '本订单不可开票',
          'shuttleService': '享8.8折·航变无忧·迟到退赔',
          'nights': 5,
          'pricePerNight': '¥839.84',
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
        id: '1112145678901234',
        type: OrderType.flight,
        status: OrderStatus.confirmed,
        title: '塞班 → 吉隆坡',
        subtitle: '单程',
        imageUrl: 'assets/apps/app_travel/images/order_flight_1.png',
        date: '11-12 周三',
        price: '¥6,804',
        quantity: 1,
        statusText: '出票完成',
        extraInfo: {
          'orderId': '1112145678901234',
          'startDate': '2025-11-12',
          'isMultiSegment': true,
          'totalStops': 2,
          'transferCities': ['首尔', '新加坡'],
          'totalDuration': '总时长27h',
          'tripType': '单程',
          'segments': [
            {
              'segmentNo': 1,
              'flightNo': '7C3212',
              'airline': '济州航空',
              'airlineLogo': 'assets/apps/app_travel/images/airline_logo_jeju.png',
              'departure': 'SPN 塞班国际机场',
              'arrival': 'ICN 首尔 仁川国际机场 T1',
              'departureTime': '16:35',
              'arrivalTime': '20:25',
              'departureDate': '2025-11-12',
              'arrivalDate': '2025-11-12',
              'duration': '4h50m',
              'aircraft': '波音737-800(中)',
              'carryOnBaggage': '手提行李 1x7kg',
              'checkedBaggage': '托运行李 1x23kg',
            },
            {
              'segmentNo': 2,
              'flightNo': 'SQ607',
              'airline': '新加坡航空',
              'airlineLogo': 'assets/apps/app_travel/images/airline_logo_singapore.png',
              'departure': 'ICN 首尔 仁川国际机场 T1',
              'arrival': 'SIN 新加坡 樟宜机场',
              'departureTime': '08:50',
              'arrivalTime': '14:25',
              'departureDate': '2025-11-13',
              'arrivalDate': '2025-11-13',
              'duration': '6h35m',
              'aircraft': '波音787(大)',
              'hasMeal': true,
              'layoverBefore': '中转首尔 12h25m',
              'layoverNote': '!过境需签证|重新托运行李|跨天中转',
              'carryOnBaggage': '手提行李 1x7kg',
              'checkedBaggage': '托运行李 1x23kg',
            },
            {
              'segmentNo': 3,
              'flightNo': 'SQ122',
              'airline': '新加坡航空',
              'airlineLogo': 'assets/apps/app_travel/images/airline_logo_singapore.png',
              'departure': 'SIN 新加坡 樟宜机场 T2',
              'arrival': 'KUL 吉隆坡国际机场 T1',
              'departureTime': '16:25',
              'arrivalTime': '17:35',
              'departureDate': '2025-11-13',
              'arrivalDate': '2025-11-13',
              'duration': '1h10m',
              'aircraft': '空客350-900(大)',
              'hasMeal': true,
              'layoverBefore': '中转新加坡 2h',
              'layoverNote': '!不同航站楼|行李直达以机场为准\n√无需过境签',
              'carryOnBaggage': '手提行李 1x7kg',
              'checkedBaggage': '托运行李 1x23kg',
            },
          ],
          'travelReminder': '出行提醒 >',
          'checkInReminder': '请提前3个小时到机场办理登机手续',
          'entryNote': '入境马来西亚须知:凡马来西亚免签入境人员都需在入境前3天内...',
          'bookingNote': '预订提醒:持商务、旅游等短期签证的旅客或免签的旅客建议购...',
          'visaNote': '中转首尔需签证，入境马来西亚须知：凡马来西亚免签入境人员都需在入境前3天内',
          'cancellationPolicy': '不可取消',
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
        id: '1107143698765432',
        type: OrderType.flight,
        status: OrderStatus.confirmed,
        title: '万象 → 首尔(转) → 塞班',
        subtitle: '济州航空 | 经济舱 | 1次转机',
        imageUrl: 'assets/apps/app_travel/images/order_flight_1.png',
        date: '11月7日(周五)',
        price: '¥3,280',
        quantity: 1,
        statusText: '出票完成',
        extraInfo: {
          'orderId': '1107143698765432',
          'startDate': '2025-11-07',
          'isMultiSegment': true,
          'totalStops': 1,
          'transferCity': '首尔',
          'segments': [
            {
              'segmentNo': 1,
              'flightNo': '7C2402',
              'airline': '济州航空',
              'departure': '瓦岱',
              'arrival': '仁川国际 T1',
              'departureTime': '01:25',
              'arrivalTime': '08:05',
              'departureDate': '2025-11-07',
              'arrivalDate': '2025-11-07',
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
              'departureDate': '2025-11-07',
              'arrivalDate': '2025-11-07',
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
