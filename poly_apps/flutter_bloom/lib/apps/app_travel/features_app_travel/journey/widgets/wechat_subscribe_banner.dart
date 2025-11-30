import 'package:flutter/material.dart';

class WechatSubscribeBanner extends StatelessWidget {
  final VoidCallback? onTap;

  const WechatSubscribeBanner({
    super.key,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 4.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: InkWell(
        onTap: onTap,
        child: Row(
          children: [
            Container(
              width: 40.0,
              height: 40.0,
              decoration: BoxDecoration(
                color: const Color(0xFF4DD0C6),
                borderRadius: BorderRadius.circular(20.0),
              ),
              child: const Icon(
                Icons.notifications_active_outlined,
                color: Colors.white,
                size: 22.0,
              ),
            ),
            const SizedBox(width: 12.0),
            const Expanded(
              child: Text(
                '关注公众号，行程变动实时推送',
                style: TextStyle(
                  fontSize: 14.0,
                  color: Colors.black87,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right,
              size: 20.0,
              color: Colors.black38,
            ),
          ],
        ),
      ),
    );
  }
}
