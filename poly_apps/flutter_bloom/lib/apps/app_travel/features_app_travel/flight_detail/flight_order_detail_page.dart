import 'package:flutter/material.dart';
import '../../models_app_travel/order_model.dart';
import '../../resources_app_travel/assets_images_app_travel.dart';

/// 机票订单详情页面
class FlightOrderDetailPage extends StatefulWidget {
  final OrderModel order;

  const FlightOrderDetailPage({
    super.key,
    required this.order,
  });

  @override
  State<FlightOrderDetailPage> createState() => _FlightOrderDetailPageState();
}

class _FlightOrderDetailPageState extends State<FlightOrderDetailPage> {
  bool _showAirportCode = false; // 切换机场名/代码显示

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: const Color(0xFF00D0D8),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          '订单详情',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w500,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.headset_mic_outlined, color: Colors.white),
            onPressed: () {
              // 客服功能
              debugPrint('Contact customer service');
            },
          ),
          IconButton(
            icon: const Icon(Icons.share_outlined, color: Colors.white),
            onPressed: () {
              // 分享功能
              debugPrint('Share order');
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildSuccessBanner(),
            const SizedBox(height: 8),
            _buildOrderInfo(),
            const SizedBox(height: 8),
            _buildRefundRules(),
            const SizedBox(height: 8),
            // Flight info now includes timeline and entry reminders
            _buildFlightInfo(),
            const SizedBox(height: 8),
            _buildEntryReminder(),
            const SizedBox(height: 8),
            _buildServicePackages(),
            const SizedBox(height: 8),
            _buildActionButtons(),
            const SizedBox(height: 8),
            _buildFlightStatus(),
            const SizedBox(height: 8),
            _buildRecommendations(),
            const SizedBox(height: 80), // 底部空间
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomActions(),
    );
  }

  /// 出票成功横幅
  Widget _buildSuccessBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      child: Row(
        children: [
          const Text(
            '出票成功',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const Spacer(),
          Text(
            '总价 ${widget.order.price}',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFF6B35),
            ),
          ),
          const SizedBox(width: 8),
          const Icon(
            Icons.info_outline,
            size: 20,
            color: Colors.grey,
          ),
        ],
      ),
    );
  }

  /// 订单信息
  Widget _buildOrderInfo() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: Colors.white,
      child: Row(
        children: [
          const Text(
            '订单号',
            style: TextStyle(
              fontSize: 14,
              color: Colors.black54,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            widget.order.id,
            style: const TextStyle(
              fontSize: 14,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  /// 退改签规则
  Widget _buildRefundRules() {
    final extraInfo = widget.order.extraInfo ?? {};
    final cancellationPolicy = extraInfo['cancellationPolicy'] ?? '';

    // Check if order is non-cancellable
    final isNonCancellable = cancellationPolicy.contains('不可取消') ||
                             cancellationPolicy.contains('不可退');

    // Don't show refund rules section if order is non-cancellable
    if (isNonCancellable) {
      return const SizedBox.shrink();
    }

    return Container(
      color: Colors.white,
      child: Column(
        children: [
          ListTile(
            title: const Text(
              '退改签规则',
              style: TextStyle(
                fontSize: 15,
                color: Color(0xFF00D0D8),
              ),
            ),
            trailing: const Icon(
              Icons.chevron_right,
              color: Colors.grey,
            ),
            onTap: () {
              debugPrint('View refund rules');
            },
          ),
          const Divider(height: 1),
          ListTile(
            title: const Text(
              '该订单下有退改操作',
              style: TextStyle(
                fontSize: 14,
                color: Colors.black87,
              ),
            ),
            trailing: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '查看详情',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.black54,
                  ),
                ),
                SizedBox(width: 4),
                Icon(
                  Icons.chevron_right,
                  color: Colors.grey,
                  size: 20,
                ),
              ],
            ),
            onTap: () {
              debugPrint('View refund operations');
            },
          ),
        ],
      ),
    );
  }

  /// 航班信息卡片 - Timeline style for multi-segment
  Widget _buildFlightInfo() {
    final extraInfo = widget.order.extraInfo ?? {};
    final segments = extraInfo['segments'] as List?;
    final hasMultipleSegments = segments != null && segments.length > 1;
    final tripType = extraInfo['tripType'] ?? '单程';
    final totalDuration = extraInfo['totalDuration'] ?? '总时长27h';

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Trip type badge + Date + Travel reminder
          Row(
            children: [
              // Blue badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF0066FF),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  tripType,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '${widget.order.date}  $totalDuration',
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.black87,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => debugPrint('Show travel reminder'),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, size: 16, color: Color(0xFF00D0D8)),
                    SizedBox(width: 4),
                    Text(
                      '出行提醒',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF00D0D8),
                      ),
                    ),
                    Icon(Icons.chevron_right, size: 16, color: Color(0xFF00D0D8)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Timeline-style segment display
          if (hasMultipleSegments && segments != null)
            _buildMultiSegmentTimeline(segments)
          else if (segments != null && segments.isNotEmpty)
            _buildSingleSegment(segments.first),

          const SizedBox(height: 16),

          // Collapse button
          Center(
            child: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '收起',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.black54,
                    ),
                  ),
                  Icon(
                    Icons.keyboard_arrow_up,
                    size: 18,
                    color: Colors.black54,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 出入境必备提示 (Moved to bottom of flight info with collapse)
  Widget _buildEntryReminder() {
    final extraInfo = widget.order.extraInfo ?? {};
    final entryNote = extraInfo['entryNote'] ?? '入境马来西亚须知：凡马来西亚免签入境人员都需在入境前3天内...';
    final bookingNote = extraInfo['bookingNote'] ?? '预订提醒：持商务、旅游等短期签证的旅客或免签的旅客建议购...';
    final cancellationPolicy = extraInfo['cancellationPolicy'] ?? '全程退票费360元起（有不可退的税费），提前改期免费';
    final insurance = extraInfo['insurance'] ?? '延误安心包 ¥48';

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Entry notice
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF4E6),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              entryNote,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFFFF6B35),
                height: 1.4,
              ),
            ),
          ),

          // Booking reminder
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF4E6),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              bookingNote,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFFFF6B35),
                height: 1.4,
              ),
            ),
          ),

          // Collapse/expand trigger indicator
          GestureDetector(
            onTap: () => setState(() {}),
            child: const Center(
              child: Icon(
                Icons.keyboard_arrow_down,
                size: 20,
                color: Colors.black26,
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Pricing section
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.order.price,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFF6B35),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '+$insurance',
                style: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF00A0E9),
                  decoration: TextDecoration.underline,
                ),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 8),

          // Baggage policy
          const Row(
            children: [
              Icon(Icons.check, size: 16, color: Color(0xFF4CAF50)),
              SizedBox(width: 4),
              Text(
                '托运行李 1x23kg，手提行李 1x7kg',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.black54,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),

          // Refund policy
          Row(
            children: [
              const Icon(Icons.check, size: 16, color: Color(0xFF4CAF50)),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  cancellationPolicy,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Colors.black54,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Additional info
          const Text(
            '经济舱 · 45分钟内出票 · 仅提供境外电子凭证',
            style: TextStyle(
              fontSize: 12,
              color: Colors.black38,
            ),
          ),
        ],
      ),
    );
  }

  /// Service packages section (delay insurance, etc.)
  Widget _buildServicePackages() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF4E6),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text(
              '延误安心包',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFFFF6B35),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Service list
          Row(
            children: [
              _buildServiceItem('✓', '延误补偿'),
              _buildServiceItem('✓', '优选权益 8选1'),
              _buildServiceItem('✓', '¥70接送机满减券'),
              _buildServiceItem('✓', '航班取...'),
            ],
          ),
          const SizedBox(height: 12),
          // Value proposition
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8E8),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Row(
              children: [
                Icon(Icons.redeem, size: 16, color: Color(0xFFFF9A56)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '4项权益总价值高达¥900，起飞前未使用未过期免费退',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.black87,
                      height: 1.3,
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

  /// Build a single service item
  Widget _buildServiceItem(String icon, String label) {
    return Expanded(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            icon,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF4CAF50),
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: Colors.black87,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  /// 电子行程单和行程助手按钮
  Widget _buildActionButtons() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () {
                debugPrint('View electronic itinerary');
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF00D0D8),
                side: const BorderSide(color: Color(0xFF00D0D8)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                '电子行程单',
                style: TextStyle(fontSize: 14),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton(
              onPressed: () {
                debugPrint('View itinerary assistant');
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF00D0D8),
                side: const BorderSide(color: Color(0xFF00D0D8)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                '行程助手',
                style: TextStyle(fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 航班动态
  Widget _buildFlightStatus() {
    final extraInfo = widget.order.extraInfo ?? {};
    final checkInCounter = extraInfo['checkInCounter'] ?? 'G,H';
    final gate = extraInfo['gate'] ?? 'D87';

    return Container(
      color: Colors.white,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        title: const Row(
          children: [
            Text(
              '航班动态',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
            ),
            SizedBox(width: 12),
            Text(
              '正常',
              style: TextStyle(
                fontSize: 14,
                color: Color(0xFF4CAF50),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(
            '值机柜台$checkInCounter  登机口$gate',
            style: const TextStyle(
              fontSize: 13,
              color: Colors.black54,
            ),
          ),
        ),
        trailing: const Icon(
          Icons.chevron_right,
          color: Colors.grey,
        ),
        onTap: () {
          debugPrint('View flight status details');
        },
      ),
    );
  }

  /// 推荐服务
  Widget _buildRecommendations() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '出行有保障，你还需要这些',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F8F8),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Image.asset(
                  AssetsImagesAppTravel.travelHotHotel,
                  width: 48,
                  height: 48,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFF00D0D8),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.hotel,
                        color: Colors.white,
                      ),
                    );
                  },
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '境外酒店',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '满200减20  最高满减100',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
                const Text(
                  '立即查看',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF00D0D8),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: Color(0xFF00D0D8),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 底部操作按钮
  Widget _buildBottomActions() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: ElevatedButton(
              onPressed: () {
                debugPrint('Write review');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF9A56),
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                '我要评论',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: () {
                debugPrint('Book return flight');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF6B35),
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                '预订返程',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Build timeline for multi-segment flights
  Widget _buildMultiSegmentTimeline(List segments) {
    return Column(
      children: List.generate(segments.length, (index) {
        final segment = segments[index];
        final isLast = index == segments.length - 1;

        return Column(
          children: [
            _buildTimelineSegment(segment, index),
            if (!isLast) _buildTransferSection(segment, segments[index + 1]),
          ],
        );
      }),
    );
  }

  /// Build single timeline segment
  Widget _buildTimelineSegment(dynamic segment, int index) {
    final departureTime = segment['departureTime'] ?? '16:35';
    final arrivalTime = segment['arrivalTime'] ?? '20:25';
    final duration = segment['duration'] ?? '4h50m';
    final departure = segment['departure'] ?? 'SPN 塞班国际机场';
    final arrival = segment['arrival'] ?? 'ICN 首尔 仁川国际机场 T1';
    final airline = segment['airline'] ?? '济州航空';
    final flightNo = segment['flightNo'] ?? '7C3212';
    final aircraft = segment['aircraft'] ?? '波音737-800(中)';
    final hasMeal = segment['hasMeal'] ?? false;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left: Time and duration
        SizedBox(
          width: 80,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Departure time
              Text(
                departureTime,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              // Duration
              Text(
                duration,
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.black38,
                ),
              ),
              const SizedBox(height: 20),
              // Arrival time
              Text(
                arrivalTime,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ),

        // Middle: Timeline indicator
        Container(
          width: 20,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Colors.black26,
                  shape: BoxShape.circle,
                ),
              ),
              Container(
                width: 1,
                height: 60,
                color: Colors.black12,
              ),
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Colors.black26,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
        ),

        // Right: Flight info
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Departure airport
              Text(
                departure,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              // Flight info with chevron
              GestureDetector(
                onTap: () => debugPrint('Expand flight details'),
                child: Row(
                  children: [
                    // Airline logo placeholder
                    Container(
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        color: Colors.orange,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '$airline $flightNo | $aircraft',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.black54,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (hasMeal)
                      const Padding(
                        padding: EdgeInsets.only(left: 4),
                        child: Text(
                          '有餐食',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.black38,
                          ),
                        ),
                      ),
                    const Icon(
                      Icons.chevron_right,
                      size: 16,
                      color: Colors.black38,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              // Arrival airport
              Text(
                arrival,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Build transfer section between segments
  Widget _buildTransferSection(dynamic currentSegment, dynamic nextSegment) {
    final String layoverBefore = (nextSegment['layoverBefore'] ?? '中转首尔 12h25m') as String;
    final String layoverNote = (nextSegment['layoverNote'] ?? '') as String;
    final String departureDate = (nextSegment['departureDate'] ?? '') as String;
    final String currentDepartureDate = (currentSegment['departureDate'] ?? '') as String;

    // Check if date changes (cross-day transfer)
    final hasDayChange = departureDate.isNotEmpty &&
                         currentDepartureDate.isNotEmpty &&
                         departureDate != currentDepartureDate;

    // Extract date for display (e.g., "11-13" from "2025-11-13")
    String? dayChangeText;
    if (hasDayChange && departureDate.length >= 10) {
      final parts = departureDate.split('-');
      if (parts.length >= 3) {
        dayChangeText = '${parts[1]}-${parts[2]}';
      }
    }

    // Parse layover notes into warnings and success messages
    final List<String> notes = layoverNote.split('|');
    final List<String> warnings = [];
    final List<String> successes = [];

    for (final String note in notes) {
      final trimmed = note.trim();
      if (trimmed.startsWith('!')) {
        warnings.add(trimmed.replaceFirst('!', '').trim());
      } else if (trimmed.startsWith('√')) {
        successes.add(trimmed.replaceFirst('√', '').trim());
      }
    }

    return Container(
      margin: const EdgeInsets.only(left: 86, bottom: 16),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Transfer time header with day change indicator
          Row(
            children: [
              Container(
                width: 16,
                height: 16,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.fromBorderSide(BorderSide(color: Colors.black26, width: 2)),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                layoverBefore,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: Colors.black87,
                ),
              ),
              if (dayChangeText != null) ...[
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    dayChangeText,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.red.shade700,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ],
          ),

          // Warning messages
          if (warnings.isNotEmpty) ...[
            const SizedBox(height: 8),
            for (final warning in warnings)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '! ',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFFFF6B35),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        warning,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFFFF6B35),
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],

          // Success messages
          if (successes.isNotEmpty) ...[
            const SizedBox(height: 4),
            for (final success in successes)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '✓ ',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF4CAF50),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        success,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF4CAF50),
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }

  /// Build single segment (for non-multi-segment flights)
  Widget _buildSingleSegment(dynamic segment) {
    return _buildTimelineSegment(segment, 0);
  }
}
