import 'package:flutter/material.dart';
import '../models/order_detail_model.dart';

/// 住宿服务卡片
class ServicesCard extends StatelessWidget {
  final ServiceInfo services;
  final VoidCallback? onTapTransferService;

  const ServicesCard({
    super.key,
    required this.services,
    this.onTapTransferService,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题
          const Text(
            '住宿服务',
            style: TextStyle(
              color: Colors.black,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          // 发票服务
          _buildServiceItem(
            context,
            icon: Icons.receipt_outlined,
            title: services.canIssueInvoice ? '可开具发票' : '本订单不可开票',
            subtitle: services.invoiceNote,
            enabled: services.canIssueInvoice,
          ),
          if (services.transferService != null) ...[
            const Divider(height: 32),
            // 接送服务
            _buildTransferService(context, services.transferService!),
          ],
        ],
      ),
    );
  }

  Widget _buildServiceItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    String? subtitle,
    bool enabled = true,
    VoidCallback? onTap,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          icon,
          size: 24,
          color: enabled ? const Color(0xFF666666) : const Color(0xFF999999),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: enabled ? Colors.black : const Color(0xFF666666),
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFF999999),
                    fontSize: 14,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTransferService(BuildContext context, TransferService transfer) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.local_taxi_outlined,
              size: 24,
              color: Color(0xFF666666),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '接送服务',
                    style: TextStyle(
                      color: Colors.black,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    transfer.description,
                    style: const TextStyle(
                      color: Color(0xFF666666),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: onTapTransferService ?? () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('预订接送服务')),
                      );
                    },
                    child: const Text(
                      '去预订',
                      style: TextStyle(
                        color: Color(0xFF007AFF),
                        fontSize: 14,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}
