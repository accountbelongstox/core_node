import 'package:flutter/material.dart';
import '../../../models_app_travel/itinerary_model.dart';

class FlightItineraryCard extends StatelessWidget {
  final ItineraryItemModel itinerary;
  final VoidCallback? onTap;

  const FlightItineraryCard({
    super.key,
    required this.itinerary,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final order = itinerary.relatedOrder;
    if (order == null) return const SizedBox.shrink();

    final extraInfo = order.extraInfo ?? {};
    final isMultiSegment = extraInfo['isMultiSegment'] == true;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 8.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isMultiSegment) ..._buildMultiSegmentFlight(extraInfo)
          else ..._buildSingleFlight(extraInfo),

          _buildActionButtons(),

          if (isMultiSegment) _buildExtraServices(),
        ],
      ),
    );
  }

  List<Widget> _buildMultiSegmentFlight(Map<String, dynamic> extraInfo) {
    final segments = extraInfo['segments'] as List? ?? [];
    final tripType = extraInfo['tripType'] as String? ?? '';
    final totalDuration = extraInfo['totalDuration'] as String? ?? '';
    final travelReminder = extraInfo['travelReminder'] as String? ?? '';
    final entryNote = extraInfo['entryNote'] as String? ?? '';
    final bookingNote = extraInfo['bookingNote'] as String? ?? '';

    final widgets = <Widget>[];

    if (tripType.isNotEmpty || totalDuration.isNotEmpty) {
      widgets.add(_buildTripHeader(tripType, totalDuration, itinerary.relatedOrder?.date ?? ''));
    }

    if (travelReminder.isNotEmpty) {
      widgets.add(_buildTravelReminder(travelReminder));
    }

    for (var i = 0; i < segments.length; i++) {
      final segment = segments[i] as Map<String, dynamic>;
      widgets.add(_buildDetailedFlightSegment(segment, i == 0));

      if (i < segments.length - 1) {
        final nextSegment = segments[i + 1] as Map<String, dynamic>;
        final layoverInfo = nextSegment['layoverBefore'] as String? ?? '';
        final layoverNote = nextSegment['layoverNote'] as String? ?? '';
        widgets.add(_buildTransferInfo(layoverInfo, layoverNote));
      }
    }

    if (entryNote.isNotEmpty || bookingNote.isNotEmpty) {
      widgets.add(_buildNotesSection(entryNote, bookingNote));
    }

    return widgets;
  }

  List<Widget> _buildSingleFlight(Map<String, dynamic> extraInfo) {
    return [
      _buildFlightSegment(extraInfo, true),
    ];
  }

  Widget _buildTripHeader(String tripType, String totalDuration, String date) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(12.0),
          topRight: Radius.circular(12.0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tripType,
            style: const TextStyle(
              fontSize: 16.0,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 4.0),
          Text(
            '$date|$totalDuration',
            style: const TextStyle(
              fontSize: 13.0,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTravelReminder(String reminder) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF4E5),
        border: Border(
          top: BorderSide(color: Colors.grey[200]!, width: 1.0),
          bottom: BorderSide(color: Colors.grey[200]!, width: 1.0),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: Color(0xFFFF9800), size: 18.0),
          const SizedBox(width: 8.0),
          Expanded(
            child: Text(
              reminder,
              style: const TextStyle(
                fontSize: 13.0,
                color: Color(0xFFFF9800),
              ),
            ),
          ),
          const Icon(Icons.chevron_right, color: Color(0xFFFF9800), size: 18.0),
        ],
      ),
    );
  }

  Widget _buildDetailedFlightSegment(Map<String, dynamic> segment, bool isFirst) {
    final flightNo = segment['flightNo'] as String? ?? '';
    final airline = segment['airline'] as String? ?? '';
    final airlineLogo = segment['airlineLogo'] as String? ?? '';
    final departureTime = segment['departureTime'] as String? ?? '';
    final arrivalTime = segment['arrivalTime'] as String? ?? '';
    final departure = segment['departure'] as String? ?? '';
    final arrival = segment['arrival'] as String? ?? '';
    final duration = segment['duration'] as String? ?? '';
    final aircraft = segment['aircraft'] as String? ?? '';
    final hasMeal = segment['hasMeal'] as bool? ?? false;

    return Container(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                departureTime,
                style: const TextStyle(
                  fontSize: 20.0,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const Spacer(),
              Text(
                duration,
                style: const TextStyle(
                  fontSize: 12.0,
                  color: Colors.black54,
                ),
              ),
              const Spacer(),
              Text(
                arrivalTime,
                style: const TextStyle(
                  fontSize: 20.0,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4.0),
          Row(
            children: [
              Expanded(
                child: Text(
                  departure,
                  style: const TextStyle(
                    fontSize: 12.0,
                    color: Colors.black54,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  arrival,
                  style: const TextStyle(
                    fontSize: 12.0,
                    color: Colors.black54,
                  ),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12.0),
          Row(
            children: [
              if (airlineLogo.isNotEmpty)
                Image.asset(
                  airlineLogo,
                  width: 24.0,
                  height: 24.0,
                  errorBuilder: (context, error, stackTrace) => const Icon(Icons.flight, size: 24.0),
                ),
              if (airlineLogo.isNotEmpty) const SizedBox(width: 8.0),
              Text(
                '$airline$flightNo',
                style: const TextStyle(
                  fontSize: 13.0,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(width: 4.0),
              Text(
                '|$aircraft',
                style: const TextStyle(
                  fontSize: 13.0,
                  color: Colors.black54,
                ),
              ),
              if (hasMeal) ...[
                const SizedBox(width: 4.0),
                const Text(
                  '有餐食',
                  style: TextStyle(
                    fontSize: 12.0,
                    color: Color(0xFF4CAF50),
                  ),
                ),
              ],
              const Spacer(),
              const Icon(Icons.chevron_right, color: Colors.black45, size: 18.0),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTransferInfo(String layoverInfo, String layoverNote) {
    final notes = layoverNote.split('\n');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8F0),
        border: Border(
          top: BorderSide(color: Colors.grey[200]!, width: 1.0),
          bottom: BorderSide(color: Colors.grey[200]!, width: 1.0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            layoverInfo,
            style: const TextStyle(
              fontSize: 13.0,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 4.0),
          ...notes.map((note) {
            final isWarning = note.startsWith('!');
            final isSuccess = note.startsWith('√');
            final displayText = note.replaceFirst(RegExp(r'^[!√]'), '');

            return Padding(
              padding: const EdgeInsets.only(top: 2.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isWarning)
                    const Icon(Icons.warning_amber, color: Color(0xFFFF9800), size: 14.0)
                  else if (isSuccess)
                    const Icon(Icons.check_circle, color: Color(0xFF4CAF50), size: 14.0)
                  else
                    const Icon(Icons.info_outline, color: Colors.black54, size: 14.0),
                  const SizedBox(width: 4.0),
                  Expanded(
                    child: Text(
                      displayText,
                      style: TextStyle(
                        fontSize: 12.0,
                        color: isWarning ? const Color(0xFFFF9800) : Colors.black54,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }

  Widget _buildNotesSection(String entryNote, String bookingNote) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (entryNote.isNotEmpty) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.place, color: Colors.black54, size: 16.0),
                const SizedBox(width: 8.0),
                Expanded(
                  child: Text(
                    entryNote,
                    style: const TextStyle(
                      fontSize: 12.0,
                      color: Colors.black54,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8.0),
          ],
          if (bookingNote.isNotEmpty) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline, color: Colors.black54, size: 16.0),
                const SizedBox(width: 8.0),
                Expanded(
                  child: Text(
                    bookingNote,
                    style: const TextStyle(
                      fontSize: 12.0,
                      color: Colors.black54,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPlanBanner(String reminder, Map<String, dynamic>? firstSegment) {
    final onTimeRate = firstSegment?['onTimeRate'] as String? ?? '';

    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: const BoxDecoration(
        color: Color(0xFF4DD0C6),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(12.0),
          topRight: Radius.circular(12.0),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.schedule, color: Colors.white, size: 18.0),
          const SizedBox(width: 8.0),
          Expanded(
            child: Text(
              '计划 | $onTimeRate, $reminder',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13.0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFlightSegment(Map<String, dynamic> segment, bool isLast) {
    final flightNo = segment['flightNo'] as String? ?? '';
    final airline = segment['airline'] as String? ?? '';
    final departureTime = segment['departureTime'] as String? ?? '';
    final arrivalTime = segment['arrivalTime'] as String? ?? '';
    final departure = segment['departure'] as String? ?? '';
    final arrival = segment['arrival'] as String? ?? '';
    final duration = segment['duration'] as String? ?? '';
    final carryOnBaggage = segment['carryOnBaggage'] as String? ?? '';
    final checkedBaggage = segment['checkedBaggage'] as String? ?? '';
    final checkInCounter = segment['checkInCounter'] as String? ?? '';

    return Container(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF6B35),
                  borderRadius: BorderRadius.circular(4.0),
                ),
                child: Text(
                  flightNo,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13.0,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8.0),
              Text(
                airline,
                style: const TextStyle(
                  fontSize: 14.0,
                  color: Colors.black87,
                ),
              ),
              const Spacer(),
              Text(
                itinerary.relatedOrder?.statusText ?? '出票完成',
                style: const TextStyle(
                  fontSize: 13.0,
                  color: Colors.black45,
                ),
              ),
              const SizedBox(width: 4.0),
              const Icon(
                Icons.chevron_right,
                size: 16.0,
                color: Colors.black45,
              ),
            ],
          ),
          const SizedBox(height: 16.0),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      departureTime,
                      style: const TextStyle(
                        fontSize: 28.0,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4.0),
                    Text(
                      departure,
                      style: const TextStyle(
                        fontSize: 13.0,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: Column(
                  children: [
                    const SizedBox(height: 8.0),
                    Icon(
                      Icons.flight,
                      size: 24.0,
                      color: Colors.grey[400],
                    ),
                    const SizedBox(height: 4.0),
                    Text(
                      duration,
                      style: TextStyle(
                        fontSize: 11.0,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      arrivalTime,
                      style: const TextStyle(
                        fontSize: 28.0,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4.0),
                    Text(
                      arrival,
                      style: const TextStyle(
                        fontSize: 13.0,
                        color: Colors.black54,
                      ),
                      textAlign: TextAlign.right,
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16.0),

          Row(
            children: [
              Expanded(
                child: Text(
                  carryOnBaggage,
                  style: const TextStyle(
                    fontSize: 12.0,
                    color: Colors.black54,
                  ),
                ),
              ),
              const SizedBox(width: 16.0),
              Expanded(
                child: Text(
                  checkedBaggage,
                  style: const TextStyle(
                    fontSize: 12.0,
                    color: Colors.black54,
                  ),
                ),
              ),
            ],
          ),

          if (checkInCounter.isNotEmpty) ...[
            const SizedBox(height: 8.0),
            Text(
              '值机柜台 $checkInCounter',
              style: const TextStyle(
                fontSize: 12.0,
                color: Colors.black54,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTransferDivider() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0),
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Container(
            width: 8.0,
            height: 8.0,
            decoration: BoxDecoration(
              color: const Color(0xFF4DD0C6),
              shape: BoxShape.circle,
            ),
          ),
          Expanded(
            child: Container(
              height: 1.0,
              margin: const EdgeInsets.symmetric(horizontal: 8.0),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF4DD0C6).withOpacity(0.3),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: Colors.grey[200]!, width: 1.0),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildActionButton('租车', Icons.directions_car_outlined),
          _buildActionButton('在线客服', Icons.headset_mic_outlined),
          _buildActionButton('航班动态', Icons.flight_takeoff),
          _buildActionButton('订单详情', Icons.receipt_long_outlined),
        ],
      ),
    );
  }

  Widget _buildActionButton(String label, IconData icon) {
    return InkWell(
      onTap: () {},
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 20.0, color: Colors.black54),
          const SizedBox(height: 4.0),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11.0,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExtraServices() {
    return Container(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          _buildServiceCard(
            '值机服务',
            '值机已开放，先人一步抢好座',
            Icons.airline_seat_recline_normal,
            const Color(0xFF4DD0C6),
          ),
          const SizedBox(height: 12.0),
          _buildServiceCard(
            '趣玩地图',
            '首尔精华景点地图 共45个景点',
            Icons.map_outlined,
            const Color(0xFFFFB84D),
          ),
          const SizedBox(height: 12.0),
          _buildServiceCard(
            '接送机',
            '首尔接送机\n新客立享88折，专车接送更省心',
            Icons.airport_shuttle,
            const Color(0xFF4A9F7C),
          ),
        ],
      ),
    );
  }

  Widget _buildServiceCard(String title, String subtitle, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Row(
        children: [
          Container(
            width: 40.0,
            height: 40.0,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8.0),
            ),
            child: Icon(icon, color: color, size: 22.0),
          ),
          const SizedBox(width: 12.0),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14.0,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4.0),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12.0,
                    color: Colors.black54,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(16.0),
            ),
            child: const Text(
              '去看看',
              style: TextStyle(
                color: Colors.white,
                fontSize: 12.0,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
