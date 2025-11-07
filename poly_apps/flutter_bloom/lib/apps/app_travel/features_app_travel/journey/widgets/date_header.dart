import 'package:flutter/material.dart';

class DateHeader extends StatelessWidget {
  final DateTime date;
  final String? destination;

  const DateHeader({
    super.key,
    required this.date,
    this.destination,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      child: Row(
        children: [
          Icon(
            Icons.calendar_today,
            size: 18.0,
            color: Colors.grey[700],
          ),
          const SizedBox(width: 8.0),
          Text(
            _formatDate(),
            style: TextStyle(
              fontSize: 16.0,
              fontWeight: FontWeight.w600,
              color: Colors.grey[800],
            ),
          ),
          if (destination != null) ...[
            const SizedBox(width: 8.0),
            Text(
              '· 前往$destination',
              style: TextStyle(
                fontSize: 14.0,
                color: Colors.grey[600],
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate() {
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    final weekday = _getWeekdayName(date.weekday);
    return '$month月${day}日 $weekday';
  }

  String _getWeekdayName(int weekday) {
    const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return weekdays[weekday - 1];
  }
}
