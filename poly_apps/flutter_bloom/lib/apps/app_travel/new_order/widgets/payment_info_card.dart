import 'package:flutter/material.dart';
import '../models/order_detail_model.dart';

/// 支付信息卡片
class PaymentInfoCard extends StatelessWidget {
  final PaymentInfo payment;
  final int nights;
  final VoidCallback? onTapCostDetail;
  final VoidCallback? onTapDetail;

  const PaymentInfoCard({
    super.key,
    required this.payment,
    required this.nights,
    this.onTapCostDetail,
    this.onTapDetail,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        children: [
          // 在线支付和金额
          _buildInfoRow(
            icon: Icons.payment,
            label: '在线支付',
            value: '¥${payment.totalAmount.toStringAsFixed(2)}',
            trailing: '费用明细',
            onTap: onTapCostDetail ?? () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('费用明细')),
              );
            },
          ),
          const Divider(height: 20),
          // 取消政策
          _buildInfoRow(
            icon: Icons.cancel_outlined,
            label: '预订成功后，不可取消',
            trailing: '取消政策',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('取消政策')),
              );
            },
          ),
          const Divider(height: 20),
          // 确认函/行程单
          _buildInfoRow(
            icon: Icons.assignment_outlined,
            label: '向酒店出示，快速办理入住',
            trailing: '确认函/行程单',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('确认函/行程单')),
              );
            },
          ),
        ],
      ),
    );
  }

  /// 构建信息行
  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    String? value,
    String? trailing,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        children: [
          Icon(
            icon,
            size: 18,
            color: const Color(0xFF666666),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Row(
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.black87,
                  ),
                ),
                if (value != null) ...[
                  const Spacer(),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFFF6B35),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (trailing != null)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  trailing,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF00D0D8),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(
                  Icons.chevron_right,
                  size: 16,
                  color: Color(0xFF00D0D8),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
