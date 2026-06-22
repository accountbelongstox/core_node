import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// 住客信息卡片
class GuestInfoCard extends StatelessWidget {
  final List<String> guestNames;
  final String phone;
  final String email;

  const GuestInfoCard({
    super.key,
    required this.guestNames,
    required this.phone,
    required this.email,
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
            '住客信息',
            style: TextStyle(
              color: Colors.black,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          // 住客姓名
          _buildInfoRow(
            Icons.person_outline,
            '住客姓名',
            guestNames.join('\n'),
          ),
          const Divider(height: 32),
          // 联系电话
          _buildInfoRow(
            Icons.phone_outlined,
            '联系电话',
            phone,
            copyable: true,
            context: context,
          ),
          const Divider(height: 32),
          // 电子邮箱
          _buildInfoRow(
            Icons.email_outlined,
            '电子邮箱',
            email,
            copyable: true,
            context: context,
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(
    IconData icon,
    String label,
    String value, {
    bool copyable = false,
    BuildContext? context,
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
                label,
                style: const TextStyle(
                  color: Color(0xFF999999),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: const TextStyle(
                  color: Colors.black,
                  fontSize: 16,
                ),
              ),
            ],
          ),
        ),
        if (copyable && context != null)
          IconButton(
            icon: const Icon(Icons.copy, size: 20),
            color: const Color(0xFF007AFF),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: value));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('已复制到剪贴板'),
                  duration: Duration(seconds: 1),
                ),
              );
            },
          ),
      ],
    );
  }
}
