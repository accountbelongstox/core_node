import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../models_app_travel/hot_content_model.dart';
import '../../../models_app_travel/travel_inspiration_model.dart';
import '../../../models_app_travel/order_model.dart';
import '../../../models_app_travel/travel_map_model.dart';
import '../../../testdata/journey_data.dart';
import '../../../testdata/travel_map_data.dart';
import '../../../provider_app_travel/current_itinerary_provider.dart';
import '../../../provider_app_travel/traveler_provider_app_travel.dart';
import '../../../resources_app_travel/assets_images_app_travel.dart';
import '../../../new_order/order_detail_page.dart';
import '../../../new_order/utils/order_converter.dart';
import '../../flight_detail/flight_order_detail_page.dart';

/// Tab widget for displaying "My Itinerary" content
/// Includes current itinerary order, travel inspiration, and hot picks sections
class MyItineraryTab extends StatefulWidget {
  const MyItineraryTab({super.key});

  @override
  State<MyItineraryTab> createState() => _MyItineraryTabState();
}

class _MyItineraryTabState extends State<MyItineraryTab>
    with AutomaticKeepAliveClientMixin {
  List<TravelInspirationModel> _inspirations = [];
  List<HotContentModel> _hotContents = [];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() {
    // Load data from testdata (similar to orders_data.dart pattern)
    _inspirations = TestJourneyData.getTravelInspirations();
    _hotContents = TestJourneyData.getHotContents();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Consumer<CurrentItineraryProvider>(
      builder: (context, itineraryProvider, child) {
        final currentOrder = itineraryProvider.currentItinerary;

        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              // 公众号关注提示（如果有当前行程）
              if (currentOrder != null) _buildWechatFollowBanner(),

              // Current itinerary order card
              if (currentOrder != null)
                _buildDetailedItineraryCard(currentOrder)
              else
                _buildEmptyState(),
              if (_inspirations.isNotEmpty) _buildTravelInspiration(),
              if (_hotContents.isNotEmpty) _buildHotSelection(),
            ],
          ),
        );
      },
    );
  }

  /// 公众号关注提示横幅
  Widget _buildWechatFollowBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFF00D0D8).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.wechat_outlined,
              color: Color(0xFF00D0D8),
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              '关注公众号，行程变动实时推送',
              style: TextStyle(
                fontSize: 14,
                color: Colors.black87,
              ),
            ),
          ),
          const Icon(
            Icons.chevron_right,
            size: 20,
            color: Colors.black26,
          ),
        ],
      ),
    );
  }

  /// Build detailed itinerary card
  Widget _buildDetailedItineraryCard(OrderModel order) {
    final extraInfo = order.extraInfo ?? {};
    final segments = extraInfo['segments'] as List?;
    final hasMultipleSegments = segments != null && segments.length > 1;

    debugPrint('=== Building itinerary card for order ${order.id} (${order.title}) ===');
    debugPrint('Has multiple segments: $hasMultipleSegments');
    debugPrint('Total segments: ${segments?.length ?? 0}');

    // Filter future segments
    final futureSegments = _getFutureSegments(segments);

    debugPrint('Future segments count: ${futureSegments.length}');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Date header
        _buildDateHeader(order),
        const SizedBox(height: 12),

        // Display segments or single segment
        if (hasMultipleSegments && futureSegments.isNotEmpty)
          ...futureSegments.map((segment) {
            return Column(
              children: [
                _buildGreenTipCard(segment: segment),
                _buildFlightDetailCard(order, segment: segment),
                const SizedBox(height: 16),
                _buildCheckinServiceCard(context, order),
                const SizedBox(height: 12),
              ],
            );
          }).toList()
        else if (!hasMultipleSegments && segments != null && segments.isNotEmpty) ...[
          // Single segment display
          _buildGreenTipCard(segment: segments.first),
          _buildFlightDetailCard(order, segment: segments.first),
          const SizedBox(height: 16),
          _buildCheckinServiceCard(context, order),
          const SizedBox(height: 12),
        ],

        // Show map and transfer cards only once at the end
        if (futureSegments.isNotEmpty || (!hasMultipleSegments && segments != null && segments.isNotEmpty)) ...[
          _buildFunMapCard(context, order),
          const SizedBox(height: 12),
          _buildTransferServiceCard(context, order),
          const SizedBox(height: 32),
        ],
      ],
    );
  }

  /// Get future segments (segments that haven't departed yet)
  List<dynamic> _getFutureSegments(List? segments) {
    if (segments == null || segments.isEmpty) return [];

    final now = DateTime.now();
    debugPrint('Current time: $now');
    debugPrint('Total segments: ${segments.length}');

    final futureSegments = segments.where((segment) {
      final segmentDate = _parseSegmentDate(segment);
      final isFuture = segmentDate.isAfter(now);
      debugPrint('Segment date: $segmentDate, is future: $isFuture');
      return isFuture;
    }).toList();

    debugPrint('Future segments count: ${futureSegments.length}');
    return futureSegments;
  }

  /// Parse segment date
  DateTime _parseSegmentDate(dynamic segment) {
    final departureTime = segment['departureTime'] as String? ?? '';
    final departureDate = segment['departureDate'] as String? ?? '';

    // If has full date
    if (departureDate.isNotEmpty) {
      try {
        // Combine date and time if available
        if (departureTime.contains(':')) {
          final timeParts = departureTime.split(':');
          if (timeParts.length >= 2) {
            final hour = int.parse(timeParts[0]);
            final minute = int.parse(timeParts[1]);
            final dateParts = departureDate.split('-');
            if (dateParts.length == 3) {
              final year = int.parse(dateParts[0]);
              final month = int.parse(dateParts[1]);
              final day = int.parse(dateParts[2]);
              final result = DateTime(year, month, day, hour, minute);
              debugPrint('Parsed segment date: $result from $departureDate $departureTime');
              return result;
            }
          }
        }
        final result = DateTime.parse(departureDate);
        debugPrint('Parsed segment date (no time): $result from $departureDate');
        return result;
      } catch (e) {
        debugPrint('Error parsing segment date: $e');
      }
    }

    // Fallback to future date
    debugPrint('Fallback: using future date for segment');
    return DateTime.now().add(const Duration(days: 1));
  }

  /// 日期标题
  Widget _buildDateHeader(OrderModel order) {
    final destination = _getDestination(order);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          const Icon(
            Icons.calendar_today,
            size: 20,
            color: Colors.black54,
          ),
          const SizedBox(width: 8),
          Text(
            order.date,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          if (destination.isNotEmpty) ...[
            const SizedBox(width: 8),
            Text(
              '· 前往$destination',
              style: const TextStyle(
                fontSize: 14,
                color: Colors.black54,
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// 获取目的地
  String _getDestination(OrderModel order) {
    final parts = order.title.split('→');
    if (parts.length > 1) {
      return parts.last.trim().replaceAll(RegExp(r'\(.*?\)'), '').trim();
    }
    return '';
  }

  /// 绿色提示卡片
  Widget _buildGreenTipCard({dynamic segment}) {
    final onTimeRate = segment?['onTimeRate'] ?? '准点率: 77%';
    final tipText = '计划｜$onTimeRate, 请提前3个小时到机场办理登机手续。';

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Color(0xFF00C9A7),
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      child: SizedBox(
        width: double.infinity,
        child: Text(
          tipText,
          style: const TextStyle(
            fontSize: 13,
            color: Colors.white,
            height: 1.4,
          ),
        ),
      ),
    );
  }

  /// 获取航空公司logo路径
  String _getAirlineLogo(String airlineName) {
    const airlineLogoMap = {
      '济州航空': 'assets/apps/app_travel/images/airline_logo_jeju.png',
      '新加坡航空': 'assets/apps/app_travel/images/airline_logo_singapore.png',
    };

    return airlineLogoMap[airlineName] ?? 'assets/apps/app_travel/images/airline_logo_jeju.png';
  }

  /// 航班详细信息卡片
  Widget _buildFlightDetailCard(OrderModel order, {dynamic segment}) {
    final displaySegment = segment;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // 航班号和出票状态
          _buildFlightHeader(order, displaySegment),
          const Divider(height: 1),

          // 起飞到达时间
          _buildFlightTimes(displaySegment),

          // 行李和值机信息
          _buildBaggageInfo(displaySegment),

          const Divider(height: 1, thickness: 1),

          // 服务按钮
          _buildServiceButtons(context, order),
        ],
      ),
    );
  }

  /// 航班号和出票状态
  Widget _buildFlightHeader(OrderModel order, dynamic segment) {
    final flightNumber = segment?['flightNo'] ?? segment?['flightNumber'] ?? '';
    final airline = segment?['airline'] ?? '';
    final airlineLogo = _getAirlineLogo(airline);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          // 航空公司Logo
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Image.asset(
                airlineLogo,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF6B35),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Center(
                      child: Text(
                        airline.isNotEmpty ? airline[0] : 'A',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$flightNumber $airline',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  order.title,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.black54,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => _navigateToOrderDetail(order),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF0F0F0),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '出票完成',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.black54,
                    ),
                  ),
                  SizedBox(width: 4),
                  Icon(
                    Icons.chevron_right,
                    size: 16,
                    color: Colors.black38,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 起飞到达时间
  Widget _buildFlightTimes(dynamic segment) {
    final departureTime = segment?['departureTime'] ?? '01:25';
    final arrivalTime = segment?['arrivalTime'] ?? '08:05';
    final departureCity = segment?['departure'] ?? '瓦岱';
    final arrivalCity = segment?['arrival'] ?? '仁川国际 T1';
    final duration = segment?['duration'] ?? '4小时40分';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Row(
        children: [
          // 出发
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '计划(当地时间)',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.black38,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  departureTime,
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  departureCity,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.black54,
                  ),
                ),
              ],
            ),
          ),

          // 中间飞机图标和时长
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Column(
              children: [
                Image.asset(
                  AssetsImagesAppTravel.travelFlightIcon,
                  width: 84,
                  height: 32,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) {
                    return const Icon(
                      Icons.flight,
                      size: 32,
                      color: Colors.black26,
                    );
                  },
                ),
                const SizedBox(height: 4),
                Text(
                  duration,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Colors.black38,
                  ),
                ),
              ],
            ),
          ),

          // 到达
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  '计划(当地时间)',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.black38,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  arrivalTime,
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  arrivalCity,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.black54,
                  ),
                  textAlign: TextAlign.right,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 行李和值机信息
  Widget _buildBaggageInfo(dynamic segment) {
    final carryOn = segment?['carryOnBaggage'] ?? '手提行李 1件';
    final checked = segment?['checkedBaggage'] ?? '托运行李 1件15KG(28寸)';
    final checkInCounter = segment?['checkInCounter'] ?? '21-25';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildInfoItem('手提行李', carryOn.replaceAll('手提行李 ', '')),
              ),
              Expanded(
                child: _buildInfoItem('托运行李', checked.replaceAll('托运行李 ', '')),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: _buildInfoItem('值机柜台', checkInCounter),
          ),
        ],
      ),
    );
  }

  /// 信息项
  Widget _buildInfoItem(String label, String value) {
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '$label ',
            style: const TextStyle(
              fontSize: 13,
              color: Colors.black45,
            ),
          ),
          TextSpan(
            text: value,
            style: const TextStyle(
              fontSize: 13,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  /// 服务按钮
  Widget _buildServiceButtons(BuildContext context, OrderModel order) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildServiceButton(
            context,
            '租车',
            Icons.directions_car_outlined,
          ),
          _buildServiceButton(
            context,
            '在线客服',
            Icons.headset_mic_outlined,
          ),
          _buildServiceButton(
            context,
            '航班动态',
            Icons.flight_outlined,
          ),
          _buildServiceButton(
            context,
            '订单详情',
            Icons.description_outlined,
            onTap: () => _navigateToOrderDetail(order),
          ),
        ],
      ),
    );
  }

  /// 服务按钮项
  Widget _buildServiceButton(
    BuildContext context,
    String label,
    IconData icon, {
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap ??
          () {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(label)),
            );
          },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 24,
            color: Colors.black54,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  /// 值机服务卡片
  Widget _buildCheckinServiceCard(BuildContext context, OrderModel order) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: Color(0xFF00D0D8),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '值机服务',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    '值机已开放，先人一步抢好座',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF00D0D8),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                '去值机',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 趣玩地图卡片
  Widget _buildFunMapCard(BuildContext context, OrderModel order) {
    final destination = _getDestination(order);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: Color(0xFF00D0D8),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Text(
                        '趣玩地图',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                      SizedBox(width: 4),
                      Icon(
                        Icons.map_outlined,
                        size: 18,
                        color: Color(0xFFFF6B35),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$destination精华景点地图·共45个景点',
                    style: const TextStyle(
                      fontSize: 13,
                      color: Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF00D0D8),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                '去看看',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 接送机服务卡片
  Widget _buildTransferServiceCard(BuildContext context, OrderModel order) {
    final destination = _getDestination(order);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF00D0D8),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  '接送机',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const Spacer(),
                const Text(
                  '租车',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.black54,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE3F2FD),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.map_outlined,
                    size: 20,
                    color: Color(0xFF00D0D8),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Color(0xFFFFF3E0),
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(12)),
            ),
            child: Row(
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF6B35).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.local_taxi,
                    size: 32,
                    color: Color(0xFFFF6B35),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$destination接送机',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '新客立享88折，专车接送更省心',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF6B35),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    '去领取',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 导航到订单详情页
  void _navigateToOrderDetail(OrderModel order) {
    // 根据订单类型路由到不同的专用详情页面
    switch (order.type) {
      case OrderType.flight:
        // 机票订单 -> FlightOrderDetailPage
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => FlightOrderDetailPage(order: order),
          ),
        );
        break;

      case OrderType.hotel:
        // 酒店订单 -> OrderDetailPage
        final travelerProvider = context.read<TravelerProviderAppTravel>();
        final defaultTraveler = travelerProvider.defaultTraveler;
        final orderDetail = OrderConverter.toOrderDetail(
          order,
          defaultTraveler: defaultTraveler,
        );
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => OrderDetailPage(orderDetail: orderDetail),
          ),
        );
        break;

      case OrderType.train:
      case OrderType.scenic:
      case OrderType.tour:
        // 其他订单类型暂时显示待开发提示
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${order.typeDisplayName}详情页面开发中...'),
            duration: const Duration(seconds: 2),
          ),
        );
        break;
    }
  }

  Widget _buildEmptyState() {
    return const SizedBox(
      height: 300.0,
    );
  }

  Widget _buildTravelInspiration() {
    return Container(
      margin: const EdgeInsets.only(top: 12.0, bottom: 16.0),
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 16.0),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '旅行灵感',
            style: TextStyle(
              fontSize: 17.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 12.0),
          ..._inspirations.map((inspiration) =>
              _buildInspirationItem(inspiration)),
        ],
      ),
    );
  }

  Widget _buildInspirationItem(TravelInspirationModel inspiration) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12.0),
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F8F8),
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Row(
        children: [
          Container(
            width: 48.0,
            height: 48.0,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8.0),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8.0),
              child: Image.asset(
                inspiration.imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: const Color(0xFF4A9F7C),
                    child: const Icon(
                      Icons.map_outlined,
                      color: Colors.white,
                      size: 28.0,
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(width: 12.0),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  inspiration.title,
                  style: const TextStyle(
                    fontSize: 15.0,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4.0),
                Text(
                  inspiration.subtitle,
                  style: const TextStyle(
                    fontSize: 13.0,
                    color: Colors.black45,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.chevron_right,
            size: 20.0,
            color: Colors.black26,
          ),
        ],
      ),
    );
  }

  Widget _buildHotSelection() {
    final travelCards = TravelMapData.getTravelMaps();

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '趣玩地图',
            style: TextStyle(
              fontSize: 17.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 16.0),
          LayoutBuilder(
            builder: (context, constraints) {
              final cardWidth = (constraints.maxWidth - 12.0) / 2;
              final cardHeight = cardWidth * 1.35;

              return Wrap(
                spacing: 12.0,
                runSpacing: 12.0,
                children: travelCards.map((card) {
                  return SizedBox(
                    width: cardWidth,
                    height: cardHeight,
                    child: _buildTravelCard(card),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildTravelCard(TravelMapModel card) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 4.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(8.0)),
              child: Image.asset(
                card.imagePath,
                fit: BoxFit.cover,
                width: double.infinity,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: Colors.grey[200],
                    child: const Center(
                      child: Icon(
                        Icons.image_not_supported,
                        color: Colors.grey,
                        size: 32.0,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  card.title,
                  style: const TextStyle(
                    fontSize: 13.0,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                    height: 1.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (card.subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2.0),
                  Text(
                    card.subtitle,
                    style: TextStyle(
                      fontSize: 11.0,
                      color: Colors.grey[600],
                      height: 1.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 6.0),
                Row(
                  children: [
                    CircleAvatar(
                      radius: 10.0,
                      backgroundColor: Colors.grey[300],
                      child: Icon(
                        Icons.person,
                        size: 12.0,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(width: 6.0),
                    Expanded(
                      child: Text(
                        card.userName,
                        style: TextStyle(
                          fontSize: 10.0,
                          color: Colors.grey[600],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
