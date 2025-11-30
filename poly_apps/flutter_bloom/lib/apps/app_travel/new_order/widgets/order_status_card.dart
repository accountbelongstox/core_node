import 'package:flutter/material.dart';
import '../models/order_detail_model.dart';

/// 订单状态卡片（与AppBar融为一体的顶部区域）
class OrderStatusCard extends StatelessWidget {
  final OrderDetailStatus status;
  final DateTime checkInDate;
  final DateTime checkOutDate;
  final int nights;
  final String checkInTime;
  final String checkOutTime;

  const OrderStatusCard({
    super.key,
    required this.status,
    required this.checkInDate,
    required this.checkOutDate,
    required this.nights,
    required this.checkInTime,
    required this.checkOutTime,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 主题色背景区域
        Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            color: Color(0xFF00D0D8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 状态标题
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Text(
                  status.displayName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              // 提示信息
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Text(
                  _getCheckInTip(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
        // 白色背景入住信息区域
        Container(
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
                      '入住：$checkInTime',
                      style: const TextStyle(
                        color: Color(0xFF666666),
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '离店：$checkOutTime',
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
        ),
      ],
    );
  }

  /// 获取入住提示文字
  String _getCheckInTip() {
    switch (status) {
      case OrderDetailStatus.pending:
        return '请尽快完成支付以确保预订';
      case OrderDetailStatus.confirmed:
      case OrderDetailStatus.checkingIn:
        return '请在当地时间14:00~次日00:00办理入住';
      case OrderDetailStatus.completed:
        return '感谢您的入住，期待再次为您服务';
      case OrderDetailStatus.cancelled:
        return '订单已取消';
      case OrderDetailStatus.refunded:
        return '订单已退款';
    }
  }

  /// 格式化日期范围
  String _formatDateRange() {
    String formatDate(DateTime date) {
      const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
      final month = date.month.toString().padLeft(2, '0');
      final day = date.day.toString().padLeft(2, '0');
      final weekday = weekdays[date.weekday - 1];
      return '$month月$day日($weekday)';
    }

    final start = formatDate(checkInDate);
    final end = formatDate(checkOutDate);
    return '$start - $end · 共${nights}晚';
  }
}
