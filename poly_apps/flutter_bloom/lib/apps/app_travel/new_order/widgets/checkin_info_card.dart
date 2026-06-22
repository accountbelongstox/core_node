import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/order_detail_model.dart';

/// 入住信息卡片（包含房型信息）
class CheckInInfoCard extends StatelessWidget {
  final CheckInInfo checkIn;
  final RoomInfo room;

  const CheckInInfoCard({
    super.key,
    required this.checkIn,
    required this.room,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 日期范围
          Row(
            children: [
              const Icon(
                Icons.calendar_today_outlined,
                size: 20,
                color: Color(0xFF666666),
              ),
              const SizedBox(width: 8),
              Text(
                _formatDateRange(),
                style: const TextStyle(
                  color: Colors.black,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // 入住和离店时间
          Padding(
            padding: const EdgeInsets.only(left: 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '入住：${checkIn.checkInTime}',
                  style: const TextStyle(
                    color: Color(0xFF666666),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '离店：${checkIn.checkOutTime}',
                  style: const TextStyle(
                    color: Color(0xFF666666),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(
    IconData icon,
    String title, {
    List<String>? subtitles,
    String? actionText,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 24, color: const Color(0xFF666666)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.black,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (subtitles != null) ...[
                const SizedBox(height: 4),
                ...subtitles.map((subtitle) => Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        subtitle,
                        style: const TextStyle(
                          color: Color(0xFF999999),
                          fontSize: 14,
                        ),
                      ),
                    )),
              ],
              if (actionText != null) ...[
                const SizedBox(height: 4),
                Text(
                  actionText,
                  style: const TextStyle(
                    color: Color(0xFF007AFF),
                    fontSize: 14,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  String _formatDateRange() {
    final formatter = DateFormat('MM月dd日(E)', 'zh_CN');
    final start = formatter.format(checkIn.checkInDate);
    final end = formatter.format(checkIn.checkOutDate);
    return '$start - $end · 共${checkIn.nights}晚';
  }

  String _formatDate(DateTime date) {
    return DateFormat('MM月dd日(E)', 'zh_CN').format(date);
  }
}
