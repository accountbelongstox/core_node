import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// 订单详情页面导航栏
class OrderDetailAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String orderId;
  final VoidCallback? onBack;
  final VoidCallback? onCustomerService;
  final VoidCallback? onShare;

  const OrderDetailAppBar({
    super.key,
    required this.orderId,
    this.onBack,
    this.onCustomerService,
    this.onShare,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      systemOverlayStyle: const SystemUiOverlayStyle(
        statusBarColor: Color(0xFF00D0D8),
        statusBarIconBrightness: Brightness.light,
      ),
      backgroundColor: const Color(0xFF00D0D8),
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.chevron_left, color: Colors.white, size: 32),
        onPressed: onBack ?? () => Navigator.of(context).pop(),
      ),
      title: Text(
        '订单号 $orderId',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 15,
          fontWeight: FontWeight.normal,
        ),
      ),
      centerTitle: false,
      actions: [
        IconButton(
          icon: const Icon(Icons.headset_mic_outlined, color: Colors.white, size: 22),
          onPressed: onCustomerService ?? () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('客服功能')),
            );
          },
        ),
        const Text(
          '客服',
          style: TextStyle(
            color: Colors.white,
            fontSize: 13,
          ),
        ),
        const SizedBox(width: 12),
        IconButton(
          icon: const Icon(Icons.share_outlined, color: Colors.white, size: 22),
          onPressed: onShare ?? () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('分享功能')),
            );
          },
        ),
        const Text(
          '分享',
          style: TextStyle(
            color: Colors.white,
            fontSize: 13,
          ),
        ),
        const SizedBox(width: 12),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(56);
}
